"""
LLM(Gemini)으로 recipes.content에서 "실제로 요리에 쓰이는 재료"를 뽑아내고,
기존 재료 사전(ingredient_profile_dict_with_substitutes.csv)으로 정규화해서
used_ingredients를 다시 만드는 스크립트.

역할 분리:
- LLM: 지저분한 본문을 읽고 "이 레시피에 실제로 필요한 재료가 뭔지" 자연어로 이해해서 뽑아냄
  (기존 update_used_ingredients_batch.py의 룰베이스가 못하는 부분)
- 사전(dict) 매칭: LLM이 뽑은 재료명을 사전의 대표 keyword로 정규화 (100% 결정론적, LLM 관여 없음)
  → 사전에 없는 건 버리고 "사전 후보"로만 CSV에 남김 (used_ingredients에는 안 들어감)

출력 포맷은 기존과 동일하게 유지한다: 콤마 구분, 공백 없음, 정렬됨.
→ 프론트 pill 매칭(split(','))과 백엔드 매칭률 SQL(FIND_IN_SET)을 손댈 필요 없음.

기본은 미리보기(CSV)만 만들고 DB는 건드리지 않는다. DB 반영은 --commit을 명시해야 한다.

사용 예:
  # 소량 샘플로 품질 확인 (DB 미반영)
  python -u ingredient_management/llm_ingredient_extraction.py --limit 20

  # 이어서 처리 (id 100 초과부터)
  python -u ingredient_management/llm_ingredient_extraction.py --limit 500 --start-after-id 100

  # 실제 DB 반영 (신중하게, 먼저 --limit으로 소량 검증 후)
  python -u ingredient_management/llm_ingredient_extraction.py --limit 500 --commit
"""

import argparse
from collections import Counter
import csv
import json
import os
import re
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

import pymysql
import requests

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover
    load_dotenv = None

_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _PROJECT_ROOT not in sys.path:
    sys.path.append(_PROJECT_ROOT)

# 이 두 함수는 배치 실행(run)에서만 쓴다. 모듈 최상단에서 가져오면
# update_used_ingredients_batch 가 함께 로드되는데, 그쪽은 import 시점에
# 재료 사전 CSV 를 읽고 backend.backend.* 까지 끌어온다. 백엔드 서버는 이
# 파일의 "사전 정규화" 부분만 쓰므로, 그 무거운 사슬 때문에 서버가 죽지
# 않도록 실제로 필요할 때 가져온다.
def _batch_helpers():
    from ingredient_management.update_used_ingredients_batch import (
        _connect_db,
        _used_ingredient_token_set,
    )
    return _connect_db, _used_ingredient_token_set

CONTENT_CHAR_LIMIT = 4000  # 본문이 너무 길면 앞부분만 (재료는 보통 본문 앞쪽에 나옴)

# 일일 호출 한도가 바닥나면 남은 호출은 시도조차 하지 않고 이 에러로 표시한다.
# (한도 소진은 자정(PT)까지 안 풀려서 재시도 백오프 31초가 전부 헛돌기 때문)
QUOTA_EXHAUSTED_ERR = "daily quota exhausted (skipped)"


# 사전 정규화는 backend/ingredient_dictionary.py 한 곳에만 둔다.
# (웹 서버도 같은 기준을 써야 하는데, 이 파일은 배치용이라 pandas 와 다른 배치
#  모듈을 끌고 와서 서버가 가져다 쓰기에 무겁고 배포에서 잘 깨졌다.)
# 예전 이름을 그대로 쓰던 스크립트들이 있어 별칭으로 남겨 둔다.
from backend.ingredient_dictionary import (  # noqa: E402
    PREP_PREFIXES as _PREP_PREFIXES,
    load_alias_to_canonical,
    normalize_key as _normalize_key,
    resolve_canonical as _resolve_canonical,
    token_fallback as _token_fallback,
)


