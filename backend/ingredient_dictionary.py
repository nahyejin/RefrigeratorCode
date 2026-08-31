"""
재료 사전(대표어 정규화) — 백엔드와 배치가 **함께 쓰는 단 하나의 구현**.

왜 backend/ 에 있나:
  레시피의 `used_ingredients` 도, 사용자가 냉장고에 담는 재료도, 사진에서 인식한
  재료도 전부 같은 기준으로 대표어를 잡아야 한다. 기준이 갈라지면 담아준 재료가
  정작 레시피와 매칭되지 않는다.

  원래는 `ingredient_management/llm_ingredient_extraction.py` 에 있었는데, 그건
  배치 스크립트라 pandas 를 쓰고 다른 배치 모듈까지 끌고 온다. 웹 서버가 그걸
  가져다 쓰려니 배포 환경에서 import 사슬이 끊겨 500/503 이 났다(원인을 로그로
  좁히기도 어려웠다). 그래서 **의존이 가장 적은 곳으로 내리고 표준 라이브러리만
  쓰도록** 옮겼다. 배치 쪽이 이 모듈을 가져다 쓴다.

  ⚠️ 여기 로직을 고치면 레시피 재료·냉장고 재료·사진 인식이 한꺼번에 바뀐다.
     고친 뒤에는 `renormalize_used_ingredients.py` 와
     `migrate_user_ingredients.py` 를 돌려 이미 저장된 값도 맞춰야 한다.
"""

import csv
import os
import re
import threading

_HERE = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.dirname(_HERE)
_CSV_NAME = "ingredient_profile_dict_with_substitutes.csv"

# 사전 파일을 찾을 후보들. 배포 환경에 따라 frontend/ 가 함께 올라가지 않는
# 경우가 있어(chat_service 도 같은 이유로 후보 목록을 쓴다) 여러 곳을 본다.
# INGREDIENT_DICT_CSV 환경변수로 직접 지정할 수도 있다.
def _candidate_paths():
    override = (os.getenv("INGREDIENT_DICT_CSV") or "").strip()
    paths = [override] if override else []
    paths += [
        os.path.join(_PROJECT_ROOT, "frontend", "public", _CSV_NAME),
        os.path.join(_HERE, _CSV_NAME),
        os.path.join(_PROJECT_ROOT, _CSV_NAME),
    ]
    return paths


class DictionaryUnavailable(Exception):
    """재료 사전 CSV 를 어디서도 찾지 못함."""


def _find_csv():
    tried = _candidate_paths()
    for path in tried:
        if path and os.path.exists(path):
            return path
    raise DictionaryUnavailable(
        "재료 사전 CSV 를 찾지 못했습니다. 확인한 경로: " + " | ".join(tried)
    )


INGREDIENT_CSV = os.path.join(_PROJECT_ROOT, "frontend", "public", _CSV_NAME)

# 사전에 담는 것은 실제 재료뿐이다. `요리이름`, `단위`, `TPO` 같은 분류는 제외한다.
_MATERIAL_CATEGORIES = ("재료", "포장/제품")

# 빈칸으로 볼 값들 (예전 pandas 구현이 NaN 으로 처리하던 것과 같은 범위)
_BLANK = {"", "na", "n/a", "null", "none", "nan"}

# 재료명 앞에 붙는 손질/상태 수식어. "다진 생강"은 사전에 없지만 "생강"은 있으므로,
# 사전 조회에 실패하면 이 접두어들을 떼고 한 번 더 조회한다.
#
# 주의: 접두어를 떼면 다른 재료가 되어버리는 말은 넣으면 안 된다.
#   예) "생"을 넣으면 생강 -> 강, 생수 -> 수 처럼 망가진다. 그래서 접두어 목록을
#       보수적으로 두고, 떼어낸 결과가 사전에 실제로 있을 때만 채택한다.
#       ("다진파 -> 파" 처럼 한 글자만 남는 경우도 사전에 있으면 유효하다)
PREP_PREFIXES = (
    "다진", "채썬", "채썰은", "슬라이스", "삶은", "데친", "구운", "볶은", "튀긴",
    "냉동", "냉장", "말린", "불린", "손질", "으깬", "저민", "편썬",
    "고운", "굵은", "잘게", "곱게", "신", "묵은", "건",
)

