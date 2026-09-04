"""이번 주 식단을 **LLM 에게 짜 달라고 한다.**

왜 필요한가:
    지금 식단은 매칭률로 줄을 세우고 겹치는 요리를 걸러 내는 규칙일 뿐이다.
    "담백하게", "아이가 먹을 것 위주로", "국물 요리는 빼줘" 같은 말은 규칙으로는
    못 받는다. 사람이 식단을 짤 때 실제로 하는 생각이 그건데.

왜 크레딧을 쓰나:
    LLM 을 실제로 부르기 때문이다. 그리고 이 기능이 **유료로 넘어갈 이유**가 된다 —
    재료 매칭은 한 번 써 보고 마는 기능이지만, 주마다 식단을 다시 짜는 건
    계속 돌아오는 일이다.

무엇을 LLM 에게 맡기고 무엇을 안 맡기나:
    **후보는 우리가 고른다.** 냉장고 재료로 만들 수 있는 레시피를 SQL 로 먼저
    추리고, LLM 에게는 "이 중에서 골라 요일에 배치해라" 만 시킨다.
    레시피를 지어내게 두면 우리 DB 에 없는 요리를 추천하게 되고, 그러면
    조리 순서도 쿠팡 링크도 붙일 수 없다.
"""

import json
import os
import re

import requests

MODEL = os.getenv("GEMINI_MODEL_CHAT") or "gemini-3.5-flash-lite"
API_KEY_ENV = ("GEMINI_API_KEY_CHAT", "GEMINI_API_KEY")

# 한 번에 며칠치를 짜나. 오늘은 이미 지나갔을 수 있으니 **내일부터** 7일이다.
PLAN_DAYS = 7

_PROMPT = """너는 냉장고 사정을 아는 요리 도우미다. 아래 후보 레시피 중에서 골라
{days}일치 식단을 짠다.

[냉장고에 있는 재료]
{have}

[곧 상하는 재료 — 이걸 먼저 쓰는 요리를 앞쪽에 배치한다]
{expiring}

[사용자 요청]
{request}

[이 요청을 이렇게 읽어라]
{hints}

[후보 레시피] (번호 · 제목 · 필요한 재료)
{candidates}

규칙:
- **후보 번호 중에서만 고른다.** 없는 요리를 지어내지 마라.
- {days}개를 고른다. 후보가 모자라면 있는 만큼만.
- **같은 재료가 겹치는 요리를 연달아 두지 마라.** 김치찌개 다음 날 김치볶음밥은
  안 된다. 하루 건너뛰는 것도 피한다.
- 곧 상하는 재료를 쓰는 요리를 **앞쪽 날짜**에 둔다. 상하기 전에 먹어야 한다.
- **`추가 장보기 0개` 인 것을 먼저 고른다.** 이 식단의 값어치는 "몇 개만 사면
  일주일" 에 있다. 0개짜리로 {days}개가 채워지면 그것으로 끝낸다.
  모자랄 때만 숫자가 작은 것부터 더한다.
- 사 와야 하는 재료를 쓰는 요리는 **앞쪽에** 둔다. 사 온 것이 싱싱할 때 먹는다.
- 사용자 요청이 있으면 그것을 **가장 우선한다.** 재료 매칭률보다 우선이다.
  요청과 맞는 후보가 없으면 가장 가까운 것을 고르고 `why` 에 솔직히 적는다.
- 요청을 읽을 때 **제목의 말을 그대로 믿지 말고 요리 자체를 생각해라.**
  - "아이" — 맵고 짠 것, 뼈째 먹는 것, 술안주는 뺀다. 달걀·두부·감자·고기 같은
    부드러운 재료 위주로. 제목에 '아이' 가 없어도 실제로 아이가 먹을 만하면 된다
  - "다이어트" — 튀김·설탕·밀가루가 주인공인 것을 뺀다
  - "담백" — 고춧가루·고추장이 많이 드는 것을 뺀다
  - "간단" — 재료 가짓수가 적고 조리 단계가 짧을 것
  - "손님상/집들이" — 양이 넉넉하고 상에 올려 보기 좋은 것
- **한 글에 요리가 여러 개인 것(반찬 3종 세트 같은 것)은 고르지 마라.**
  그날 무엇을 만들지가 정해지지 않는다.
- `why` 는 **왜 이 날 이걸 고르는지** 한 줄. 20자 안쪽. 광고 문구처럼 쓰지 마라.
- `summary` 는 **이 일곱 개를 왜 이 조합으로 골랐는지** 한두 문장(60자 안쪽).
  사용자가 적은 조건을 어떻게 반영했는지, 어떤 재료를 여러 날에 나눠 쓰는지
  같은 **실제로 판단한 내용**을 적는다. "맛있는 식단이에요" 같은 말은 쓰지 마라.
  예: "아이가 먹기 좋게 맵지 않은 것으로 골랐고, 감자·달걀을 여러 날에 나눠 썼어요."

아래 JSON 객체만 출력해라. 다른 텍스트는 출력하지 마라.
예: {{"summary": "맵지 않은 것으로 고르고 감자를 세 번 나눠 썼어요", "plan": [{{"n": 3, "why": "양파가 이틀 남았어요"}}, {{"n": 11, "why": "재료가 다 있어요"}}]}}
"""