def _extract_json_array(text):
    if not text:
        return []
    cleaned = text.strip()
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", cleaned)
    if fenced:
        cleaned = fenced.group(1).strip()
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\[[\s\S]*\]", cleaned)
        if not match:
            return []
        try:
            data = json.loads(match.group(0))
        except json.JSONDecodeError:
            return []
    if isinstance(data, dict):
        # 혹시 {"ingredients": [...]} 형태로 나와도 복구
        for v in data.values():
            if isinstance(v, list):
                data = v
                break
    if not isinstance(data, list):
        return []
    return [str(x).strip() for x in data if str(x).strip()]


def _extract_json_object(text):
    """배치 응답: {"0": [...], "1": [...], ...} 형태를 파싱."""
    if not text:
        return {}
    cleaned = text.strip()
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", cleaned)
    if fenced:
        cleaned = fenced.group(1).strip()
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", cleaned)
        if not match:
            return {}
        try:
            data = json.loads(match.group(0))
        except json.JSONDecodeError:
            return {}
    if not isinstance(data, dict):
        return {}
    result = {}
    for k, v in data.items():
        if isinstance(v, list):
            result[str(k)] = [str(x).strip() for x in v if str(x).strip()]
    return result


PROMPT_TEMPLATE = """너는 레시피 본문에서 실제로 요리에 사용되는 재료만 뽑아내는 어시스턴트다.

아래는 블로그/영상 설명에서 가져온 레시피 본문이다.

본문:
{content}

규칙:
- 실제로 이 요리를 만드는 데 쓰이는 재료만 포함한다 (양념/조미료 포함).
- 재료 이름만 적는다. 수량, 단위, 손질법, 괄호 설명은 빼고 순수 재료명만.
- 완성 사진 캡션, 다른 레시피 추천, 광고/구독 유도 문구에서 나온 단어는 재료가 아니면 제외한다.
- 같은 재료가 여러 번 나오면 한 번만 적는다.
- 확신이 없으면 포함하지 않는다. 본문에 재료가 안 보이면 빈 배열을 출력한다.

아래 JSON 배열만 출력해라. 다른 텍스트는 출력하지 마라.
예: ["돼지고기", "김치", "대파", "고춧가루"]
"""

BATCH_PROMPT_TEMPLATE = """너는 여러 개의 레시피 본문 각각에서 실제로 요리에 사용되는 재료만 뽑아내는 어시스턴트다.

아래는 번호가 매겨진 레시피 본문 {n}개다. 각 본문은 서로 다른 레시피이며 완전히 독립적으로 처리해야 한다.

{numbered_bodies}

규칙:
- 각 번호의 재료는 그 번호의 본문에서만 뽑는다 (다른 번호 본문과 절대 섞지 않는다).
- 실제로 그 요리를 만드는 데 쓰이는 재료만 포함한다 (양념/조미료 포함).
- 재료 이름만 적는다. 수량, 단위, 손질법, 괄호 설명은 빼고 순수 재료명만.
- 완성 사진 캡션, 다른 레시피 추천, 광고/구독 유도 문구에서 나온 단어는 재료가 아니면 제외한다.
- 같은 재료가 여러 번 나오면 한 번만 적는다.
- 확신이 없으면 포함하지 않는다. 본문에 재료가 안 보이면 빈 배열을 출력한다.
- 반드시 0부터 {n_minus_1}까지 모든 번호에 대해 결과를 포함해야 한다. 하나도 빠뜨리지 마라.

아래 JSON 객체만 출력해라. key는 번호(문자열), value는 그 본문의 재료 배열. 다른 텍스트는 출력하지 마라.
예: {{"0": ["돼지고기", "김치"], "1": [], "2": ["대파", "고춧가루"]}}
"""


