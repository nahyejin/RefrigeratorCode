import csv
import json
import os
import re
import threading
from datetime import datetime, timedelta, timezone

import requests
from flask import jsonify

KST = timezone(timedelta(hours=9))
MAX_HISTORY = 10
MAX_INGREDIENTS = 40
SEARCH_LIMIT = 8
FRIDGE_MATCH_FLOOR = 25  # 냉장고 우선 모드에서 키워드 없이도 보여줄 최소 매칭률(%)
MAX_KEYWORDS = 5         # LLM 이 뽑아 주는 검색어 개수 상한

# 관련도 점수 가중치.
#   제목에 있으면 그 글은 그 주제를 다룬 글일 가능성이 높고,
#   본문에 한 번 스친 것은 "안 맵게 하려면" 같은 문장일 수도 있어 가장 낮게 둔다.
W_TITLE, W_INGREDIENT, W_CONTENT = 3, 2, 1
# 관련도 1점 차이를 매칭률 10%p 와 같게 본다.
# (매칭률만 보면 주제와 무관한 글이 올라오고, 관련도만 보면 만들 수 없는 글이 올라온다)
RELEVANCE_WEIGHT = 10
# 같은 요리가 몇 개까지 나올 수 있는지.
#   레시피 글은 같은 요리를 여러 사람이 쓴 경우가 매우 많아서, 관련도와 매칭률이
#   비슷한 것들이 한 요리로 몰린다(실제로 "매운 거" 검색 결과 8건이 전부 감자조림이었음).
#   같은 요리만 늘어서면 "추천" 으로서 값이 없다.
MAX_PER_DISH = 2
# 다양성 필터로 걸러낼 것을 감안해 넉넉히 가져온다
FETCH_MULTIPLIER = 5

# 재료마다 매칭 가중치를 다르게 준다.
#   기존 매칭률은 재료 개수 비율이라 소금·후추도 새우·소고기와 똑같은 가중치를 가져서,
#   조미료 몇 개 없다고 매칭률이 크게 깎이거나(부족 재료로 표시), 반대로 조미료만
#   있어도 매칭률이 올라가는 문제가 있었다.
#   재료 사전(ingredient_profile_dict_with_substitutes.csv)의 대분류=재료 /
#   중분류=양념·조미료 분류를 그대로 써서, 그 카테고리에 속한 재료는 낮은 가중치를,
#   나머지 식재료는 높은 가중치를 준다(_load_seasoning_set 참고).
#   0으로 완전히 빼지 않은 이유: 고추장처럼 요리의 정체성을 결정하는 양념도 이
#   카테고리에 섞여 있어서, 아예 무시하면 "매운 거" 검색이 고추장 매칭에 기대는
#   부분이 깨진다. 낮게만 반영한다.
SEASONING_WEIGHT = 0.3
CORE_WEIGHT = 1.0

# 사용자가 특정 맛/재료/요리명 없이 "그냥 있는 걸로 뭐 해먹을 수 있어?" 식으로
# 넓게 물을 때를 감지한다.
#
# 왜 필요한가: 이런 질문을 LLM에게 그대로 넘기면 keywords 를 비워야 순수 냉장고
# 매칭(match_rate DESC)으로 검색되는데, 모델이 "재료"/"추천" 같은 낱말을 지어내
# keywords 에 채우는 경우가 있었다. keywords 가 하나라도 있으면 `HAVING relevance > 0`
# 이 강제로 걸려서, 그 낱말과 무관한 관련도 필터링이 우선시되고 정작 냉장고 매칭은
# 뒷전으로 밀린다 — "내가 가진 재료를 제대로 모르는 것 같다"는 느낌의 실제 원인.
#
# 이런 광범위한 패턴은 애초에 LLM에게 묻지 않고 서버가 바로 판단해서 keywords 를
# 확정으로 비운다. 부수 효과로 LLM 호출(하루 한도)도 아낀다.
# 범위를 일부러 좁게 잡았다 — 오탐(구체적 요청을 광범위로 오판)이 더 위험하므로,
# 여기 안 걸리는 표현은 그냥 기존처럼 LLM 이 처리한다(기능 후퇴 없음).
_BROAD_FRIDGE_FILLERS = [
    '냉장고에 있는 재료로', '냉장고에 있는 걸로', '냉장고 재료로',
    '지금 있는 재료로', '지금 있는 걸로',
    '있는 재료로', '있는 걸로', '있는거로', '가진 재료로', '가진 걸로',
    '냉장고에', '냉장고', '지금은', '지금', '오늘은', '오늘',
    '그냥', '일단', '음', '아무거나', '아무', '레시피',
]
_BROAD_FRIDGE_RE = re.compile(
    r'^(뭐|뭘)?\s*(해\s*먹|먹|만들|요리)(을|를)?[\s가-힣]{0,10}$'
    r'|^추천[\s가-힣]{0,6}$'
)


def _is_broad_fridge_request(text):
    if not text:
        return False
    normalized = text.strip()
    for filler in _BROAD_FRIDGE_FILLERS:
        normalized = normalized.replace(filler, ' ')
    normalized = re.sub(r'[?!.~ㅠㅜ,]', '', normalized).strip()
    normalized = re.sub(r'\s+', ' ', normalized)
    return bool(_BROAD_FRIDGE_RE.match(normalized))


_rate_lock = threading.Lock()
_rate_day = None
_rate_count = 0
_sessions = {}
_sessions_lock = threading.Lock()


def _today_kst():
    return datetime.now(KST).date().isoformat()


def _daily_limit():
    return int(os.getenv('LLM_DAILY_LIMIT', '250'))


def remaining_quota():
    global _rate_day, _rate_count
    today = _today_kst()
    with _rate_lock:
        if _rate_day != today:
            _rate_day = today
            _rate_count = 0
        return max(0, _daily_limit() - _rate_count)


