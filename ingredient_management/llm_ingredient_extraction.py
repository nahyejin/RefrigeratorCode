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
    _find_csv as _find_dictionary_csv,
)


# "이 글은 요리를 만드는 글이 아니다" 를 나타내는 표식.
#
# 왜 재료 배열을 비우는 것으로 안 하나: 빈 배열은 **"레시피인데 재료를 못 찾았다"**
# 와 구분이 안 된다. 앞엣것은 지워야 하고 뒤엣것은 남겨 둬야 해서, 둘을 같은
# 값으로 두면 어느 쪽인지 알 수 없다.
NOT_RECIPE = "__NOT_RECIPE__"
# 한 글에 서로 다른 요리가 둘 이상 들어 있는 것. 지우는 것은 같지만,
# **왜 지웠는지**를 로그에서 갈라 봐야 기준이 맞는지 확인할 수 있다.
MULTI_RECIPE = "__MULTI_RECIPE__"

# 제목만으로는 못 가린다. 실측:
#   `김진순 김치 비빔국수 레시피 식당 검증된 황금 양념장` — '식당' 이 들어 있지만
#   진짜 레시피다. 제목 규칙으로 거르면 이런 글이 같이 날아간다.
# 그래서 **본문을 이미 읽고 있는 LLM 에게 같이 물어본다.** 호출은 늘지 않는다.

# 조리 단계를 몇 개까지, 얼마나 길게 받을지.
#
# 왜 자르나: 화면에서 한 번에 읽히고, 소리로 읽어 줄 때 지루하지 않아야 한다.
# 그리고 응답이 길어질수록 한 번에 묶어 보낼 수 있는 본문 수가 줄어든다.
MAX_STEPS = 14
# 분량과 치수를 살려 적으면 한 줄이 길어진다. 120자로 자르면
# "양배추와 오이는 길이 6cm, 두께 0.3cm로 채 썬다" 같은 문장이 잘려 나간다.
MAX_STEP_CHARS = 200
# 분량이 붙은 재료 목록 ("고추장 1과 1/2큰술"). 화면에 그대로 보여 준다.
MAX_DETAIL_ITEMS = 30
MAX_DETAIL_CHARS = 60


def _clean_steps(value):
    """조리 단계 목록을 다듬는다. 리스트가 아니면 빈 목록."""
    if not isinstance(value, list):
        return []
    steps = []
    for x in value:
        text = " ".join(str(x).split())
        if not text:
            continue
        steps.append(text[:MAX_STEP_CHARS])
        if len(steps) >= MAX_STEPS:
            break
    return steps


def _clean_detail(value):
    """분량이 붙은 재료 목록을 다듬는다."""
    if not isinstance(value, list):
        return []
    items = []
    for x in value:
        text = " ".join(str(x).split())
        if not text:
            continue
        items.append(text[:MAX_DETAIL_CHARS])
        if len(items) >= MAX_DETAIL_ITEMS:
            break
    return items


def _as_result(value):
    """모델이 준 한 건의 값을 {ingredients, detail, steps, recipe_name, not_recipe} 로 통일한다.

    값이 세 가지 모양으로 온다:
      - "NOT_RECIPE"                          요리 글이 아님
      - ["돼지고기", "김치"]                   옛 모양 (재료만)
      - {"ingredients": [...], "steps": [...]} 지금 모양

    옛 모양을 계속 받아 주는 이유: 프롬프트를 바꿔도 모델이 가끔 예전처럼 답한다.
    그때 통째로 실패시키면 그 배치 12건이 다 날아간다.
    """
    empty = {"ingredients": [], "detail": [], "steps": [], "recipe_name": "",
             "not_recipe": False, "reason": ""}
    nope = {"ingredients": [], "detail": [], "steps": [], "recipe_name": "",
            "not_recipe": True, "reason": "not_recipe"}
    many = {"ingredients": [], "detail": [], "steps": [], "recipe_name": "",
            "not_recipe": True, "reason": "multi_recipe"}

    def _verdict(token):
        t = str(token).strip().upper()
        if t in ("NOT_RECIPE", NOT_RECIPE):
            return dict(nope)
        if t in ("MULTI_RECIPE", MULTI_RECIPE):
            return dict(many)
        return None

    if isinstance(value, str):
        return _verdict(value) or dict(empty)
    if isinstance(value, list):
        if len(value) == 1:
            v = _verdict(value[0])
            if v:
                return v
        return {"ingredients": [str(x).strip() for x in value if str(x).strip()],
                "detail": [], "steps": [], "recipe_name": "",
                "not_recipe": False, "reason": ""}
    if isinstance(value, dict):
        if str(value.get("not_recipe") or "").strip().upper() in ("TRUE", "1", "YES"):
            return dict(nope)
        if str(value.get("multi_recipe") or "").strip().upper() in ("TRUE", "1", "YES"):
            return dict(many)
        ing = value.get("ingredients")
        if isinstance(ing, str):
            v = _verdict(ing)
            if v:
                return v
        return {
            "ingredients": [str(x).strip() for x in (ing or []) if str(x).strip()],
            "detail": _clean_detail(value.get("ingredients_detail")),
            "steps": _clean_steps(value.get("steps")),
            "recipe_name": " ".join(str(value.get("recipe_name") or "").split())[:100],
            "not_recipe": False,
            "reason": "",
        }
    return dict(empty)