class GeminiExtractor:
    def __init__(self, api_key, model="gemini-3.5-flash-lite", rpm=60):
        self.api_key = api_key
        self.model = model
        self._lock = threading.Lock()
        self._min_interval = 60.0 / max(1, rpm)
        self._last_call = 0.0
        # 일일 한도가 소진된 순간부터는 남은 호출을 전부 즉시 포기한다 (스레드 공유 플래그)
        self._quota_exhausted = threading.Event()

    def _throttle(self):
        with self._lock:
            now = time.monotonic()
            wait = self._last_call + self._min_interval - now
            if wait > 0:
                time.sleep(wait)
            self._last_call = time.monotonic()

    @property
    def quota_exhausted(self):
        return self._quota_exhausted.is_set()

    def _trip_quota(self, reason):
        """일일 한도 소진 확정. 최초 1회만 로그를 남기고 이후 호출은 전부 건너뛴다."""
        if not self._quota_exhausted.is_set():
            self._quota_exhausted.set()
            print(
                f"  [중단] 일일 호출 한도 소진으로 판단 ({reason}). "
                f"남은 건은 호출하지 않고 건너뜁니다 (다음 실행에서 자동 재시도).",
                flush=True,
            )

    @staticmethod
    def _quota_scope(res):
        """429 응답의 quotaId로 제한 종류를 구분한다: 'day' | 'minute' | None(불명)."""
        try:
            body = res.text.replace(" ", "").lower()
        except Exception:  # noqa: BLE001
            return None
        if "perday" in body:
            return "day"
        if "perminute" in body:
            return "minute"
        return None

    def extract(self, content, retries=5):
        text = (content or "")[:CONTENT_CHAR_LIMIT]
        prompt = PROMPT_TEMPLATE.format(content=text)
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.model}:generateContent?key={self.api_key}"
        )
        payload = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"},
        }
        if self._quota_exhausted.is_set():
            return [], QUOTA_EXHAUSTED_ERR
        last_err = None
        scope_429 = None
        for attempt in range(retries):
            self._throttle()
            try:
                res = requests.post(url, json=payload, timeout=30)
                if res.status_code in (429, 500, 503):
                    last_err = f"HTTP {res.status_code}"
                    if res.status_code == 429:
                        scope_429 = self._quota_scope(res)
                    if scope_429 == "day":
                        self._trip_quota("429 응답의 quotaId가 일일 한도")
                        return [], QUOTA_EXHAUSTED_ERR
                    time.sleep(2 ** attempt)
                    continue
                res.raise_for_status()
                data = res.json()
                parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
                raw = "".join(p.get("text", "") for p in parts)
                return _extract_json_array(raw), None
            except Exception as e:  # noqa: BLE001
                last_err = str(e)
                time.sleep(2 ** attempt)
        if last_err == "HTTP 429" and scope_429 != "minute":
            # 백오프(총 31초)를 다 쓰고도 429면 일일 한도로 본다.
            # 단 quotaId가 분당 제한이라고 명시한 경우는 제외 — 분당 제한은 곧 풀리는데
            # 이걸 일일 한도로 오판하면 그날 작업 전체를 통째로 조기 중단시키게 된다.
            self._trip_quota("재시도 소진 후에도 429")
        return [], last_err

    def extract_batch(self, contents, retries=5):
        """여러 본문을 한 번의 호출로 처리해 API 호출 횟수(=일일 한도 소모)를 줄인다.
        반환: (raw_ingredients_per_index: list[list[str]], err_per_index: list[str|None])
        배치 호출 자체가 실패하면 전체가 동일한 err를 갖고, 일부 번호만 응답에서 빠지면
        그 번호만 개별 err를 갖는다 (나머지는 정상 처리됨).
        """
        n = len(contents)
        if self._quota_exhausted.is_set():
            return [[] for _ in range(n)], [QUOTA_EXHAUSTED_ERR for _ in range(n)]
        texts = [(c or "")[:CONTENT_CHAR_LIMIT] for c in contents]
        numbered_bodies = "\n\n".join(f"[{i}]\n{t}" for i, t in enumerate(texts))
        prompt = BATCH_PROMPT_TEMPLATE.format(n=n, n_minus_1=n - 1, numbered_bodies=numbered_bodies)
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.model}:generateContent?key={self.api_key}"
        )
        payload = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"},
        }
        last_err = None
        scope_429 = None
        for attempt in range(retries):
            self._throttle()
            try:
                res = requests.post(url, json=payload, timeout=60)
                if res.status_code in (429, 500, 503):
                    last_err = f"HTTP {res.status_code}"
                    if res.status_code == 429:
                        scope_429 = self._quota_scope(res)
                    if scope_429 == "day":
                        self._trip_quota("429 응답의 quotaId가 일일 한도")
                        return [[] for _ in range(n)], [QUOTA_EXHAUSTED_ERR for _ in range(n)]
                    time.sleep(2 ** attempt)
                    continue
                res.raise_for_status()
                data = res.json()
                parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
                raw = "".join(p.get("text", "") for p in parts)
                obj = _extract_json_object(raw)
                raw_list = []
                err_list = []
                for i in range(n):
                    if str(i) in obj:
                        raw_list.append(obj[str(i)])
                        err_list.append(None)
                    else:
                        raw_list.append([])
                        err_list.append("batch response missing this index")
                return raw_list, err_list
            except Exception as e:  # noqa: BLE001
                last_err = str(e)
                time.sleep(2 ** attempt)
        if last_err == "HTTP 429" and scope_429 != "minute":
            # 백오프(총 31초)를 다 쓰고도 429면 일일 한도로 본다.
            # 단 quotaId가 분당 제한이라고 명시한 경우는 제외 — 분당 제한은 곧 풀리는데
            # 이걸 일일 한도로 오판하면 그날 작업 전체를 통째로 조기 중단시키게 된다.
            self._trip_quota("재시도 소진 후에도 429")
        return [[] for _ in range(n)], [last_err for _ in range(n)]


