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
    gemini_key = (os.getenv('GEMINI_API_KEY') or '').strip()
    groq_key = (os.getenv('GROQ_API_KEY') or '').strip()
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


def _build_prompt(messages, ingredients):
    history = []
    for msg in messages[-MAX_HISTORY:]:
        role = '사용자' if msg.get('role') == 'user' else '도우미'
        content = (msg.get('content') or '').strip()
        if content:
            history.append(f'{role}: {content}')
    fridge = ', '.join(ingredients[:MAX_INGREDIENTS]) if ingredients else '(아직 냉장고 재료 없음)'
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

냉장고 재료: {fridge}

최근 대화:
{chr(10).join(history) if history else '(없음)'}

아래 JSON만 출력해라.
{{
  "reply": "사용자에게 할 말. 2~4문장. 친근한 한국어. 링크/URL 금지. 구체적인 레시피 제목을 단정하지 말 것. 취향을 반영해 찾아보겠다는 톤.",
  "keywords": ["검색용 한국어 낱말 1~5개. **첫 번째가 가장 중요한 말**. 사용자가 쓴 표현 그대로만 넣지 말고, 같은 뜻으로 글에 쓰일 만한 말을 함께 넣어라. 예: '매운 거' -> [\"매운\", \"매콤\", \"얼큰\", \"칼칼\", \"청양고추\"], '국물' -> [\"국물\", \"찌개\", \"탕\", \"전골\"]. 요리 이름이면 그 이름과 흔한 표기를 넣어라. 해당 없으면 빈 배열"],
  "include_ingredients": ["검색에 꼭 넣고 싶은 재료"],
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

        # ── 냉장고 재료 매칭률
        fridge = [] if ignore_fridge else [i for i in my_ingredients if i][:20]
        if fridge:
            match_parts = [
                "(CASE WHEN FIND_IN_SET(%s, REPLACE(used_ingredients,' ','')) > 0 THEN 1 ELSE 0 END)"
                for _ in fridge
            ]
            total_ing = """
              CASE WHEN used_ingredients IS NULL OR used_ingredients=''
                   THEN 0
                   ELSE LENGTH(REPLACE(used_ingredients,' ',''))
                        - LENGTH(REPLACE(REPLACE(used_ingredients,' ',''),',','')) + 1
              END
            """
            match_rate = (
                f"CASE WHEN ({total_ing}) = 0 THEN 0 "
                f"ELSE ROUND(({' + '.join(match_parts)})/({total_ing})*100) END"
            )
            match_params = fridge[:]
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
        params = relevance_params + match_params + where_params + [SEARCH_LIMIT]
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
        return recipes
    finally:
        db.close()


def _remember(session_id, messages):
    if not session_id:
        return
    with _sessions_lock:
        _sessions[session_id] = {
            'messages': messages[-MAX_HISTORY:],
            'updated': datetime.now(KST).isoformat(),
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

    if not _consume_quota():
        return jsonify({
            'error': f'오늘 무료 한도({_daily_limit()}회)를 다 썼어요. 내일 다시 시도해 주세요.',
            'remaining': 0,
        }), 429

    parsed = {
        'reply': '냉장고 재료 기준으로 레시피를 찾아볼게요.',
        'keywords': [],
        'include_ingredients': [],
        'exclude_ingredients': [],
        'ignore_fridge': False,
    }
    try:
        prompt = _build_prompt(messages, ingredients)
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
    # 그럴 때는 가장 중요한 낱말 하나만 남겨 한 번 더 넓혀 본다.
    if not recipes and len(parsed['keywords']) > 1:
        recipes = _search_recipes(
            get_db, parsed['keywords'][:1], parsed['include_ingredients'],
            parsed['exclude_ingredients'], ingredients, parsed['ignore_fridge'],
        )
    if not recipes and parsed['keywords']:
        # 낱말을 다 빼고 냉장고 재료만으로
        recipes = _search_recipes(get_db, [], [], [], ingredients, parsed['ignore_fridge'])
    if not recipes and not parsed['ignore_fridge'] and ingredients:
        # 냉장고 우선 모드에서도 결과가 없으면 재료 조건 없이 한 번 더 시도
        recipes = _search_recipes(get_db, parsed['keywords'], [], [], ingredients, True)

    if not recipes:
        parsed['reply'] = (
            parsed['reply']
            + '\n\n조건에 맞는 글을 바로 찾지는 못했어요. 맛이나 재료를 조금만 더 구체적으로 말해 줄래요?'
        )

    allowed_links = {r['link'] for r in recipes}
    parsed['reply'] = re.sub(
        r'https?://\S+',
        lambda m: m.group(0) if m.group(0) in allowed_links else '',
        parsed['reply'],
    ).strip()

    assistant_msg = {'role': 'assistant', 'content': parsed['reply']}
    stored = [m for m in messages if m.get('role') in ('user', 'assistant')]
    stored.append(assistant_msg)
    _remember(session_id, stored)

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