def _extract_json_array(text):
    empty = {"ingredients": [], "detail": [], "steps": [], "recipe_name": "", "not_recipe": False, "reason": ""}
    if not text:
        return empty
    cleaned = text.strip()
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", cleaned)
    if fenced:
        cleaned = fenced.group(1).strip()
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"[\[{][\s\S]*[\]}]", cleaned)
        if not match:
            return empty
        try:
            data = json.loads(match.group(0))
        except json.JSONDecodeError:
            return empty
    return _as_result(data)


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
    return {str(k): _as_result(v) for k, v in data.items()}


PROMPT_TEMPLATE = """너는 레시피 본문에서 **재료와 조리 순서**를 뽑아내는 어시스턴트다.

아래는 블로그/영상 설명에서 가져온 레시피 본문이다.

본문:
{content}

규칙:
- 실제로 이 요리를 만드는 데 쓰이는 재료만 포함한다 (양념/조미료 포함).
- 재료 이름만 적는다. 수량, 단위, 손질법, 괄호 설명은 빼고 순수 재료명만.
- 완성 사진 캡션, 다른 레시피 추천, 광고/구독 유도 문구에서 나온 단어는 재료가 아니면 제외한다.
- 같은 재료가 여러 번 나오면 한 번만 적는다.
- 확신이 없으면 포함하지 않는다. 본문에 재료가 안 보이면 빈 배열을 출력한다.
- **요리를 만드는 글이 아니면** 재료 대신 문자열 "NOT_RECIPE" 를 출력한다.
  요리 글이 아닌 예 — 재료 보관법·손질법, 제품 후기·광고·공구, 맛집·카페 방문기,
  효능·칼로리 정보 글, 식당 메뉴 소개, 일상 브이로그.
  다만 **본문에 실제로 만드는 과정이 있으면** 맛집 이야기나 제품 홍보가 섞여
  있어도 요리 글로 본다. 애매하면 요리 글로 본다(지우는 쪽이 되돌리기 어렵다).
- **한 글에 서로 다른 요리가 둘 이상** 설명돼 있으면 재료 대신 문자열
  "MULTI_RECIPE" 를 출력한다. ("밑반찬 3종", "도시락 반찬 모음", "일주일 반찬"
  처럼 요리마다 재료와 만드는 법이 따로 나오는 글)
  한 요리를 만들면서 곁들임 소스나 밑간을 함께 설명하는 것은 **한 요리로 본다.**
  같은 요리의 변형(매운맛/순한맛)도 한 요리다.

- **재료 상세**(`ingredients_detail`)를 분량과 함께 그대로 적는다.
  예: ["생수제비 250g", "양배추 1컵(60g)", "고추장 1과 1/2큰술", "양조식초 2큰술"]
  본문에 분량이 없으면 이름만 적는다. 양념장이 따로 있으면 그 재료도 모두 포함한다.

- **조리 단계**를 순서대로 뽑는다. 사용자가 이것만 보고 따라 해도 요리가 되도록.
  - 한 단계는 한 가지 행동. 명령형으로 짧게.
  - 인사말·광고·사진 설명·개인 후기는 넣지 않는다.
  - **숫자는 하나도 빠뜨리지 않는다.** 이게 가장 중요하다:
    - 분량 — "고추장 1과 1/2큰술, 식초 2큰술, 설탕 1과 1/2큰술을 섞는다"
      (× "고추장, 식초, 설탕을 섞는다" — 이러면 요리를 못 한다)
    - 시간·불세기 — "중불에서 8분간 끓인다"
    - 크기·두께 — "양배추를 길이 6cm, 두께 0.3cm로 채 썬다"
    - 온도·개수 — "180도에서 굽는다", "달걀 3개를 푼다"
  - 문장만 짧게 다듬고, **정보는 줄이지 않는다.** 애매하면 남기는 쪽으로.
  - 최대 14단계. 본문에 만드는 과정이 없으면 빈 배열.

- **요리명**(`recipe_name`)을 적는다. 블로그 제목 그대로가 아니라, 그 요리를
  부르는 **짧고 깔끔한 음식 이름**만 적는다 (예: "김치찌개", "감자채볶음").
  제목에 붙은 홍보 문구·해시태그·"~레시피"·"~만드는법"·수식어는 뺀다.
  제목이 아니라 **본문 내용을 보고** 실제로 무슨 요리인지 판단해서 적는다.

아래 JSON 객체만 출력해라. 다른 텍스트는 출력하지 마라.
예: {{"recipe_name": "김치찌개", "ingredients": ["돼지고기", "김치", "대파"], "ingredients_detail": ["돼지고기 200g", "신김치 1/4포기", "대파 1대", "고춧가루 1큰술"], "steps": ["김치 1/4포기를 한 입 크기로 썬다", "냄비에 참기름 1큰술을 두르고 김치를 중불에서 3분 볶는다", "물 500ml를 붓고 15분 끓인다"]}}
요리 글이 아니면: "NOT_RECIPE"
요리가 여러 개면: "MULTI_RECIPE"
"""