# 재료명 앞에 붙는 손질/상태 수식어. "다진 생강"은 사전에 없지만 "생강"은 있으므로,
# 사전 조회에 실패하면 이 접두어들을 떼고 한 번 더 조회한다.
# (LLM 호출 없는 순수 결정론적 보강 — 사전에 실제로 있는 재료만 잡히므로 오탐이 없다)
#
# 주의: 접두어를 떼면 다른 재료가 되어버리는 말은 넣으면 안 된다.
#   예) "생"을 넣으면 생강 -> 강, 생수 -> 수 처럼 망가진다. 그래서 접두어 목록 자체를
#       보수적으로 두고, 떼어낸 결과가 사전에 실제로 있을 때만 채택한다.
#       ("다진파 -> 파" 처럼 한 글자만 남는 경우도 사전에 있으면 유효하다)
_PREP_PREFIXES = (
    "다진", "채썬", "채썰은", "슬라이스", "삶은", "데친", "구운", "볶은", "튀긴",
    "냉동", "냉장", "말린", "불린", "손질", "으깬", "저민", "편썬",
    "고운", "굵은", "잘게", "곱게", "신", "묵은", "건",
)


def _token_fallback(name, alias_to_canonical):
    """띄어쓰기로 나뉜 이름에서 사전에 있는 부분만 골라낸다.

    "다시다 감칠맛" 처럼 재료명 뒤에 맛/용도 설명이 붙거나, "돼지고기 목살" 처럼
    분류어와 부위가 함께 적히는 경우를 잡기 위한 마지막 보완이다.

    한국어는 보통 뒤쪽 말이 핵심이므로(돼지고기 "목살"), 뒤에서 시작하는 후보를
    먼저 채택한다. 다만 뒤쪽이 사전에 없으면 앞쪽이 채택된다("다시다" 감칠맛).
    사전에 실제로 있는 조각만 받아들이므로 없는 말을 지어내지는 않는다.
    """
    tokens = str(name).strip().split()
    if len(tokens) < 2:
        return None
    n = len(tokens)
    best = None  # (시작 인덱스, 길이, 대표어)
    for start in range(n):
        for end in range(n, start, -1):
            if start == 0 and end == n:
                continue  # 전체 문자열은 이미 앞에서 시도했다
            candidate = _normalize_key("".join(tokens[start:end]))
            if not candidate or candidate not in alias_to_canonical:
                continue
            length = end - start
            if best is None or start > best[0] or (start == best[0] and length > best[1]):
                best = (start, length, alias_to_canonical[candidate])
    return best[2] if best else None


