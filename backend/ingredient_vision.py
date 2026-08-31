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
import os
import sys
import threading

import requests

_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _PROJECT_ROOT not in sys.path:
    sys.path.append(_PROJECT_ROOT)

from ingredient_management.llm_ingredient_extraction import (  # noqa: E402
    _extract_json_array,
    _resolve_canonical,
    load_alias_to_canonical,
)

# 업로드 상한. 폰 원본 사진은 3~5MB 라 프론트에서 줄여서 보내는 걸 전제로 하되,
# 안 줄이고 올려도 서버가 죽지 않도록 여유를 둔다.
MAX_IMAGE_BYTES = 8 * 1024 * 1024

ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}

SUPPORTED_MODES = ("receipt", "food-single", "food-multi", "file")

_alias_lock = threading.Lock()
_alias_cache = None


def _alias_to_canonical():
    """사전은 프로세스 수명 동안 한 번만 읽는다 (2,900행 CSV 파싱이 매 요청마다 돌면 느리다)."""
    global _alias_cache
    with _alias_lock:
        if _alias_cache is None:
            _alias_cache = load_alias_to_canonical()
        return _alias_cache


_RECEIPT_PROMPT = """이 이미지는 마트/슈퍼 영수증이다. 구매한 식재료만 뽑아내라.

규칙:
- 식재료가 아닌 항목은 제외한다 (비닐봉투, 종량제봉투, 할인, 포인트, 적립,
  합계, 부가세, 카드번호, 매장명 등).
- 브랜드명, 용량, 수량, 규격, 가격은 빼고 재료 이름만 남긴다.
  예) "CJ 백설 물엿 700g" -> "물엿"
  예) "무항생제 대파 1단" -> "대파"
- 같은 재료가 여러 줄이면 한 번만 적는다.
- 글자가 흐릿해 확신이 없으면 포함하지 않는다.
- 재료를 하나도 못 찾으면 빈 배열을 출력한다.

아래 JSON 배열만 출력해라. 다른 텍스트는 출력하지 마라.
예: ["물엿", "대파", "돼지고기"]"""

_FOOD_PROMPT = """이 사진에 보이는 식재료의 이름을 뽑아내라.

규칙:
- 사진에 실제로 보이는 식재료만 적는다. 추측하지 않는다.
- 재료 이름만 적는다. 수량, 상태, 포장 설명은 빼고 순수 재료명만.
- 조리된 완성 요리라면 요리 이름이 아니라 눈에 보이는 재료를 적는다.
- 같은 재료가 여러 개 보여도 한 번만 적는다.
- 확신이 없으면 포함하지 않는다. 재료가 안 보이면 빈 배열을 출력한다.

아래 JSON 배열만 출력해라. 다른 텍스트는 출력하지 마라.
예: ["양파", "당근", "감자"]"""


def _prompt_for(mode):
    return _RECEIPT_PROMPT if mode == "receipt" else _FOOD_PROMPT


def _api_key():
    # 챗봇과 같은 방식: 전용 키가 있으면 그걸 쓰고, 없으면 공용 키를 쓴다.
    # (공용 키는 재료 추출 배치와 하루 한도를 나눠 쓰므로 전용 키를 권장)
    return (
        os.getenv("GEMINI_API_KEY_VISION")
        or os.getenv("GEMINI_API_KEY_CHAT")
        or os.getenv("GEMINI_API_KEY")
        or ""
    ).strip()


def _call_gemini_vision(api_key, prompt, image_bytes, mime_type):
    model = os.getenv("GEMINI_VISION_MODEL") or os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent?key={api_key}"
    )
    payload = {
        "contents": [{"role": "user", "parts": [
            {"text": prompt},
            {"inline_data": {
                "mime_type": mime_type,
                "data": base64.b64encode(image_bytes).decode(),
            }},
        ]}],
        "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"},
    }
    res = requests.post(url, json=payload, timeout=60)
    if res.status_code == 429:
        raise QuotaExceeded()
    res.raise_for_status()
    data = res.json()
    parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    return "".join(part.get("text", "") for part in parts)


class QuotaExceeded(Exception):
    """LLM 일일/분당 호출 한도 소진."""


def recognize(image_bytes, mime_type, mode="receipt"):
    """이미지에서 재료 후보를 뽑아 사전 대표어로 정규화한다.

    반환: {
      "ingredients": [{"name": 대표어, "raw": 인식된 원본 이름}, ...],
      "unmatched":   [사전에 없어서 담을 수 없는 이름, ...],
    }
    """
    if mode not in SUPPORTED_MODES:
        mode = "receipt"
    api_key = _api_key()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY가 없습니다.")

    raw_text = _call_gemini_vision(api_key, _prompt_for(mode), image_bytes, mime_type)
    names = _extract_json_array(raw_text)

    alias = _alias_to_canonical()
    seen = set()
    ingredients = []
    unmatched = []
    for name in names:
        canonical = _resolve_canonical(name, alias)
        if not canonical:
            if name not in unmatched:
                unmatched.append(name)
            continue
        if canonical in seen:
            continue
        seen.add(canonical)
        ingredients.append({"name": canonical, "raw": name})
    return {"ingredients": ingredients, "unmatched": unmatched}