def _consume_quota():
    global _rate_day, _rate_count
    today = _today_kst()
    with _rate_lock:
        if _rate_day != today:
            _rate_day = today
            _rate_count = 0
        if _rate_count >= _daily_limit():
            return False
        _rate_count += 1
        return True


def _provider_and_key():
    provider = (os.getenv('LLM_PROVIDER') or '').strip().lower()
    # 챗봇 전용 키를 따로 둘 수 있게 한다.
    #
    # 왜 필요한가: 재료 추출 배치와 챗봇이 같은 키를 쓰면 **무료 티어 하루 500회를
    # 나눠 쓰게 된다.** 배치가 하루 450회를 쓰도록 잡혀 있어서 챗봇 몫은 50회뿐이고,
    # 실제로 그게 소진돼 챗봇이 하루 종일 응답하지 못하는 일이 있었다(429).
    # GEMINI_API_KEY_CHAT 을 넣으면 챗봇만 그 키를 쓰고, 없으면 예전처럼 공용 키를 쓴다.
    gemini_key = (os.getenv('GEMINI_API_KEY_CHAT') or os.getenv('GEMINI_API_KEY') or '').strip()
    groq_key = (os.getenv('GROQ_API_KEY_CHAT') or os.getenv('GROQ_API_KEY') or '').strip()
    if provider == 'groq' and groq_key:
        return 'groq', groq_key
    if provider == 'gemini' and gemini_key:
        return 'gemini', gemini_key
    if gemini_key:
        return 'gemini', gemini_key
    if groq_key:
        return 'groq', groq_key
    return None, None


def _extract_json(text):
    if not text:
        return None
    cleaned = text.strip()
    fenced = re.search(r'```(?:json)?\s*([\s\S]*?)```', cleaned)
    if fenced:
        cleaned = fenced.group(1).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r'\{[\s\S]*\}', cleaned)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                return None
    return None


def _call_gemini(api_key, prompt):
    model = os.getenv('GEMINI_MODEL', 'gemini-3.5-flash-lite')
    url = (
        f'https://generativelanguage.googleapis.com/v1beta/models/'
        f'{model}:generateContent?key={api_key}'
    )
    payload = {
        'contents': [{'role': 'user', 'parts': [{'text': prompt}]}],
        'generationConfig': {
            'temperature': 0.4,
            'responseMimeType': 'application/json',
        },
    }
    res = requests.post(url, json=payload, timeout=30)
    res.raise_for_status()
    data = res.json()
    parts = data.get('candidates', [{}])[0].get('content', {}).get('parts', [])
    return ''.join(part.get('text', '') for part in parts)


def _call_groq(api_key, prompt):
    model = os.getenv('GROQ_MODEL', 'llama-3.1-8b-instant')
    res = requests.post(
        'https://api.groq.com/openai/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json={
            'model': model,
            'temperature': 0.4,
            'response_format': {'type': 'json_object'},
            'messages': [
                {'role': 'system', 'content': 'Always reply with valid JSON only.'},
                {'role': 'user', 'content': prompt},
            ],
        },
        timeout=30,
    )
    res.raise_for_status()
    return res.json()['choices'][0]['message']['content']


def _fridge_detail_block(ingredients, expiry_days):
    """답변(reply) 문장에서 재료를 이름으로 부를 때 참고할 우선순위 목록을 만든다.

    규칙(기획 요청): 조미료보다 일반 식재료를 먼저 언급하고, 그중에서는 유통기한이
    임박한 것을 우선한다. 검색 자체(keywords/include/exclude_ingredients)에는 쓰지
    않는다 — 그건 이미 별도 규칙(수정 요청 처리 등)으로 결정되고, 여기 목록은 오직
    "이번 답변에서 어떤 재료를 이름으로 부를지" 고르는 데만 참고자료로 준다.

    정렬 순서: 일반 식재료(유통기한 아는 순 → 짧게 남은 것부터) → 일반 식재료(유통기한
    모름) → 조미료(양념). 조미료를 맨 뒤에 두는 것 자체가 "우선순위 낮음"을 뜻한다.
    """
    if not ingredients:
        return '(아직 냉장고 재료 없음)'

    seasoning_set = _load_seasoning_set()
    core, core_unknown, seasoning = [], [], []
    for name in ingredients[:MAX_INGREDIENTS]:
        days = expiry_days.get(name)
        is_seasoning = name in seasoning_set
        if is_seasoning:
            seasoning.append((name, days))
        elif days is not None:
            core.append((name, days))
        else:
            core_unknown.append((name, days))
    core.sort(key=lambda item: item[1])

    lines = []
    for name, days in core:
        urgent = ' (임박)' if days <= 3 else ''
        lines.append(f'- {name} | 식재료 | D-{days}{urgent}')
    for name, _ in core_unknown:
        lines.append(f'- {name} | 식재료 | 유통기한 정보 없음')
    for name, days in seasoning:
        tag = f'D-{days}' if days is not None else '유통기한 정보 없음'
        lines.append(f'- {name} | 조미료(이름으로 언급 우선순위 낮음) | {tag}')
    return '\n'.join(lines)