def _resolve_canonical(name, alias_to_canonical):
    """사전에서 대표 keyword를 찾는다.

    1) 정확히 일치 → 2) 손질 수식어를 떼고 재시도 → 3) 띄어쓰기 조각으로 재시도.
    어느 단계든 사전에 실제로 있는 결과만 채택한다.
    """
    key = _normalize_key(name)
    if not key:
        return None
    canonical = alias_to_canonical.get(key)
    if canonical:
        return canonical
    stripped = key
    while True:
        for prefix in _PREP_PREFIXES:
            if stripped.startswith(prefix) and len(stripped) - len(prefix) >= 1:
                stripped = stripped[len(prefix):]
                break
        else:
            break
    if stripped != key:
        canonical = alias_to_canonical.get(stripped)
        if canonical:
            return canonical
    return _token_fallback(name, alias_to_canonical)


def normalize_llm_ingredients(raw_ingredients, alias_to_canonical):
    canonical_set = set()
    unmapped = []
    for name in raw_ingredients:
        if not _normalize_key(name):
            continue
        canonical = _resolve_canonical(name, alias_to_canonical)
        if canonical:
            canonical_set.add(canonical)
        else:
            unmapped.append(name)
    used_str = ",".join(sorted(canonical_set)) if canonical_set else None
    return used_str, unmapped


def _load_env_files():
    if load_dotenv is None:
        return
    load_dotenv(os.path.join(_PROJECT_ROOT, "backend", ".env"))
    load_dotenv(os.path.join(_PROJECT_ROOT, ".env"))


def _default_output_path(limit):
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return os.path.join(
        _PROJECT_ROOT, "ingredient_management", f"llm_used_ingredients_preview_{limit}_{stamp}.csv"
    )


def _preview_text(text, limit=500):
    text = (text or "").replace("\r\n", "\n").replace("\r", "\n")
    return text[:limit]


