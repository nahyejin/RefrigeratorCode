"""
사진에서 재료를 인식해 "내 냉장고"에 담을 후보를 돌려준다.

설계 원칙:
- 재료명 정규화는 레시피 쪽과 **같은 사전**을 쓴다
  (frontend/public/ingredient_profile_dict_with_substitutes.csv).
  레시피의 used_ingredients 도 이 사전의 대표어로 저장되므로, 여기서 다른
  기준을 쓰면 인식해서 담아준 재료가 정작 레시피와 매칭되지 않는다.
- LLM 은 "이미지에서 재료 이름을 읽어내는" 것까지만 한다. 사전 매칭은
  결정론적으로 처리해 LLM 이 없는 재료를 지어내는 걸 막는다.
- 인식 결과를 바로 담지 않는다. 호출한 쪽에서 사용자 확인을 받도록
  후보 목록만 돌려준다 (OCR 은 반드시 틀린다).
"""

import base64
import json
import os
import re
from datetime import date, datetime, timedelta

import requests

from ingredient_dictionary import get_alias_to_canonical, resolve_canonical

# 업로드 상한. 폰 원본 사진은 3~5MB 라 프론트에서 줄여서 보내는 걸 전제로 하되,
# 안 줄이고 올려도 서버가 죽지 않도록 여유를 둔다.
MAX_IMAGE_BYTES = 8 * 1024 * 1024

# 여러 장을 한 번에 받는다. 이미지는 base64 로 실려 나가면서 1/3 쯤 커지므로
# 장수와 합계 용량을 함께 제한한다. (여러 장이어도 LLM 호출은 1회다 —
# 한 요청의 parts 에 이미지를 여러 개 넣을 수 있어서, 장수만큼 한도를 쓰지 않는다.)
MAX_IMAGES = 5
MAX_TOTAL_BYTES = 16 * 1024 * 1024

ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}

SUPPORTED_MODES = ("receipt", "food-single", "food-multi", "file")

_OUTPUT_SPEC = """
아래 JSON 객체만 출력해라. 다른 텍스트는 출력하지 마라.
- purchase_date: 영수증의 결제/구매 날짜. YYYY-MM-DD 형식. 안 보이면 null.
- ingredients: 재료 목록. 각 항목은 name / expiry / storage 를 갖는다.
  - expiry: 그 재료에 적힌 유통기한(소비기한). YYYY-MM-DD 형식이고 안 보이면 null.
  - storage: 그 재료를 보통 어디에 두는지. "fridge"(냉장) / "frozen"(냉동) /
    "room"(실온) 중 하나. 한국 가정 기준으로 판단한다.
    예) 우유·두부·나물 = fridge, 냉동만두·아이스크림 = frozen,
        소금·설탕·라면·통조림·양파·감자 = room

예: {"purchase_date": "2026-08-30", "ingredients": [{"name": "물엿", "expiry": null, "storage": "room"}, {"name": "우유", "expiry": "2026-09-05", "storage": "fridge"}]}"""

_RECEIPT_PROMPT = """이 이미지는 마트/슈퍼 영수증이다. 구매한 식재료와 결제 날짜를 뽑아내라.

규칙:
- 식재료가 아닌 항목은 제외한다 (비닐봉투, 종량제봉투, 할인, 포인트, 적립,
  합계, 부가세, 카드번호, 매장명 등).
- 브랜드명, 용량, 수량, 규격, 가격은 빼고 재료 이름만 남긴다.
  예) "CJ 백설 물엿 700g" -> "물엿"
  예) "무항생제 대파 1단" -> "대파"
- 같은 재료가 여러 줄이면 한 번만 적는다.
- 글자가 흐릿해 확신이 없으면 포함하지 않는다.
- 영수증에 찍힌 결제 날짜를 purchase_date 로 적는다. 안 보이면 null.
- 영수증에는 보통 유통기한이 없으므로 expiry 는 대개 null 이다.
- 재료를 하나도 못 찾으면 ingredients 를 빈 배열로 둔다.
""" + _OUTPUT_SPEC