def _build_prompt(messages, ingredients, last_turn=None, expiry_days=None):
    history = []
    for msg in messages[-MAX_HISTORY:]:
        role = '사용자' if msg.get('role') == 'user' else '도우미'
        content = (msg.get('content') or '').strip()
        if content:
            history.append(f'{role}: {content}')
    fridge = ', '.join(ingredients[:MAX_INGREDIENTS]) if ingredients else '(아직 냉장고 재료 없음)'
    fridge_detail = _fridge_detail_block(ingredients, expiry_days or {})

    # 직전 턴에 실제로 검색·표시했던 결과를 그대로 근거로 준다.
    #
    # 왜 필요한가: "최근 대화" 텍스트만으로는 직전에 어떤 레시피/재료를 실제로 보여줬는지
    # 알 수 없다 — 도우미의 답변 문장이 항상 구체적인 재료명을 언급하는 건 아니기 때문이다.
    # "너가 준 재료 중에 감자는 빼줘" 처럼 직전 결과를 가리키는 말은, 실제로 그때 검색에
    # 쓴 조건과 화면에 뜬 레시피가 있어야 정확히 해석할 수 있다. 세션(대화창)별로 직전
    # 검색 결과를 서버가 기억해 뒀다가 여기에 그대로 다시 넣어준다.
    if last_turn and (last_turn.get('recipes') or last_turn.get('keywords')
                       or last_turn.get('include_ingredients') or last_turn.get('exclude_ingredients')):
        recipe_lines = [
            f"{i}. {r.get('title') or '(제목 없음)'} (재료: {r.get('used_ingredients') or '정보 없음'})"
            for i, r in enumerate(last_turn.get('recipes') or [], 1)
        ]
        last_turn_block = f"""
직전 검색 결과 (사용자가 "너가 준 재료", "방금 그 레시피들" 이라고 말하면 이걸 가리키는 것이다):
- 그때 쓴 검색어: {last_turn.get('keywords') or []}
- 그때 꼭 포함시킨 재료: {last_turn.get('include_ingredients') or []}
- 그때 제외한 재료: {last_turn.get('exclude_ingredients') or []}
- 그때 실제로 보여준 레시피:
{chr(10).join(recipe_lines) if recipe_lines else '(없음)'}
"""
    else:
        last_turn_block = '\n직전 검색 결과: (없음 — 지금이 이 대화의 첫 검색이다)\n'

    return f"""너는 쿡매치 앱의 요리 도우미다.
사용자는 냉장고 재료로 뭘 해먹을지 채팅으로 묻는다.
레시피 링크를 만들지 마라. 없는 글 제목을 지어내지 마라.
검색은 서버가 우리 DB에서 한다. 너는 검색에 쓸 낱말만 고른다.
DB 검색은 글자가 그대로 들어 있는지만 보기 때문에, 사용자가 쓴 말 하나만으로는
같은 뜻의 다른 표현이 쓰인 글을 놓친다. 그래서 비슷한 말을 함께 골라 줘야 한다.

기본적으로는 사용자가 지금 냉장고에 가진 재료를 최대한 활용하는 레시피를 우선해서 찾는다.
다만 사용자가 "재료 상관없이", "냉장고에 없어도", "그냥 맛있는 걸로" 처럼
보유 재료를 무시해도 된다고 명시적으로 말하면 ignore_fridge를 true로 설정한다.
그 외에는 항상 ignore_fridge를 false로 둔다.

너는 오직 이 대화방 안에서 요리/재료/레시피에 대해서만 판단한다. 요리와 무관한 잡담이나
다른 화제로 새지 마라 — 사용자가 엉뚱한 걸 물어도 요리 도우미로서만 답하면 된다.

아래 "직전 검색 결과"가 있으면, 새 메시지가 그 결과에 대한 **수정 요청**인지부터 판단해라.
"그중에 A는 빼줘", "B도 꼭 들어간 걸로", "더 매운/간단한 걸로", "그거 말고 다른 거" 처럼
직전 결과를 전제로 한 말이면 수정 요청이다. 이때는:
  - 직전 검색어/포함재료/제외재료를 기본값으로 이어받고, 이번 메시지에서 말한 변경사항만
    반영해라(A를 exclude_ingredients에 추가, B를 include_ingredients에 추가하는 식). A, B는
    반드시 직전 결과나 냉장고 재료에 실제로 있는 이름으로 판단해라.
  - **사용자가 명시적으로 말하지 않은 재료를 include_ingredients에 새로 채워 넣지 마라.**
    예를 들어 "감자만 빼줘"는 감자를 exclude_ingredients에 넣으라는 뜻이지, 냉장고에 남은
    다른 재료를 전부 include_ingredients에 넣어 "이 재료들이 전부 들어간 레시피만" 찾으라는
    뜻이 아니다. 그렇게 하면 조건이 너무 좁아져 검색 결과가 0건이 되기 쉽다. include는
    사용자가 "꼭 넣어줘/포함해줘" 처럼 명시적으로 요구한 재료에만 써라.
  - reply는 "취향을 반영해 찾아볼게요" 같은 정해진 문구를 반복하지 말고, 이번에 실제로
    뭘 바꿔서 다시 찾는지 짧게 확인해주는 자연스러운 톤으로 써라(예: "감자는 빼고 다시
    찾아볼게요!"). 직전 답변을 그대로 되풀이하지 마라.
사용자의 새 메시지가 직전 결과와 무관한 새로운 주제(다른 요리, 다른 상황 등)면 수정 요청이
아니다 — 이전 조건에 얽매이지 말고 이번 메시지만 기준으로 새로 판단해라.
**주의**: "직전 검색 결과"가 없다면 — 즉 지금이 대화의 첫 검색이라면 — 위 수정 규칙은 해당
없다. 존재하지 않는 이전 요청을 상상하지 말고 그냥 새 요청으로 봐라. 이때 reply는 취향을
반영해 찾아보겠다는 톤으로 써도 된다.

reply 문장에서 냉장고 재료를 구체적인 이름으로 언급할 때는(예: "감자, 양파로 만들 수 있는
요리를 찾아볼게요") 아래 "냉장고 재료 상세" 목록만 참고해서 골라라. 이 목록은 오직 reply의
문구를 정할 때만 쓰고, keywords/include_ingredients/exclude_ingredients 판단에는 영향을
주면 안 된다(그건 위 규칙대로만 정해라):
  1) 목록에 "조미료"로 표시된 재료보다 "식재료"로 표시된 것을 먼저 언급해라. 조미료는 그
     요리의 핵심 재료가 아닌 이상 이름으로 부르지 마라.
  2) 식재료 중에서는 목록 순서(유통기한이 짧게 남은 것부터)를 우선으로 언급해라.
  3) 다만 사용자가 이번 메시지에서 구체적인 목표나 조건을 말했다면(예: "다이어트식
     추천해줘", "매운 거", 특정 재료를 콕 집어 말한 경우 등) 그 조건에 맞는 재료를 먼저
     고르고, 유통기한 임박 재료를 억지로 끼워 넣지 마라 — 그 경우 유통기한은 무시해도 된다.
  4) **유통기한 임박이 실제로 이번 답변에서 재료를 고르는 데 결정적이었다면** (사용자가
     특별히 요청하지 않았는데 유통기한 때문에 그 재료를 우선 언급했다면) reply 끝에 그
     사실을 한 문장으로 짧게 밝혀라(예: "유통기한이 임박한 두부를 먼저 고려해서
     답변드렸어요."). 그래야 사용자가 원치 않으면 "유통기한 신경 쓰지 말고 답해줘" 처럼
     바로 되물을 수 있다. 실제로 영향을 주지 않았다면(사용자 요청이 우선이었거나, 애초에
     임박한 재료가 없었다면) 이 문구를 넣지 마라 — 사실이 아닌 걸 습관적으로 붙이지 마라.

냉장고 재료: {fridge}

냉장고 재료 상세 (reply에서 재료 이름을 고를 때만 참고 — 검색 조건 판단에는 쓰지 말 것):
{fridge_detail}
{last_turn_block}
최근 대화:
{chr(10).join(history) if history else '(없음)'}

아래 JSON만 출력해라.
{{
  "reply": "사용자에게 할 말. 2~4문장. 친근한 한국어. 링크/URL 금지. 구체적인 레시피 제목을 단정하지 말 것. 새 검색이면 취향을 반영해 찾아보겠다는 톤, 수정 요청이면 무엇을 바꿔 다시 찾는지 확인해주는 톤. 재료를 이름으로 부를 때는 위 '냉장고 재료 상세' 우선순위 규칙을 따를 것.",
  "keywords": ["검색용 한국어 낱말 1~5개. **첫 번째가 가장 중요한 말**. 사용자가 쓴 표현 그대로만 넣지 말고, 같은 뜻으로 글에 쓰일 만한 말을 함께 넣어라. 예: '매운 거' -> [\"매운\", \"매콤\", \"얼큰\", \"칼칼\", \"청양고추\"], '국물' -> [\"국물\", \"찌개\", \"탕\", \"전골\"]. 요리 이름이면 그 이름과 흔한 표기를 넣어라. 해당 없으면 빈 배열"],
  "include_ingredients": ["사용자가 명시적으로 꼭 넣어달라고 한 재료만. 해당 없으면 빈 배열"],
  "exclude_ingredients": ["빼고 싶은 재료"],
  "ignore_fridge": false
}}
"""