def run(*, limit, start_after_id, order, output_path, commit, rpm, concurrency, model, ids=None, pending_only=False, batch_size=8):
    _load_env_files()
    api_key = (os.getenv("GEMINI_API_KEY") or "").strip()
    if not api_key:
        raise SystemExit("GEMINI_API_KEY가 필요합니다 (backend/.env 또는 .env).")

    alias_to_canonical = load_alias_to_canonical()
    extractor = GeminiExtractor(api_key, model=model, rpm=rpm)

    _connect_db, _used_ingredient_token_set = _batch_helpers()
    conn = _connect_db(read_timeout_sec=120)
    cursor = conn.cursor()
    if ids:
        placeholders = ",".join(["%s"] * len(ids))
        cursor.execute(
            f"""
            SELECT id, title, link, platform, used_ingredients, content
            FROM recipes
            WHERE id IN ({placeholders})
            """,
            tuple(ids),
        )
    else:
        order_clause = "id DESC" if order == "recent" else "id ASC"
        conditions = []
        if pending_only:
            conditions.append("llm_ingredients_done = 0")
        if start_after_id:
            conditions.append(f"id > {int(start_after_id)}")
        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        cursor.execute(
            f"""
            SELECT id, title, link, platform, used_ingredients, content
            FROM recipes
            {where_clause}
            ORDER BY {order_clause}
            LIMIT %s
            """,
            (limit,),
        )
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    print(f"대상 {len(rows)}건, model={model}, rpm={rpm}, concurrency={concurrency}, commit={commit}", flush=True)

    fieldnames = [
        "id", "title", "platform", "link", "changed",
        "old_used_ingredients", "new_used_ingredients",
        "added_ingredients", "removed_ingredients",
        "llm_raw_ingredients", "unmapped_ingredients",
        "error", "content_preview",
    ]

    batch_size = max(1, batch_size)
    chunks = [rows[i:i + batch_size] for i in range(0, len(rows), batch_size)]

    def process_chunk(chunk):
        if len(chunk) == 1:
            raw, err = extractor.extract(chunk[0].get("content") or "")
            results = [(raw, err)]
        else:
            raw_list, err_list = extractor.extract_batch([r.get("content") or "" for r in chunk])
            results = list(zip(raw_list, err_list))
        out = []
        for row, (raw, err) in zip(chunk, results):
            new_used, unmapped = normalize_llm_ingredients(raw, alias_to_canonical)
            out.append((row["id"], raw, new_used, unmapped, err))
        return out

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    write_conn = _connect_db(read_timeout_sec=120) if commit else None
    write_cursor = write_conn.cursor() if write_conn else None
    changed_count = 0
    deleted_count = 0
    errors = 0
    # 사전에 없어 버려진 이름 (이름 -> 몇 번). 끝에 한 번에 표로 보낸다.
    recipe_misses = Counter()
    quota_skipped = 0
    done = 0
    since_commit = 0

    # 결과가 완료되는 대로 즉시 CSV에 쓰고(flush) DB에도 바로 반영한다.
    # (한 번에 다 모았다가 마지막에 몰아 쓰면, 중간에 죽었을 때 그동안 처리한 게 전부 날아간다)
    try:
        with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()

            with ThreadPoolExecutor(max_workers=max(1, concurrency)) as pool:
                futures = {pool.submit(process_chunk, chunk): chunk for chunk in chunks}
                for fut in as_completed(futures):
                    chunk = futures[fut]
                    try:
                        chunk_results = fut.result()
                    except Exception as e:  # noqa: BLE001
                        chunk_results = [(row["id"], [], None, [], str(e)) for row in chunk]

                    row_by_id = {row["id"]: row for row in chunk}
                    for rid, raw, new_used, unmapped, err in chunk_results:
                        row = row_by_id[rid]

                        old_used = row.get("used_ingredients")
                        old_was_empty = not bool((old_used or "").strip())
                        new_is_empty = not new_used
                        # 룰베이스(old)와 LLM(new)이 둘 다 "재료 없음"에 동의하면 → 애초에 레시피가
                        # 아닌 본문(홍보 영상 등)일 가능성이 높으므로 행 자체를 삭제한다.
                        # old에는 재료가 있었는데 new만 비어 있는 경우는 "동의"가 아니라 LLM 쪽의
                        # 파싱 실패/이상 응답일 수 있어 삭제하지 않고 검토 대상으로만 남긴다
                        # (기존 값을 그대로 보존 — 위 id=1326 사고와 동일한 패턴이라 신뢰하지 않음).
                        should_delete = (not err) and new_is_empty and old_was_empty
                        suspicious_empty = (not err) and new_is_empty and not old_was_empty
                        if err:
                            changed_label = "ERROR"
                            added, removed = "", ""
                            display_new_used = old_used
                            errors += 1
                            if err == QUOTA_EXHAUSTED_ERR:
                                quota_skipped += 1
                        elif should_delete:
                            changed_label = "DELETED"
                            added, removed = "", ""
                            display_new_used = ""
                        elif suspicious_empty:
                            changed_label = "NEEDS_REVIEW"
                            added, removed = "", ""
                            display_new_used = old_used
                        else:
                            old_set = _used_ingredient_token_set(old_used)
                            new_set = _used_ingredient_token_set(new_used)
                            changed = old_set != new_set
                            if changed:
                                changed_count += 1
                            changed_label = "Y" if changed else "N"
                            added = ",".join(sorted(new_set - old_set))
                            removed = ",".join(sorted(old_set - new_set))
                            display_new_used = new_used

                        writer.writerow({
                            "id": rid,
                            "title": row.get("title"),
                            "platform": row.get("platform"),
                            "link": row.get("link"),
                            "changed": changed_label,
                            "old_used_ingredients": old_used,
                            "new_used_ingredients": display_new_used,
                            "added_ingredients": added,
                            "removed_ingredients": removed,
                            "llm_raw_ingredients": ", ".join(raw),
                            "unmapped_ingredients": ", ".join(unmapped),
                            "error": err or "",
                            "content_preview": _preview_text(row.get("content")),
                        })
                        f.flush()

                        if commit and should_delete:
                            write_cursor.execute("DELETE FROM recipes WHERE id = %s", (rid,))
                            deleted_count += 1
                            since_commit += 1
                        elif commit and not err and suspicious_empty:
                            # 애매해서 값은 안 건드리지만, 계속 재시도 대상으로 남겨두면 무료 한도를
                            # 매일 갉아먹을 수 있어 done=1로 표시해 다음 실행부터는 건너뛴다.
                            # (필요하면 --ids 로 특정 id만 다시 돌릴 수 있음)
                            write_cursor.execute(
                                "UPDATE recipes SET llm_ingredients_done = 1 WHERE id = %s",
                                (rid,),
                            )
                            since_commit += 1
                        elif commit and not err:
                            write_cursor.execute(
                                "UPDATE recipes SET used_ingredients = %s, llm_ingredients_done = 1 WHERE id = %s",
                                (new_used, rid),
                            )
                            # 사전에 없어 버린 이름을 세어 둔다 (끝에 한 번에 저장)
                            recipe_misses.update(unmapped)
                            since_commit += 1
                        # err(일시적 오류)는 llm_ingredients_done을 건드리지 않아
                        # --pending-only 다음 실행에서 자동으로 재시도된다.

                        if commit and since_commit >= 30:
                            # 장시간 배치에서 중간에 죽어도 그동안 처리한 건 DB에 남도록 주기적으로 커밋
                            write_conn.commit()
                            since_commit = 0

                        done += 1
                        if done % 10 == 0 or done == len(rows):
                            print(f"  진행: {done}/{len(rows)} (오류 {errors}건, 마지막 id={rid})", flush=True)

        if commit and since_commit > 0:
            write_conn.commit()
    finally:
        if write_cursor:
            write_cursor.close()
        if write_conn:
            write_conn.close()

    quota_note = f" (그 중 일일 한도 소진으로 건너뜀 {quota_skipped}건)" if quota_skipped else ""
    print(
        f"완료. 처리 {len(rows)}건, 재료 집합 변경 {changed_count}건, "
        f"레시피 아님(삭제) {deleted_count}건, LLM 오류 {errors}건{quota_note}",
        flush=True,
    )
    print(f"미리보기 CSV: {output_path}", flush=True)
    if commit and recipe_misses:
        try:
            kinds = record_recipe_misses(recipe_misses)
            print(
                f"사전에 없던 이름 {kinds}종 / {sum(recipe_misses.values())}회를 "
                f"어드민 '사전' 탭에 올렸습니다.",
                flush=True,
            )
        except Exception as e:  # noqa: BLE001
            # 여기서 실패해도 본작업(used_ingredients)은 이미 끝났다. 막지 않는다.
            print(f"사전 후보 기록 실패(무시): {e}", flush=True)
    if commit:
        print("DB에 반영했습니다 (used_ingredients).", flush=True)
    else:
        print("DB 미반영 (미리보기만). 반영하려면 --commit 을 추가하세요.", flush=True)