_cache_lock = threading.Lock()
_cache = None


def normalize_key(name):
    """공백을 없앤 조회용 키. '다진 생강' 과 '다진생강' 을 같게 본다."""
    return re.sub(r"\s+", "", str(name).strip())


def _blank(value):
    return str(value or "").strip().lower() in _BLANK


def load_alias_to_canonical(path=None):
    """사전 CSV에서 (동의어 포함) 이름 -> 대표 keyword 매핑을 만든다.

    LLM 이 전혀 관여하지 않는 순수 결정론적 매핑이다.
    """
    csv_path = path or _find_csv()
    alias_to_canonical = {}

    with open(csv_path, encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            # 예전 사전은 keyword 열 이름이 '1keyword' 였다.
            keyword = row.get("keyword")
            if keyword is None:
                keyword = row.get("1keyword")
            if _blank(keyword):
                continue
            if (row.get("대분류") or "").strip() not in _MATERIAL_CATEGORIES:
                continue

            canonical = str(keyword).strip()
            synonyms_cell = row.get("synonyms")
            synonyms = [] if _blank(synonyms_cell) else str(synonyms_cell).split(", ")
            for name in [canonical] + synonyms:
                key = normalize_key(name)
                if key:
                    alias_to_canonical[key] = canonical

    # 연쇄 해소: 대표어로 지정된 값이 그 자체로 또 다른 대표어의 별칭인 경우가 있다.
    # (예: 볶은참깨 -> 통깨 인데 통깨 -> 참깨) 이대로 두면 같은 재료가 표기에 따라
    # 서로 다른 pill 로 나와 냉장고 매칭이 어긋난다. 끝까지 따라가 최종 대표어로 접는다.
    for key, canonical in list(alias_to_canonical.items()):
        seen = {canonical}
        final = canonical
        while True:
            nxt = alias_to_canonical.get(normalize_key(final))
            if not nxt or nxt == final or nxt in seen:
                break
            final = nxt
            seen.add(final)
        if final != canonical:
            alias_to_canonical[key] = final
    return alias_to_canonical


def get_alias_to_canonical():
    """프로세스 수명 동안 한 번만 읽어 두고 재사용한다 (요청마다 파싱하면 느리다).

    사전 CSV 를 고쳤으면 서버를 다시 띄워야 반영된다.
    """
    global _cache
    with _cache_lock:
        if _cache is None:
            _cache = load_alias_to_canonical()
        return _cache


def token_fallback(name, alias_to_canonical):
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
            candidate = normalize_key("".join(tokens[start:end]))
            if not candidate or candidate not in alias_to_canonical:
                continue
            length = end - start
            if best is None or start > best[0] or (start == best[0] and length > best[1]):
                best = (start, length, alias_to_canonical[candidate])
    return best[2] if best else None


def resolve_canonical(name, alias_to_canonical):
    """사전에서 대표 keyword를 찾는다.

    1) 정확히 일치 → 2) 손질 수식어를 떼고 재시도 → 3) 띄어쓰기 조각으로 재시도.
    어느 단계든 사전에 실제로 있는 결과만 채택한다.
    """
    key = normalize_key(name)
    if not key:
        return None
    canonical = alias_to_canonical.get(key)
    if canonical:
        return canonical

    stripped = key
    while True:
        for prefix in PREP_PREFIXES:
            if stripped.startswith(prefix) and len(stripped) - len(prefix) >= 1:
                stripped = stripped[len(prefix):]
                break
        else:
            break
    if stripped != key:
        canonical = alias_to_canonical.get(stripped)
        if canonical:
            return canonical

    return token_fallback(name, alias_to_canonical)
