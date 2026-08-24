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
검색은 서버가 우리 DB에서 한다. 너는 검색에 쓸 키워드만 고른다.

냉장고 재료: {fridge}

최근 대화:
{chr(10).join(history) if history else '(없음)'}

아래 JSON만 출력해라.
{{
  "reply": "사용자에게 할 말. 2~4문장. 친근한 한국어. 링크/URL 금지. 구체적인 레시피 제목을 단정하지 말 것. 취향을 반영해 찾아보겠다는 톤.",
  "keyword": "title/content 검색용 한국어 키워드 1개. 예: 매운, 찌개, 파스타. 없으면 빈 문자열",
  "include_ingredients": ["검색에 꼭 넣고 싶은 재료"],
  "exclude_ingredients": ["빼고 싶은 재료"]
}}
"""


def _search_recipes(get_db, keyword, include_ingredients, exclude_ingredients, my_ingredients):
    db = get_db()
    cursor = db.cursor()
    try:
        where = ['1=1']
        params = []

        if keyword:
            like = f'%{keyword}%'
            where.append('(title LIKE %s OR content LIKE %s OR used_ingredients LIKE %s)')
            params.extend([like, like, like])

        for ing in include_ingredients[:8]:
            where.append("FIND_IN_SET(%s, REPLACE(used_ingredients,' ','')) > 0")
            params.append(ing)

        for ing in exclude_ingredients[:8]:
            where.append("FIND_IN_SET(%s, REPLACE(used_ingredients,' ','')) = 0")
            params.append(ing)

        fridge = [i for i in my_ingredients if i][:20]
        if fridge:
            match_parts = [
                "(CASE WHEN FIND_IN_SET(%s, REPLACE(used_ingredients,' ','')) > 0 THEN 1 ELSE 0 END)"
                for _ in fridge
            ]
            match_count = ' + '.join(match_parts)
            total_ing = """
              CASE WHEN used_ingredients IS NULL OR used_ingredients=''
                   THEN 0
                   ELSE LENGTH(REPLACE(used_ingredients,' ',''))
                        - LENGTH(REPLACE(REPLACE(used_ingredients,' ',''),',','')) + 1
              END
            """
            match_rate = f"CASE WHEN ({total_ing}) = 0 THEN 0 ELSE ROUND(({match_count})/({total_ing})*100) END"
            select_params = fridge[:]
            order_by = 'match_rate DESC, post_time DESC'
        else:
            match_rate = '0'
            select_params = []
            order_by = 'post_time DESC'

        sql = f"""
            SELECT id, title, thumbnail, platform, likes, comments, hits,
                   post_time, used_ingredients, link,
                   {match_rate} AS match_rate
            FROM recipes
            WHERE {' AND '.join(where)}
            ORDER BY {order_by}
            LIMIT %s
        """
        cursor.execute(sql, select_params + params + [SEARCH_LIMIT])
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
        'keyword': '',
        'include_ingredients': [],
        'exclude_ingredients': [],
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
        if isinstance(extracted.get('keyword'), str):
            parsed['keyword'] = extracted['keyword'].strip()[:40]
        for key in ('include_ingredients', 'exclude_ingredients'):
            values = extracted.get(key) or []
            if isinstance(values, list):
                parsed[key] = [str(v).strip() for v in values if str(v).strip()][:8]
    except Exception as e:
        print(f'[chat] LLM 호출 실패: {e}')
        parsed['keyword'] = last_user[:20]
        parsed['reply'] = '취향 기준으로 레시피를 찾아봤어요. 아래 글을 눌러 보세요.'

    recipes = _search_recipes(
        get_db,
        parsed['keyword'],
        parsed['include_ingredients'],
        parsed['exclude_ingredients'],
        ingredients,
    )

    if not recipes and parsed['keyword']:
        recipes = _search_recipes(get_db, '', [], [], ingredients)

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
        'keyword': parsed['keyword'],
        'provider': provider,
        'remaining': remaining_quota(),
    })