# 이름 같지 않은 것은 사전 후보로도 남기지 않는다.
# (backend/app.py 의 사진 인식 쪽과 같은 규칙 — 파싱이 어긋나면 응답 덩어리가
#  이름으로 흘러들어 오고, 한 번 저장되면 사람이 하나씩 지워야 한다)
_NOT_A_NAME = ("{", "}", "[", "]", chr(34), "':")


def _looks_like_name(text):
    text = (text or "").strip()
    return bool(text) and len(text) <= 40 and not any(m in text for m in _NOT_A_NAME)


def record_recipe_misses(counter):
    """레시피 본문에서 뽑혔지만 **사전에 없어 버려진** 이름을 표에 쌓는다.

    왜 남기나:
        지금까지 이 이름들은 미리보기 CSV 에만 있었다. 로컬 파일이라 어드민
        화면에서는 안 보였고, 그래서 "사전에 없던 이름" 목록에는 사진에서 읽힌
        수십 건만 떴다. **물량은 레시피 본문 쪽이 압도적이다**(누적 8만 회 이상).
        정작 고쳐야 할 이름이 화면에 뜨지도 않는 상태였다.

    왜 마지막에 한 번에 쓰나:
        건마다 UPSERT 를 날리면 배치가 그만큼 느려진다. 세어 두었다가 끝에 보낸다.
    """
    items = [(name[:255], n) for name, n in counter.items() if _looks_like_name(name)]
    if not items:
        return 0
    conn = _connect_db(read_timeout_sec=120)
    cursor = conn.cursor()
    try:
        cursor.executemany(
            """
            INSERT INTO ingredient_dictionary_misses
                (raw_name, hit_count, recipe_hits, last_mode, first_seen, last_seen)
            VALUES (%s, 0, %s, 'recipe', NOW(), NOW())
            ON DUPLICATE KEY UPDATE
                recipe_hits = recipe_hits + VALUES(recipe_hits),
                last_seen = NOW()
            """,
            items,
        )
        conn.commit()
    finally:
        cursor.close()
        conn.close()
    return len(items)