# 사진 두 모드가 공유하는 규칙. 아래 두 프롬프트의 차이는 "몇 개를 뽑을 것인가"
# 하나뿐이므로, 나머지는 한 곳에만 적어 둘이 어긋나지 않게 한다.
_FOOD_COMMON_RULES = """
- 사진에 실제로 보이는 식재료만 적는다. 추측하지 않는다.
- 재료 이름만 적는다. 수량, 상태, 포장 설명은 빼고 순수 재료명만.
  예) "손질된 대파 2대" -> "대파", "국내산 삼겹살 500g" -> "삼겹살"
- 포장된 제품이면 포장지에 적힌 **내용물**을 적는다. 브랜드명은 뺀다.
  예) "서울우유 1L" -> "우유"
- 조리된 완성 요리라면 요리 이름이 아니라 눈에 보이는 재료를 적는다.
  예) 김치찌개 사진 -> "김치", "돼지고기", "두부"
- 포장지에 유통기한/소비기한이 찍혀 있으면 그 재료의 expiry 로 적는다.
  ("2026.09.05 까지" 처럼 적혀 있어도 2026-09-05 로 바꿔 적는다)
- 사진에는 보통 구매 날짜가 없으므로 purchase_date 는 대개 null 이다.
- 확신이 없으면 포함하지 않는다. 재료가 안 보이면 ingredients 를 빈 배열로 둔다."""

# "음식 1개" — 재료 하나를 클로즈업해서 찍는 경우.
# 한 장에 하나만 뽑게 하는 이유: 이 모드를 고른 사용자는 특정 재료 하나를 담으려는
# 것이라, 배경에 걸린 다른 물건(도마 옆 마늘, 식탁 위 과일)까지 담기면 지우는 일이
# 늘어난다. 무엇을 담을지는 사용자가 이미 카메라를 겨눠서 말한 셈이다.
_FOOD_SINGLE_PROMPT = """이 사진들에는 담으려는 식재료가 **한 장에 하나씩** 찍혀 있다.

규칙:
- 사진 한 장당 재료 **하나만** 적는다. 그 사진에서 가장 크게, 가운데에 찍힌 것이다.
- 배경에 우연히 걸린 다른 재료는 적지 않는다.
- 여러 장에 같은 재료가 나오면 한 번만 적는다.""" + _FOOD_COMMON_RULES + """
""" + _OUTPUT_SPEC

# "음식 여러 개" — 장바구니를 펼쳐 놓고 한 번에 찍는 경우.
_FOOD_MULTI_PROMPT = """이 사진들에는 여러 식재료가 함께 놓여 있다. 보이는 것을 모두 뽑아내라.

규칙:
- 사진에 보이는 식재료를 **빠짐없이** 적는다. 가려져 일부만 보이더라도 무엇인지
  분명하면 적는다.
- 같은 재료가 여러 개 보여도 한 번만 적는다 (수량은 세지 않는다).
- 여러 장에 같은 재료가 나와도 한 번만 적는다.
- 식재료가 아닌 물건은 적지 않는다 (그릇, 도마, 칼, 수세미, 행주, 비닐봉투 등).""" + _FOOD_COMMON_RULES + """
""" + _OUTPUT_SPEC

_AUTO_PROMPT = """아래 이미지들은 마트 영수증이거나 식재료 사진이다.
무엇인지 스스로 판단해서, 모든 이미지를 합쳐 담아야 할 식재료 이름만
하나의 목록으로 뽑아라.

영수증이면:
- 식재료가 아닌 항목은 제외한다 (비닐봉투, 종량제봉투, 할인, 적립, 포인트,
  합계, 부가세, 카드번호, 매장명 등).
- 브랜드명, 용량, 수량, 규격, 가격은 빼고 재료 이름만 남긴다.
  예) "CJ 백설 물엿 700g" -> "물엿"

식재료 사진이면:
- 사진에 실제로 보이는 식재료만 적는다. 추측하지 않는다.
- 조리된 완성 요리라면 요리 이름이 아니라 눈에 보이는 재료를 적는다.

공통:
- 여러 이미지에 같은 재료가 나오면 한 번만 적는다.
- 영수증이 있으면 그 결제 날짜를 purchase_date 로 적는다.
- 포장지에 유통기한/소비기한이 보이면 그 재료의 expiry 로 적는다.
- 확신이 없으면 포함하지 않는다. 재료를 못 찾으면 ingredients 를 빈 배열로 둔다.
""" + _OUTPUT_SPEC