def _search_recipes(get_db, keywords, include_ingredients, exclude_ingredients, my_ingredients, ignore_fridge=False):
    """대화에서 뽑은 낱말과 냉장고 재료로 레시피를 찾는다.

    예전 방식의 문제 (실측으로 확인):
      냉장고에 재료가 있으면 정렬이 `match_rate DESC` 뿐이었고,
      키워드는 `HAVING (match_rate >= 25 OR 키워드일치)` 의 **OR 조건**이었다.
      그런데 매칭률 25% 이상인 레시피가 13,869건이라 사실상 전부 통과했고,
      정렬에 키워드가 들어가지 않아 "매운 거" 라고 말하든 말든 결과가 거의 같았다.
      실제로 "매운" 으로 검색했을 때 상위 8건 중 1건만 매운 것과 관련이 있었다.

    바뀐 방식:
      1) 키워드가 있으면 **관련도 0인 글은 제외**한다 (OR 조건이 아니라 필수 조건)
      2) 어디에서 걸렸는지에 따라 점수를 다르게 준다 (제목 3 / 재료 2 / 본문 1)
      3) 정렬은 `관련도 * 10 + 매칭률` — 주제가 맞으면서 만들 수 있는 것이 위로 온다

    본문(content)은 평균 2,000자라 LIKE 비용이 크다(실측: 5개 낱말 전부 본문까지 보면 4.9초).
    그래서 **첫 번째 낱말만 본문까지** 보고 나머지는 제목·재료에서만 찾는다
    (실측: 제목·재료만 5개 = 0.32초). 첫 낱말이 가장 중요한 말이므로 손해가 적다.
    """
    keywords = [k.strip() for k in (keywords or []) if k and k.strip()][:MAX_KEYWORDS]

    db = get_db()
    cursor = db.cursor()
    try:
        where = ['1=1']
        where_params = []

        for ing in include_ingredients[:8]:
            where.append("FIND_IN_SET(%s, REPLACE(used_ingredients,' ','')) > 0")
            where_params.append(ing)

        for ing in exclude_ingredients[:8]:
            where.append("FIND_IN_SET(%s, REPLACE(used_ingredients,' ','')) = 0")
            where_params.append(ing)

        # ── 관련도 점수
        relevance_parts = []
        relevance_params = []
        for i, kw in enumerate(keywords):
            like = f'%{kw}%'
            relevance_parts.append(f"(CASE WHEN title LIKE %s THEN {W_TITLE} ELSE 0 END)")
            relevance_params.append(like)
            relevance_parts.append(f"(CASE WHEN used_ingredients LIKE %s THEN {W_INGREDIENT} ELSE 0 END)")
            relevance_params.append(like)
            if i == 0:
                relevance_parts.append(f"(CASE WHEN content LIKE %s THEN {W_CONTENT} ELSE 0 END)")
                relevance_params.append(like)
        relevance = ' + '.join(relevance_parts) if relevance_parts else '0'

        # ── 냉장고 재료 매칭률 (재료별 가중치 적용)
        seasoning_set = _load_seasoning_set()

        # 콤마로 앞뒤를 감싸서(",a,b,") 조미료만 정확히 지운 문자열을 만든다 —
        # 부분 문자열로 다른 재료 이름 일부가 잘리는 일이 없게. 사전 값은 고정
        # 상수(사용자 입력 아님)라 SQL에 직접 넣어도 인젝션 위험이 없다.
        seasoning_free = "CONCAT(',', REPLACE(used_ingredients,' ',''), ',')"
        for _seasoning in seasoning_set:
            _quoted = "'" + _seasoning.replace("\\", "\\\\").replace("'", "\\'") + "'"
            seasoning_free = f"REPLACE({seasoning_free}, CONCAT(',', {_quoted}, ','), ',')"

        fridge = [] if ignore_fridge else [i for i in my_ingredients if i][:20]
        if fridge:
            match_parts = [
                f"(CASE WHEN FIND_IN_SET(%s, REPLACE(used_ingredients,' ','')) > 0 "
                f"THEN {SEASONING_WEIGHT if ing in seasoning_set else CORE_WEIGHT} ELSE 0 END)"
                for ing in fridge
            ]
            match_params = fridge[:]

            # 레시피 전체 재료 개수(가중치 없음)
            total_ing = """
              CASE WHEN used_ingredients IS NULL OR used_ingredients=''
                   THEN 0
                   ELSE LENGTH(REPLACE(used_ingredients,' ',''))
                        - LENGTH(REPLACE(REPLACE(used_ingredients,' ',''),',',''))  + 1
              END
            """
            # 그중 조미료가 아닌 것의 개수 (조미료만 지운 문자열의 항목 수.
            # 콤마로 감쌌으므로 항목 수 = 콤마 개수 - 1, 양 끝에 콤마가 하나씩 더 있음)
            non_seasoning_count = f"""
              CASE WHEN used_ingredients IS NULL OR used_ingredients=''
                        OR {seasoning_free} = ',,'
                   THEN 0
                   ELSE LENGTH({seasoning_free})
                        - LENGTH(REPLACE({seasoning_free}, ',', '')) - 1
              END
            """
            # 가중치 적용 분모 = 조미료 아닌 개수*CORE_WEIGHT + 조미료 개수*SEASONING_WEIGHT
            #                = 전체*SEASONING_WEIGHT + (조미료 아닌 개수)*(CORE_WEIGHT - SEASONING_WEIGHT)
            weighted_total = (
                f"(({total_ing}) * {SEASONING_WEIGHT} "
                f"+ ({non_seasoning_count}) * {CORE_WEIGHT - SEASONING_WEIGHT})"
            )
            match_rate = (
                f"CASE WHEN ({weighted_total}) = 0 THEN 0 "
                f"ELSE ROUND(({' + '.join(match_parts)})/({weighted_total})*100) END"
            )
        else:
            match_rate = '0'
            match_params = []

        # ── 걸러내기 / 정렬
        having_parts = []
        if keywords:
            # 키워드가 있으면 주제가 안 맞는 글은 아예 빼야 한다.
            # (예전에는 OR 조건이라 매칭률만 높으면 통과했고, 그래서 엉뚱한 결과가 나왔다)
            having_parts.append('relevance > 0')
        elif fridge:
            having_parts.append(f'match_rate >= {FRIDGE_MATCH_FLOOR}')
        having_sql = f"HAVING ({' AND '.join(having_parts)})" if having_parts else ''

        if keywords and fridge:
            order_by = f'(relevance * {RELEVANCE_WEIGHT} + match_rate) DESC, post_time DESC'
        elif keywords:
            order_by = 'relevance DESC, post_time DESC'
        elif fridge:
            order_by = 'match_rate DESC, post_time DESC'
        else:
            order_by = 'post_time DESC'

        sql = f"""
            SELECT id, title, thumbnail, platform, likes, comments, hits,
                   post_time, used_ingredients, link,
                   ({relevance}) AS relevance,
                   {match_rate} AS match_rate
            FROM recipes
            WHERE {' AND '.join(where)}
            {having_sql}
            ORDER BY {order_by}
            LIMIT %s
        """
        # 다양성 필터로 걸러낼 몫까지 감안해 넉넉히 가져온다.
        # (WHERE/HAVING 스캔이 비용의 대부분이라 LIMIT 을 늘려도 거의 차이 없음)
        params = relevance_params + match_params + where_params + [SEARCH_LIMIT * FETCH_MULTIPLIER]
        cursor.execute(sql, params)

        rows = cursor.fetchall() or []
        recipes = []
        for row in rows:
            link = (row.get('link') or '').strip()
            if not link:
                continue
            recipes.append({
                'id': row.get('id'),
                'title': row.get('title') or '',
                'thumbnail': row.get('thumbnail') or '',
                'platform': row.get('platform') or '',
                'link': link,
                'match_rate': int(row.get('match_rate') or 0),
                'used_ingredients': row.get('used_ingredients') or '',
            })
        # 같은 요리가 화면을 다 채우지 않도록 추린다
        return _diversify(recipes, SEARCH_LIMIT)
    finally:
        db.close()