BATCH_PROMPT_TEMPLATE = """너는 여러 개의 레시피 본문 각각에서 **재료와 조리 순서**를 뽑아내는 어시스턴트다.

아래는 번호가 매겨진 레시피 본문 {n}개다. 각 본문은 서로 다른 레시피이며 완전히 독립적으로 처리해야 한다.

{numbered_bodies}

규칙:
- 각 번호의 재료는 그 번호의 본문에서만 뽑는다 (다른 번호 본문과 절대 섞지 않는다).
- 실제로 그 요리를 만드는 데 쓰이는 재료만 포함한다 (양념/조미료 포함).
- 재료 이름만 적는다. 수량, 단위, 손질법, 괄호 설명은 빼고 순수 재료명만.
- 완성 사진 캡션, 다른 레시피 추천, 광고/구독 유도 문구에서 나온 단어는 재료가 아니면 제외한다.
- 같은 재료가 여러 번 나오면 한 번만 적는다.
- 확신이 없으면 포함하지 않는다. 본문에 재료가 안 보이면 빈 배열을 출력한다.
- **요리를 만드는 글이 아니면** 재료 대신 문자열 "NOT_RECIPE" 를 출력한다.
  요리 글이 아닌 예 — 재료 보관법·손질법, 제품 후기·광고·공구, 맛집·카페 방문기,
  효능·칼로리 정보 글, 식당 메뉴 소개, 일상 브이로그.
  다만 **본문에 실제로 만드는 과정이 있으면** 맛집 이야기나 제품 홍보가 섞여
  있어도 요리 글로 본다. 애매하면 요리 글로 본다(지우는 쪽이 되돌리기 어렵다).
- **한 글에 서로 다른 요리가 둘 이상** 설명돼 있으면 재료 대신 문자열
  "MULTI_RECIPE" 를 출력한다. ("밑반찬 3종", "도시락 반찬 모음", "일주일 반찬"
  처럼 요리마다 재료와 만드는 법이 따로 나오는 글)
  한 요리를 만들면서 곁들임 소스나 밑간을 함께 설명하는 것은 **한 요리로 본다.**
  같은 요리의 변형(매운맛/순한맛)도 한 요리다.
- 반드시 0부터 {n_minus_1}까지 모든 번호에 대해 결과를 포함해야 한다. 하나도 빠뜨리지 마라.

- **재료 상세**(`ingredients_detail`)를 분량과 함께 그대로 적는다.
  예: ["생수제비 250g", "양배추 1컵(60g)", "고추장 1과 1/2큰술", "양조식초 2큰술"]
  본문에 분량이 없으면 이름만 적는다. 양념장이 따로 있으면 그 재료도 모두 포함한다.

- **조리 단계**를 순서대로 뽑는다. 사용자가 이것만 보고 따라 해도 요리가 되도록.
  - 한 단계는 한 가지 행동. 명령형으로 짧게.
  - 인사말·광고·사진 설명·개인 후기는 넣지 않는다.
  - **숫자는 하나도 빠뜨리지 않는다.** 이게 가장 중요하다:
    - 분량 — "고추장 1과 1/2큰술, 식초 2큰술, 설탕 1과 1/2큰술을 섞는다"
      (× "고추장, 식초, 설탕을 섞는다" — 이러면 요리를 못 한다)
    - 시간·불세기 — "중불에서 8분간 끓인다"
    - 크기·두께 — "양배추를 길이 6cm, 두께 0.3cm로 채 썬다"
    - 온도·개수 — "180도에서 굽는다", "달걀 3개를 푼다"
  - 문장만 짧게 다듬고, **정보는 줄이지 않는다.** 애매하면 남기는 쪽으로.
  - 최대 14단계. 본문에 만드는 과정이 없으면 빈 배열.

- **요리명**(`recipe_name`)을 적는다. 블로그 제목 그대로가 아니라, 그 요리를
  부르는 **짧고 깔끔한 음식 이름**만 적는다 (예: "김치찌개", "감자채볶음").
  제목에 붙은 홍보 문구·해시태그·"~레시피"·"~만드는법"·수식어는 뺀다.
  제목이 아니라 **본문 내용을 보고** 실제로 무슨 요리인지 판단해서 적는다.

아래 JSON 객체만 출력해라. key는 번호(문자열), value는 그 본문의 결과 객체. 다른 텍스트는 출력하지 마라.
예: {{"0": {{"recipe_name": "김치찌개", "ingredients": ["돼지고기", "김치"], "ingredients_detail": ["돼지고기 200g", "신김치 1/4포기"], "steps": ["김치 1/4포기를 썬다", "중불에서 3분 볶는다"]}}, "1": "NOT_RECIPE", "2": {{"recipe_name": "대파무침", "ingredients": ["대파"], "ingredients_detail": [], "steps": []}}}}
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

                # 한 건짜리 묶음에서는 모델이 번호 없이 **판정만** 답하기도 한다
                # ("MULTI_RECIPE" 한 줄). 그걸 못 받아서 오류로 처리하면, 정작
                # 지워야 할 글이 그대로 남는다 — 실제로 "일주일 밑반찬 레시피"
                # 같은 글들이 이 구멍으로 살아남고 있었다.
                if n == 1 and not (isinstance(obj, dict) and "0" in obj):
                    token = raw.strip().strip('"').strip().upper()
                    if token in ("NOT_RECIPE", "MULTI_RECIPE"):
                        obj = {"0": token}

                raw_list = []
                err_list = []
                for i in range(n):
                    if str(i) in obj:
                        raw_list.append(obj[str(i)])
                        err_list.append(None)
                    else:
                        raw_list.append({"ingredients": [], "detail": [], "steps": [], "recipe_name": "", "not_recipe": False, "reason": ""})
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
        blank = {"ingredients": [], "detail": [], "steps": [], "recipe_name": "", "not_recipe": False, "reason": ""}
        return [dict(blank) for _ in range(n)], [last_err for _ in range(n)]


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


# 사전 CSV에는 재료 말고 "요리이름"(대분류) 행도 있다 — 인기 급상승 요리
# 랭킹(Popular.tsx)이 키워드+동의어로 이미 쓰고 있던 것과 같은 사전이다.
# ingredient_dictionary.load_alias_to_canonical()은 재료 분류만 골라서
# 이 분류는 애초에 제외하므로, 같은 CSV를 요리이름 분류로만 다시 읽는다.
def load_dish_alias_to_canonical():
    """CSV의 대분류='요리이름' 행에서 (동의어 포함) 이름 -> 대표 요리명 매핑."""
    alias_to_canonical = {}
    with open(_find_dictionary_csv(), encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            keyword = (row.get("keyword") or "").strip()
            if not keyword:
                continue
            if (row.get("대분류") or "").strip() != "요리이름":
                continue
            synonyms_cell = (row.get("synonyms") or "").strip()
            synonyms = synonyms_cell.split(", ") if synonyms_cell else []
            for name in [keyword] + synonyms:
                key = _normalize_key(name)
                if key:
                    alias_to_canonical[key] = keyword
    return alias_to_canonical


def resolve_dish_name(raw_name, dish_alias_to_canonical):
    """LLM이 뽑은 요리명을 "요리이름" 사전으로 정규화한다.

    사전에 있으면 대표 이름으로 통일한다(표기 차이로 같은 요리가 여러
    이름으로 흩어지지 않게, 재료 정규화와 같은 이유). 사전에 없으면 LLM이
    뽑은 원문을 그대로 쓴다 — 사전이 아직 못 담은 요리라고 지워버리기보다는
    화면에 보일 이름 정도는 남겨 두고, 나중에 사전을 넓히는 쪽을 택했다.
    """
    key = _normalize_key(raw_name)
    if not key:
        return raw_name
    return dish_alias_to_canonical.get(key, raw_name)


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
    dish_alias_to_canonical = load_dish_alias_to_canonical()
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
        "id", "title", "recipe_name", "platform", "link", "changed",
        "old_used_ingredients", "new_used_ingredients",
        "added_ingredients", "removed_ingredients",
        "llm_raw_ingredients", "unmapped_ingredients", "cook_steps", "ingredients_detail",
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
        for row, (res, err) in zip(chunk, results):
            res = res if isinstance(res, dict) else _as_result(res)
            # 요리 글이 아니라고 판정된 것은 **사전 정규화에 넣지 않는다.**
            # 넣으면 표식이 "사전에 없는 이름" 으로 쌓인다.
            if res["not_recipe"]:
                # True 대신 **이유**를 싣는다. 빈 문자열은 거짓이라 이 값을
                # 조건으로 쓰는 곳은 그대로 동작하고, 로그에서는 왜 지웠는지가
                # 갈라 보인다 — 기준이 맞는지 확인하려면 그게 필요하다.
                out.append((row["id"], [], "", [], err,
                            res.get("reason") or "not_recipe", [], [], ""))
                continue
            raw = res["ingredients"]
            new_used, unmapped = normalize_llm_ingredients(raw, alias_to_canonical)
            dish_name = resolve_dish_name(res["recipe_name"], dish_alias_to_canonical)
            out.append((row["id"], raw, new_used, unmapped, err, False,
                        res["steps"], res["detail"], dish_name))
        return out

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    write_conn = _connect_db(read_timeout_sec=120) if commit else None
    write_cursor = write_conn.cursor() if write_conn else None
    changed_count = 0
    deleted_count = 0
    multi_count = 0
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
                        chunk_results = [(row["id"], [], None, [], str(e), False, [], [], "") for row in chunk]

                    row_by_id = {row["id"]: row for row in chunk}
                    for rid, raw, new_used, unmapped, err, not_recipe, steps, detail, recipe_name in chunk_results:
                        row = row_by_id[rid]

                        old_used = row.get("used_ingredients")
                        old_was_empty = not bool((old_used or "").strip())
                        new_is_empty = not new_used
                        # 룰베이스(old)와 LLM(new)이 둘 다 "재료 없음"에 동의하면 → 애초에 레시피가
                        # 아닌 본문(홍보 영상 등)일 가능성이 높으므로 행 자체를 삭제한다.
                        # old에는 재료가 있었는데 new만 비어 있는 경우는 "동의"가 아니라 LLM 쪽의
                        # 파싱 실패/이상 응답일 수 있어 삭제하지 않고 검토 대상으로만 남긴다
                        # (기존 값을 그대로 보존 — 위 id=1326 사고와 동일한 패턴이라 신뢰하지 않음).
                        # 재료가 **하나뿐**이면 레시피가 아니라 그 재료에 대한 글이다.
                        #
                        # 표본을 보면 `새송이버섯 보관법`, `밤보관방법`,
                        # `아보카도 오일 활용법`, `CU 신상 후기` 같은 것들이다.
                        # 진짜 레시피인데 추출이 실패해 하나만 남은 경우도 섞이지만
                        # 그래도 지운다 — **재료가 하나면 어차피 매칭에 못 쓰인다**
                        # (재료 3개 이하는 추천에서 빠진다). 남겨 두면 자리만 차지하고
                        # 매일 도는 배치가 계속 다시 훑는다.
                        #
                        # 2개는 건드리지 않는다. `계란 + 소금` 처럼 진짜 간단한
                        # 레시피가 섞여 있어 애매하다.
                        new_count = len([x for x in (new_used or '').split(',') if x.strip()])
                        too_few = (not err) and new_count == 1

                        should_delete = (not err) and (
                            not_recipe or (new_is_empty and old_was_empty) or too_few
                        )
                        suspicious_empty = (not err) and new_is_empty and not old_was_empty
                        if err:
                            changed_label = "ERROR"
                            added, removed = "", ""
                            display_new_used = old_used
                            errors += 1
                            if err == QUOTA_EXHAUSTED_ERR:
                                quota_skipped += 1
                        elif should_delete:
                            changed_label = (
                                ("MULTI_RECIPE" if not_recipe == "multi_recipe" else "NOT_RECIPE")
                                if not_recipe
                                else "DELETED_1ING" if too_few
                                else "DELETED")
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
                            "recipe_name": recipe_name,
                            "platform": row.get("platform"),
                            "link": row.get("link"),
                            "changed": changed_label,
                            "old_used_ingredients": old_used,
                            "new_used_ingredients": display_new_used,
                            "added_ingredients": added,
                            "removed_ingredients": removed,
                            "llm_raw_ingredients": ", ".join(raw),
                            "cook_steps": " | ".join(steps),
                            "ingredients_detail": ", ".join(detail),
                            "unmapped_ingredients": ", ".join(unmapped),
                            "error": err or "",
                            "content_preview": _preview_text(row.get("content")),
                        })
                        f.flush()

                        if should_delete and not_recipe == "multi_recipe":
                            multi_count += 1
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
                            # 조리 단계는 줄바꿈으로 이어 붙여 한 칸에 넣는다.
                            # 별도 표로 빼면 조인이 하나 늘고, 단계는 항상 그
                            # 레시피와 통째로만 쓰이므로 나눌 이유가 없다.
                            # `llm_ingredients_at` 은 **LLM 이 이 행에 값을 썼다**는 표식이다.
                            # `llm_ingredients_done` 과 달리 재처리 예약이 건드리지 않는다 —
                            # 룰베이스 배치는 이 값이 비어 있는 행만 채운다.
                            # (2026-09-05 에 재예약으로 done 이 전부 0 이 된 직후 룰베이스
                            #  전량 재계산이 돌아 9일치 LLM 결과를 덮어쓴 적이 있다)
                            write_cursor.execute(
                                "UPDATE recipes SET used_ingredients = %s, cook_steps = %s, "
                                "ingredients_detail = %s, recipe_name = %s, llm_ingredients_done = 1, "
                                "llm_ingredients_at = NOW() WHERE id = %s",
                                (new_used,
                                 "\n".join(steps) if steps else None,
                                 "\n".join(detail) if detail else None,
                                 recipe_name or None,
                                 rid),
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
        f"레시피 아님(삭제) {deleted_count}건(그 중 요리 여러 개 {multi_count}건), "
        f"LLM 오류 {errors}건{quota_note}",
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
    # `_connect_db` 는 모듈 최상단에 없다 — 무거운 사슬을 늦게 끌어오려고
    # `_batch_helpers()` 안에 감춰 뒀다. 여기서도 같은 길로 가져온다.
    connect, _ = _batch_helpers()
    conn = connect(read_timeout_sec=120)
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