_PROMPTS = {
    "receipt": _RECEIPT_PROMPT,
    "food-single": _FOOD_SINGLE_PROMPT,
    "food-multi": _FOOD_MULTI_PROMPT,
    # 앨범/파일에서 고른 사진은 무엇인지 알 수 없으므로 모델이 판단하게 한다.
    "file": _AUTO_PROMPT,
}


def _prompt_for(mode):
    """모드마다 프롬프트가 다르다 — 그래서 화면에서 먼저 무엇을 찍을지 묻는다.

    같은 사진이라도 "영수증에서 산 것을 읽어라" 와 "눈에 보이는 재료를 다 읽어라"
    는 전혀 다른 일이고, "하나만 골라라" 와 "빠짐없이 골라라" 도 결과가 크게
    다르다. 모드를 안 물어보면 이 지시를 못 하고 모델의 짐작에 맡기게 된다.
    """
    return _PROMPTS.get(mode, _RECEIPT_PROMPT)


def _api_key():
    # 챗봇과 같은 방식: 전용 키가 있으면 그걸 쓰고, 없으면 공용 키를 쓴다.
    # (공용 키는 재료 추출 배치와 하루 한도를 나눠 쓰므로 전용 키를 권장)
    return (
        os.getenv("GEMINI_API_KEY_VISION")
        or os.getenv("GEMINI_API_KEY_CHAT")
        or os.getenv("GEMINI_API_KEY")
        or ""
    ).strip()


def _call_gemini_vision(api_key, prompt, images):
    """images: [(bytes, mime_type), ...] — 여러 장이어도 호출은 1회다."""
    model = os.getenv("GEMINI_VISION_MODEL") or os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent?key={api_key}"
    )
    parts = [{"text": prompt}]
    for image_bytes, mime_type in images:
        parts.append({"inline_data": {
            "mime_type": mime_type,
            "data": base64.b64encode(image_bytes).decode(),
        }})
    payload = {
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"},
    }
    res = requests.post(url, json=payload, timeout=60)
    if res.status_code == 429:
        raise QuotaExceeded()
    res.raise_for_status()
    data = res.json()
    # 실제로 몇 토큰을 썼는지 원장에 남기기 위해 흘려 둔다 (usage_quota 참고).
    # 사진 장수도 함께 남긴다 — "사진 2크레딧" 환산이 맞는지 나중에 검증하려면
    # 장수별 토큰이 필요하다.
    try:
        import usage_quota

        usage_quota.note_gemini_usage(data, model=model, images=len(images))
    except Exception:  # noqa: BLE001  (기록 실패가 인식을 막으면 안 된다)
        pass
    parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    return "".join(part.get("text", "") for part in parts)


class QuotaExceeded(Exception):
    """LLM 일일/분당 호출 한도 소진."""


_DATE_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})$")


def _parse_response(text):
    """모델 응답에서 {purchase_date, ingredients:[{name, expiry}]} 를 꺼낸다.

    모델이 옛 형식(이름만 담긴 배열)으로 답해도 받아들인다 — 프롬프트를 바꿔도
    가끔 배열로 돌아오는 경우가 있어, 그때 통째로 실패하지 않도록 한다.
    """
    empty = {"purchase_date": None, "ingredients": []}
    if not text:
        return empty
    cleaned = text.strip()
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", cleaned)
    if fenced:
        cleaned = fenced.group(1).strip()
    data = None
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"[\{\[][\s\S]*[\}\]]", cleaned)
        if match:
            try:
                data = json.loads(match.group(0))
            except json.JSONDecodeError:
                return empty
    if data is None:
        return empty

    if isinstance(data, list):  # 옛 형식: ["물엿", "대파"]
        return {"purchase_date": None,
                "ingredients": [{"name": str(x).strip(), "expiry": None}
                                for x in data if str(x).strip()]}
    if not isinstance(data, dict):
        return empty

    raw_items = data.get("ingredients") or []
    items = []
    for x in raw_items:
        if isinstance(x, dict):
            name = str(x.get("name") or "").strip()
            if name:
                items.append({
                    "name": name,
                    "expiry": x.get("expiry"),
                    "storage": x.get("storage"),
                })
        elif str(x).strip():
            items.append({"name": str(x).strip(), "expiry": None, "storage": None})
    return {"purchase_date": data.get("purchase_date"), "ingredients": items}