_dish_names = None


def _load_dish_names():
    """재료 사전에서 `대분류 = 요리이름` 인 낱말만 뽑아 둔다 (994개).

    제목에서 "무슨 요리인지" 를 알아내는 데 쓴다. 레시피 제목은
    `매운 감자조림 만드는법 고기없이도 짱맛! 고추장 양념 정호영 감자조림 레시피` 처럼
    검색어가 잔뜩 붙어 있어서, 사전 없이 글자만 비교하면 같은 요리를 골라내기 어렵다.

    파일을 못 찾아도 검색이 멈추면 안 되므로, 그때는 빈 목록을 쓰고
    다양성 필터만 동작하지 않게 한다.
    """
    global _dish_names
    if _dish_names is not None:
        return _dish_names

    here = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(here, '..', 'frontend', 'public', 'ingredient_profile_dict_with_substitutes.csv'),
        os.path.join(here, 'ingredient_profile_dict_with_substitutes.csv'),
    ]
    names = []
    for path in candidates:
        try:
            with open(path, encoding='utf-8-sig') as f:
                for row in csv.DictReader(f):
                    if (row.get('대분류') or '').strip() == '요리이름':
                        kw = (row.get('keyword') or '').strip()
                        if len(kw) >= 2:
                            names.append(kw)
            if names:
                break
        except (OSError, csv.Error):
            continue

    # 긴 이름부터 찾아야 `감자조림` 을 `조림` 으로 잘못 잡지 않는다
    names.sort(key=len, reverse=True)
    _dish_names = names
    if not names:
        print('[chat] 요리명 사전을 찾지 못했습니다 — 결과 다양성 필터를 건너뜁니다.')
    return _dish_names