def main():
    parser = argparse.ArgumentParser(description="LLM 기반 used_ingredients 재추출 (사전으로 정규화)")
    parser.add_argument("--limit", type=int, default=20, help="처리할 recipes 행 수")
    parser.add_argument("--start-after-id", type=int, default=0, help="이 id보다 큰 행부터 (이어서 처리용)")
    parser.add_argument("--order", choices=["id", "recent"], default="id")
    parser.add_argument("--output", help="CSV 저장 경로")
    parser.add_argument("--commit", action="store_true", help="DB에 실제로 반영 (기본은 미리보기만)")
    parser.add_argument("--rpm", type=int, default=60, help="분당 최대 LLM 호출 수")
    parser.add_argument("--concurrency", type=int, default=4, help="동시 호출 스레드 수")
    parser.add_argument("--model", default="gemini-3.5-flash-lite")
    parser.add_argument("--ids", help="콤마로 구분된 recipe id 목록 (실패한 행만 재시도할 때 사용)")
    parser.add_argument(
        "--pending-only",
        action="store_true",
        help="llm_ingredients_done=0 인 행만 처리 (크롤러가 매일 신규 수집분만 무료 한도 내에서 처리할 때 사용)",
    )
    parser.add_argument(
        "--batch-size", type=int, default=8,
        help="호출 1번에 묶어서 처리할 레시피 수 (일일 호출 횟수 한도를 아끼기 위함, 기본 8)",
    )
    args = parser.parse_args()

    ids = [int(x) for x in args.ids.split(",") if x.strip()] if args.ids else None
    output_path = args.output or _default_output_path(args.limit)
    run(
        limit=args.limit,
        start_after_id=args.start_after_id,
        order=args.order,
        output_path=output_path,
        commit=args.commit,
        rpm=args.rpm,
        concurrency=args.concurrency,
        model=args.model,
        ids=ids,
        pending_only=args.pending_only,
        batch_size=args.batch_size,
    )


if __name__ == "__main__":
    main()