def _api_key():
    for name in API_KEY_ENV:
        key = os.getenv(name)
        if key:
            return key
    raise RuntimeError("GEMINI_API_KEY 가 설정되지 않았습니다.")


def _parse(text):
    """모델 응답에서 `{"plan": [...]}` 를 꺼낸다."""
    if not text:
        return [], ""
    cleaned = text.strip()
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", cleaned)
    if fenced:
        cleaned = fenced.group(1).strip()
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", cleaned)
        if not match:
            return [], ""
        try:
            data = json.loads(match.group(0))
        except json.JSONDecodeError:
            return [], ""
    summary = ""
    if isinstance(data, dict):
        summary = " ".join(str(data.get("summary") or "").split())[:120]
    items = data.get("plan") if isinstance(data, dict) else data
    if not isinstance(items, list):
        return [], summary

    out = []
    for x in items:
        if not isinstance(x, dict):
            continue
        try:
            n = int(x.get("n"))
        except (TypeError, ValueError):
            continue
        why = " ".join(str(x.get("why") or "").split())[:40]
        out.append({"n": n, "why": why})
    return out, summary


def suggest(candidates, have, expiring, request_text="", days=PLAN_DAYS, model=None, hints=None):
    """후보 중에서 골라 식단을 짠다.

    `candidates` 는 `{id, title, ingredients}` 목록. 반환은
    `[{recipe_id, why}, ...]` — 순서가 곧 날짜 순서다.

    응답(`usage`)도 함께 돌려준다. 실제 토큰을 기록해 두어야 나중에
    크레딧 환산이 맞는지 확인할 수 있다.
    """
    if not candidates:
        return [], None, ""

    lines = []
    for i, c in enumerate(candidates):
        ings = ", ".join((c.get("ingredients") or [])[:12])
        # 이 요리를 고르면 장을 **몇 개 더** 봐야 하는지. 모르면 고려할 수 없다.
        extra = c.get("buy_extra")
        cost = f" · 추가 장보기 {extra}개" if isinstance(extra, int) else ""
        lines.append(f"{i}. {c.get('title', '')[:60]}{cost} · {ings}")

    prompt = _PROMPT.format(
        days=days,
        have=", ".join(have[:60]) or "(없음)",
        expiring=", ".join(expiring[:20]) or "(없음)",
        request=(request_text or "").strip()[:300] or "(따로 없음)",
        hints=("\n".join("- " + h for h in hints) if hints else "- (특별한 지침 없음)"),
        candidates="\n".join(lines),
    )

    url = (f"https://generativelanguage.googleapis.com/v1beta/models/"
           f"{model or MODEL}:generateContent")
    res = requests.post(
        url,
        headers={"x-goog-api-key": _api_key(), "Content-Type": "application/json"},
        json={
            "contents": [{"parts": [{"text": prompt}]}],
            # 식단은 매번 똑같으면 "다시 짜기" 가 의미가 없다. 조금 흔들어 준다.
            "generationConfig": {"temperature": 0.7, "maxOutputTokens": 900},
        },
        timeout=45,
    )
    res.raise_for_status()
    data = res.json()
    parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    text = "".join(p.get("text", "") for p in parts)

    picked = []
    seen = set()
    parsed, summary = _parse(text)
    for item in parsed:
        n = item["n"]
        # 모델이 범위 밖 번호를 주면 버린다. 지어낸 요리를 화면에 올리는 것보다
        # 하나 적게 보여 주는 편이 낫다.
        if not (0 <= n < len(candidates)) or n in seen:
            continue
        seen.add(n)
        picked.append({"recipe_id": candidates[n]["id"], "why": item["why"]})
        if len(picked) >= days:
            break

    return picked, data.get("usageMetadata"), summary