def _load_seasoning_set():
    """매칭률 계산에서 낮은 가중치(SEASONING_WEIGHT)를 줄 조미료 목록.

    재료 사전(`ingredient_profile_dict_with_substitutes.csv`)에는 `대분류=재료,
    중분류=양념/조미료` 로 분류된 낱말이 287개 있다 — 이 프로젝트가 이미 갖고 있는
    "정식" 분류라 처음엔 이걸 그대로 썼다.

    **실측 결과 SQL에 못 썼다.** 냉장고 우선 검색(키워드 없이 재료만으로 찾는 경우)은
    조건절로 좁혀지지 않아 recipes 테이블 대부분을 훑는데, 그 각 행마다 287개 낱말을
    대조하는 연산(REPLACE 체인이든 FIND_IN_SET 합산이든 방식은 무관 — 둘 다 실측)이
    행 수 × 287번 실행돼 응답이 25~27초까지 걸렸다(정상은 2초 안팎). 10~20개 수준까지
    줄이면 2~3초대로 돌아온다 — 즉 "몇 개짜리 목록이냐" 자체가 성능을 좌우한다.

    그래서 여기서는 사전 대신, 실측으로 성능이 확인된 크기의 목록을 직접 골라 쓴다.
    이 목록은 프론트(`frontend/src/utils/recipeUtils.ts`)의 SEASONING_WEIGHTS 와
    **같은 재료로 맞춰야** 앱 전체에서 매칭률이 같은 기준으로 보인다 — 둘 중 하나만
    고치면 챗봇과 냉장고요리/요즘인기 화면의 매칭률이 서로 달라진다.

    287개 전체를 실시간 쿼리에 쓰려면 이 계산을 recipes 테이블에 미리 컬럼으로
    저장해 두는 방식(배치로 한 번 계산 후 DB에 반영)으로 바꿔야 한다 — 지금은
    범위 밖으로 남겨둔다.
    """
    return {
        '소금', '후추', '설탕', '식용유', '참기름', '들기름', '맛술', '미림',
        '식초', '물', '간장', '올리고당', '굴소스', '다시다', '미원',
    }


def _dish_key(title):
    """제목에서 요리 이름 하나를 찾아 낸다. 못 찾으면 None(= 각자 다른 요리로 취급)."""
    for name in _load_dish_names():
        if name in title:
            return name
    return None


def _diversify(recipes, limit):
    """같은 요리가 `MAX_PER_DISH` 개를 넘지 않도록 추린다.

    순서는 그대로 두고 넘치는 것만 뒤로 미룬다. 그렇게 하고도 개수가 모자라면
    미뤄 둔 것들로 채운다 — 결과가 줄어드는 것보다는 겹치더라도 채우는 편이 낫다.
    """
    picked, spare, seen = [], [], {}
    for r in recipes:
        key = _dish_key(r.get('title') or '')
        if key is None:
            picked.append(r)
        elif seen.get(key, 0) < MAX_PER_DISH:
            seen[key] = seen.get(key, 0) + 1
            picked.append(r)
        else:
            spare.append(r)
        if len(picked) >= limit:
            break
    if len(picked) < limit:
        picked.extend(spare[:limit - len(picked)])
    return picked[:limit]


def _top_matched_ingredients(recipes, my_ingredients, exclude_ingredients=None, limit=3):
    """검색 결과 상위권에 실제로 겹친 보유 재료를 추려 답변에 밝힐 때 쓴다.

    "냉장고 재료를 반영했다"는 게 말뿐이 아니라는 걸 사용자가 확인할 수 있게,
    어떤 재료를 근거로 골랐는지 답변에 넣기 위한 재료다. 등장 빈도가 높은 재료를
    먼저 두고, 빈도가 같으면 사용자가 냉장고에 등록한 순서(먼저 넣었으면 더
    중요하게 여겼을 가능성)를 따른다.

    exclude_ingredients 는 방금 사용자가 "빼달라"고 한 재료다. LLM이 검색 조건에서
    빼지 못했더라도(예: SQL은 안 걸렀는데 우연히 결과에 남은 경우), 방금 빼달라고
    한 재료를 "이 재료 위주로 골랐다"고 다시 언급하면 앞뒤가 안 맞아 보이므로
    집계 대상에서도 함께 제외한다.
    """
    if not recipes or not my_ingredients:
        return []
    excluded = {e.strip() for e in (exclude_ingredients or []) if e.strip()}
    my_order = {name: i for i, name in enumerate(my_ingredients) if name not in excluded}
    counts = {}
    for r in recipes:
        used = {tok.strip() for tok in (r.get('used_ingredients') or '').split(',') if tok.strip()}
        for name in used:
            if name in my_order:
                counts[name] = counts.get(name, 0) + 1
    ranked = sorted(counts.items(), key=lambda kv: (-kv[1], my_order[kv[0]]))
    return [name for name, _ in ranked[:limit]]


def _get_last_turn(session_id):
    """이 대화창(session_id)에서 직전에 실제로 검색·표시했던 결과를 가져온다.

    프론트가 매번 메시지 텍스트만 보내고 레시피 데이터는 다시 보내지 않기 때문에
    (recipes는 화면 표시용일 뿐 다음 /api/chat 요청에 포함되지 않는다), 팔로우업
    질문("너가 준 재료 중에 감자는 빼줘")이 정확히 무엇을 가리키는지 서버가 직접
    기억해 뒀다가 다음 프롬프트에 근거로 넣어줘야 한다.
    """
    if not session_id:
        return None
    with _sessions_lock:
        entry = _sessions.get(session_id)
        return entry.get('last_turn') if entry else None