def _as_date(value):
    if not value or not isinstance(value, str):
        return None
    m = _DATE_RE.match(value.strip())
    if not m:
        return None
    try:
        return datetime.strptime(value.strip(), "%Y-%m-%d").date()
    except ValueError:
        return None


def _clean_purchase_date(value):
    """구매일자는 미래일 수 없고, 너무 옛날이면 오독으로 본다."""
    parsed = _as_date(value)
    if parsed is None:
        return None
    today = date.today()
    if parsed > today:
        return None
    if parsed < today - timedelta(days=365):
        return None
    return parsed.isoformat()


_STORAGE_VALUES = ("fridge", "frozen", "room")


def _clean_storage(value):
    """모델이 고른 보관함. 이상한 값이면 냉장으로 둔다(가장 무난한 기본값)."""
    v = str(value or "").strip().lower()
    return v if v in _STORAGE_VALUES else "fridge"


def _clean_expiry(value, purchase_date=None):
    """유통기한으로 받아들일 수 있는 값인지 거른다.

    - 과거는 버린다 (이미 지난 걸 담을 리 없다).
    - 10년 뒤도 오독으로 본다.
    - **구매일자와 같거나 그보다 이르면 버린다.** 이게 실제로 문제를 냈다:
      영수증에는 유통기한이 없는데, 모델이 영수증에 큼직하게 찍힌 **거래일시를
      각 재료의 유통기한으로** 적어 보내는 경우가 있다. 그 날짜는 대개 오늘이라
      `parsed < today` 검사를 그냥 통과했고, 그대로 담기면서 방금 넣은 재료가
      "D-day" 나 "지남" 으로 빨갛게 떴다.
      산 날과 같은 날 상하는 식품은 사실상 없으니, 이런 값은 유통기한이 아니라
      날짜를 잘못 읽은 것으로 본다. 버리면 구매일 + 재료 특성으로 짐작한
      값(estimatedExpiry)으로 돌아가므로 손해가 없다.

    purchase_date: 정리된 구매일자(YYYY-MM-DD) 또는 None. None 이면 오늘로 본다
                   (프론트가 구매일자를 오늘로 채우기 때문).
    """
    parsed = _as_date(value)
    if parsed is None:
        return None
    today = date.today()
    if parsed < today:
        return None
    if parsed > today + timedelta(days=3650):
        return None
    floor = _as_date(purchase_date) or today
    if parsed <= floor:
        return None
    return parsed.isoformat()


def recognize(images, mode="receipt"):
    """이미지(여러 장 가능)에서 재료 후보를 뽑아 사전 대표어로 정규화한다.

    images: [(bytes, mime_type), ...]
    반환: {
      "ingredients": [{"name": 대표어, "raw": 인식된 원본 이름}, ...],
      "unmatched":   [사전에 없어서 담을 수 없는 이름, ...],
    }
    """
    if mode not in SUPPORTED_MODES:
        mode = "receipt"
    if not images:
        return {"ingredients": [], "unmatched": []}
    api_key = _api_key()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY가 없습니다.")

    raw_text = _call_gemini_vision(api_key, _prompt_for(mode), images)
    parsed = _parse_response(raw_text)

    alias = get_alias_to_canonical()
    # 유통기한 검사가 구매일자를 봐야 하므로(영수증 거래일시를 유통기한으로
    # 잘못 읽는 경우를 거른다) 구매일자를 먼저 정리한다.
    purchase_date = _clean_purchase_date(parsed["purchase_date"])
    seen = set()
    ingredients = []
    unmatched = []
    for item in parsed["ingredients"]:
        name = item.get("name")
        if not name:
            continue
        expiry = _clean_expiry(item.get("expiry"), purchase_date)
        storage = _clean_storage(item.get("storage"))
        canonical = resolve_canonical(name, alias)
        if not canonical:
            # 사전에 없는 것도 그대로 돌려준다 — 사용자가 화면에서 직접 고쳐 담을 수 있다.
            if not any(u["raw"] == name for u in unmatched):
                unmatched.append({"raw": name, "expiry": expiry, "storage": storage})
            continue
        if canonical in seen:
            continue
        seen.add(canonical)
        ingredients.append({
            "name": canonical, "raw": name, "expiry": expiry, "storage": storage,
        })

    return {
        "ingredients": ingredients,
        "unmatched": unmatched,
        "purchase_date": purchase_date,
    }