def _remember(session_id, messages, last_turn=None):
    if not session_id:
        return
    with _sessions_lock:
        _sessions[session_id] = {
            'messages': messages[-MAX_HISTORY:],
            'updated': datetime.now(KST).isoformat(),
            'last_turn': last_turn,
        }
        if len(_sessions) > 200:
            oldest = sorted(_sessions.items(), key=lambda item: item[1].get('updated') or '')[:50]
            for key, _ in oldest:
                _sessions.pop(key, None)


def handle_chat(get_db):
    from flask import request

    body = request.get_json(silent=True) or {}
    messages = body.get('messages') or []
    ingredients = [
        str(name).strip()
        for name in (body.get('ingredients') or [])
        if str(name).strip()
    ][:MAX_INGREDIENTS]
    session_id = (body.get('session_id') or '').strip()

    # 재료별 유통기한(D-day). reply 문장에서 어떤 재료를 이름으로 부를지 정할 때만 쓴다
    # (검색 조건에는 안 씀 — _fridge_detail_block 참고). 형식이 이상한 항목은 조용히 건너뛴다.
    expiry_days = {}
    for item in (body.get('ingredient_expiry') or []):
        if not isinstance(item, dict):
            continue
        name = str(item.get('name') or '').strip()
        try:
            days = int(item.get('days_left'))
        except (TypeError, ValueError):
            continue
        if name:
            expiry_days[name] = days

    if not messages or not any(m.get('role') == 'user' and (m.get('content') or '').strip() for m in messages):
        return jsonify({'error': '메시지를 입력해 주세요.'}), 400

    last_user = ''
    for msg in reversed(messages):
        if msg.get('role') == 'user':
            last_user = (msg.get('content') or '').strip()
            break

    provider, api_key = _provider_and_key()
    if not provider:
        return jsonify({
            'error': 'LLM 키가 없습니다. backend .env에 GEMINI_API_KEY 또는 GROQ_API_KEY를 넣어 주세요.',
        }), 503

    # "그냥 있는 걸로 뭐 해먹을 수 있어?" 식 광범위한 질문은 LLM에게 묻지 않고
    # 서버가 바로 keywords=[] 로 확정한다 (자세한 이유는 _is_broad_fridge_request 주석 참고).
    # LLM을 안 부르므로 오늘 호출 한도도 쓰지 않는다.
    is_broad = _is_broad_fridge_request(last_user)

    # 이 대화창에서 직전에 실제로 검색·표시했던 결과 (팔로우업 질문의 근거).
    last_turn = _get_last_turn(session_id)

    parsed = {
        'reply': '냉장고 재료 기준으로 레시피를 찾아볼게요.',
        'keywords': [],
        'include_ingredients': [],
        'exclude_ingredients': [],
        'ignore_fridge': False,
    }

    if not is_broad:
        if not _consume_quota():
            return jsonify({
                'error': f'오늘 무료 한도({_daily_limit()}회)를 다 썼어요. 내일 다시 시도해 주세요.',
                'remaining': 0,
            }), 429

        try:
            prompt = _build_prompt(messages, ingredients, last_turn, expiry_days)
            if provider == 'gemini':
                raw = _call_gemini(api_key, prompt)
            else:
                raw = _call_groq(api_key, prompt)
            extracted = _extract_json(raw) or {}
            if isinstance(extracted.get('reply'), str) and extracted['reply'].strip():
                parsed['reply'] = extracted['reply'].strip()
            # 예전 프롬프트는 낱말 하나(keyword)만 받았다. 모델이 옛 형식으로 답하는 경우도
            # 있으므로 둘 다 받아 준다.
            raw_keywords = extracted.get('keywords')
            if isinstance(raw_keywords, list):
                parsed['keywords'] = [str(k).strip()[:40] for k in raw_keywords if str(k).strip()][:MAX_KEYWORDS]
            elif isinstance(extracted.get('keyword'), str) and extracted['keyword'].strip():
                parsed['keywords'] = [extracted['keyword'].strip()[:40]]
            for key in ('include_ingredients', 'exclude_ingredients'):
                values = extracted.get(key) or []
                if isinstance(values, list):
                    parsed[key] = [str(v).strip() for v in values if str(v).strip()][:8]
            parsed['ignore_fridge'] = bool(extracted.get('ignore_fridge'))
        except Exception as e:
            print(f'[chat] LLM 호출 실패: {e}')
            parsed['keywords'] = [last_user[:20]] if last_user else []
            parsed['reply'] = '취향 기준으로 레시피를 찾아봤어요. 아래 글을 눌러 보세요.'

    recipes = _search_recipes(
        get_db,
        parsed['keywords'],
        parsed['include_ingredients'],
        parsed['exclude_ingredients'],
        ingredients,
        parsed['ignore_fridge'],
    )

    # 관련도를 필수 조건으로 바꿨기 때문에 아주 좁은 말에서는 0건이 나올 수 있다.
    # 그럴 때는 조건을 하나씩 완화해서 다시 찾는다.
    #
    # **exclude_ingredients는 매 단계에서 그대로 지킨다.** 예전에는 이 완화 과정에서
    # keywords/include와 함께 exclude_ingredients까지 통째로 날려버렸다 — 그 결과
    # "감자는 빼줘" 처럼 사용자가 명시적으로 뺀 재료가, 검색이 0건이라 완화되는 순간
    # 도로 결과에 섞여 들어왔다(실측으로 확인된 버그: LLM은 exclude_ingredients=["감자"]를
    # 정확히 뽑았지만, include_ingredients에 냉장고의 나머지 재료가 함께 딸려와 조건이
    # 너무 좁아졌고, 0건이 되자 이 코드가 exclude까지 지워서 원래의 감자 포함 결과를
    # 그대로 다시 보여줬다). include/keywords처럼 검색을 "좁히기만" 하는 조건부터
    # 먼저 풀고, 사용자가 "빼달라"고 한 재료는 정말 아무 것도 안 나올 때만 최후 수단으로 푼다.
    if not recipes and len(parsed['keywords']) > 1:
        recipes = _search_recipes(
            get_db, parsed['keywords'][:1], parsed['include_ingredients'],
            parsed['exclude_ingredients'], ingredients, parsed['ignore_fridge'],
        )
    if not recipes and parsed['include_ingredients']:
        # 포함 재료 조건이 너무 좁았을 수 있다 — 그것부터 풀어본다 (exclude는 유지)
        recipes = _search_recipes(
            get_db, parsed['keywords'], [], parsed['exclude_ingredients'],
            ingredients, parsed['ignore_fridge'],
        )
    if not recipes and parsed['keywords']:
        # 낱말도 빼고 냉장고 재료 매칭 + exclude 조건만으로
        recipes = _search_recipes(
            get_db, [], [], parsed['exclude_ingredients'], ingredients, parsed['ignore_fridge'],
        )
    if not recipes and not parsed['ignore_fridge'] and ingredients:
        # 냉장고 우선 모드에서도 결과가 없으면 재료 매칭 조건 없이 한 번 더 (exclude는 유지)
        recipes = _search_recipes(
            get_db, [], [], parsed['exclude_ingredients'], ingredients, True,
        )
    if not recipes and parsed['exclude_ingredients']:
        # 정말 아무 것도 없을 때만 마지막으로 제외 조건까지 푼다 (극히 드문 경우).
        recipes = _search_recipes(get_db, [], [], [], ingredients, True)

    # 검색 결과가 나온 지금, 실제로 매칭에 쓰인 보유 재료를 추린다.
    # ("냉장고 재료를 반영했다"는 말이 뭉뚱그린 느낌이라는 지적이 있었음 —
    #  구체적으로 어떤 재료를 봤는지 답변에 밝혀서 확인할 수 있게 한다)
    matched_names = [] if parsed['ignore_fridge'] else _top_matched_ingredients(
        recipes, ingredients, parsed['exclude_ingredients'],
    )
    matched_phrase = f"{', '.join(matched_names)} 위주로" if matched_names else None

    if is_broad:
        # LLM을 안 거쳤으니 검색이 끝난 지금, 실제로 몇 건/무엇을 찾았는지를 보고 문구를 정한다.
        # (LLM 경로의 reply는 검색 전에 쓰여져서 "이래서 추천해요" 가 애초에 불가능했는데,
        #  이 경로는 결과를 안 뒤에 문구를 만드니 "뭘 보고 골랐는지"까지 밝힐 수 있다)
        if recipes and matched_phrase:
            parsed['reply'] = f'가지고 계신 재료 중 {matched_phrase} 만들 수 있는 레시피 {len(recipes)}개를 찾았어요. 매칭률 높은 순으로 보여드릴게요!'
        elif recipes and ingredients:
            parsed['reply'] = f'냉장고에 있는 재료 기준으로 만들 수 있는 레시피 {len(recipes)}개를 찾았어요. 매칭률 높은 순으로 보여드릴게요!'
        elif recipes:
            parsed['reply'] = '지금 찾을 수 있는 레시피를 보여드릴게요! 냉장고에 재료를 등록해두면 갖고 계신 재료 기준으로 더 정확하게 추천해드릴 수 있어요.'
        else:
            parsed['reply'] = '조건에 맞는 글을 바로 찾지는 못했어요. 냉장고에 재료를 등록해두거나, 원하는 맛이나 요리를 조금 더 말씀해 주실래요?'
    elif not recipes:
        parsed['reply'] = (
            parsed['reply']
            + '\n\n조건에 맞는 글을 바로 찾지는 못했어요. 맛이나 재료를 조금만 더 구체적으로 말해 줄래요?'
        )
    elif matched_phrase:
        # LLM 경로: LLM이 검색 전에 쓴 답변 뒤에, 검색이 끝난 지금 알 수 있는
        # "실제로 뭘 근거로 골랐는지 · 어떻게 정렬했는지"를 서버가 덧붙인다.
        parsed['reply'] = parsed['reply'].rstrip() + f'\n\n가지고 계신 재료 중 {matched_phrase} 골랐고, 매칭률 높은 순으로 정렬했어요.'

    allowed_links = {r['link'] for r in recipes}
    parsed['reply'] = re.sub(
        r'https?://\S+',
        lambda m: m.group(0) if m.group(0) in allowed_links else '',
        parsed['reply'],
    ).strip()

    assistant_msg = {'role': 'assistant', 'content': parsed['reply']}
    stored = [m for m in messages if m.get('role') in ('user', 'assistant')]
    stored.append(assistant_msg)

    # 다음 팔로우업 질문이 "너가 준 재료/레시피" 를 정확히 가리킬 수 있도록,
    # 이번에 실제로 쓴 검색 조건과 실제로 보여준 레시피를 함께 기억해 둔다.
    last_turn_record = {
        'keywords': parsed['keywords'],
        'include_ingredients': parsed['include_ingredients'],
        'exclude_ingredients': parsed['exclude_ingredients'],
        'ignore_fridge': parsed['ignore_fridge'],
        'recipes': [
            {'title': r.get('title') or '', 'used_ingredients': r.get('used_ingredients') or ''}
            for r in recipes
        ],
    }
    _remember(session_id, stored, last_turn_record)

    return jsonify({
        'reply': parsed['reply'],
        'recipes': recipes,
        'keywords': parsed['keywords'],
        # 프론트가 아직 keyword(단수)를 읽고 있을 수 있어 대표 낱말도 함께 보낸다
        'keyword': parsed['keywords'][0] if parsed['keywords'] else '',
        'ignore_fridge': parsed['ignore_fridge'],
        'provider': provider,
        'remaining': remaining_quota(),
    })
