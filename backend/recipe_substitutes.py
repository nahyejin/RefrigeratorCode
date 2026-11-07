"""레시피별 「이 요리에서 바꿔 써도 되는 재료」 — 미리 계산해 DB 에 저장한다(2026-11-07, 대체 재료 3단계).

왜 미리 계산하나:
  대체 재료 표(`ingredient_substitute_table.csv`)는 재료쌍의 성질이 비슷한지만 보고 **후보**를 낸다. 「이 요리에서 정말 되나」는 모른다
  (「양념 소불고기 → 만두」). 화면을 볼 때마다 AI 를 돌리면 비용·지연이 사용자 수만큼 늘어나므로, **레시피 약 4만 건을 한 번만** 돌려
  재료마다 후보를 저장하고 화면은 저장값을 조회만 한다. 새 레시피가 들어오면 그때 그 건만 만든다(증분).

테이블 `recipe_substitutes` (PK recipe_id + ingredient):
  * ingredient = 레시피 재료 대표어(`recipes.used_ingredients` 의 토큰). **빈 문자열('') 행은 「처리 완료」 표시**다 — 대체가 하나도 없는
    레시피도 다시 돌리지 않게(`--resume`)·화면이 「처리했는데 대체 없음」과 「아직 안 돌림」을 구분하게.
  * substitutes = JSON `[{"name": "대파", "note": "향이 더 약해요"}]` 최대 3개(첫째가 가장 알맞은 것). 모두 앱 재료 사전의 대표어다.

이 모듈은 서버(app.py)와 `scripts/build_recipe_substitutes.py` 가 함께 쓴다. 표준 라이브러리 + requests 만 쓴다.
"""

import json
import os
import re
import time
from datetime import datetime

import requests

TABLE = 'recipe_substitutes'
MAX_SUBS = 3
MAX_STEPS = 0            # 프롬프트에 싣는 조리 순서 줄 수. 0 = 안 싣는다(측정: 순서를 넣어도 품질이 눈에 띄게 좋아지지 않았고 입력 토큰만 늘었다)
STEP_CHARS = 60
NOTE_CHARS = 30

_DDL = f"""
CREATE TABLE IF NOT EXISTS {TABLE} (
    recipe_id INT NOT NULL,
    ingredient VARCHAR(100) NOT NULL,
    substitutes JSON NULL,
    generated_at DATETIME NOT NULL,
    model VARCHAR(48) NULL,
    PRIMARY KEY (recipe_id, ingredient)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
"""


def ensure_table(conn):
    """표가 없으면 만든다. 쓰기 단계(`--commit`)에서만 부른다 — 서버의 조회 경로에서는 부르지 않는다."""
    cur = conn.cursor()
    try:
        cur.execute(_DDL)
        conn.commit()
    finally:
        cur.close()


# ---------------------------------------------------------------- 프롬프트

def _lines(text):
    return [x.strip() for x in (text or '').split('\n') if x.strip()]


def ingredient_tokens(recipe):
    """대체를 물을 재료 이름들 — 화면이 쓰는 `used_ingredients` 토큰 그대로(키가 어긋나지 않게)."""
    out = []
    for t in (recipe.get('used_ingredients') or '').split(','):
        t = t.strip()
        if t and t not in out:
            out.append(t)
    return out


def build_prompt(recipe):
    """입력·출력 토큰이 곧 비용이다(출력 단가가 입력의 8배) — 그래서 **출력은 한 줄에 하나인 평문**, 메모는 받지 않는다."""
    tokens = ingredient_tokens(recipe)
    detail = ' / '.join(_lines(recipe.get('ingredients_detail')))[:300]
    steps = [s[:STEP_CHARS] for s in _lines(recipe.get('cook_steps'))[:MAX_STEPS]]
    steps_line = ' '.join(steps)
    head = (f"요리: {(recipe.get('title') or '').strip()[:80]}\n"
            f"재료: {', '.join(tokens)}\n"
            f"분량: {detail or '(없음)'}")
    if steps_line:
        head += f"\n순서: {steps_line}"
    return head + """

[재료] 중 **이 요리에서 같은 역할을 하는 같은 종류의 재료로 바꿔도 맛·식감이 거의 그대로**인 것만, 집에 흔한 대체 재료를 최대 2개(알맞은 순서) 골라라.
- 같은 종류끼리만: 파↔파, 기름↔기름, 깨↔깨, 단맛 재료↔단맛 재료, 육수·장류↔같은 계열. 맛·향 계열이 다르면 안 된다(예: 마늘→양파, 간장→액젓, 오이→애호박은 안 됨). 확신이 없으면 그 재료는 쓰지 마라(억지로 채우지 마라, 대부분 비워도 된다).
- 주재료(요리의 정체), 핵심 향미 재료, 소금·후추·물은 쓰지 마라. 브랜드·요리 이름도 쓰지 마라.
- 출력은 평문 한 줄에 하나: 재료이름=대체1,대체2 (재료이름은 위 [재료] 그대로). 쓸 게 없으면 「없음」 한 단어만. 설명·번호·기호 금지."""


# ---------------------------------------------------------------- LLM 호출

PRICE_IN_PER_M = 0.30    # USD / 1M 입력 토큰 — gemini-3.5-flash-lite 표준(유료) 단가, 제3자 가격표 기준 「추정」
PRICE_OUT_PER_M = 2.50   # USD / 1M 출력 토큰(생각 토큰 포함)


class LlmError(Exception):
    def __init__(self, msg, status=None):
        super().__init__(msg)
        self.status = status


def default_model():
    return os.getenv('SUBSTITUTE_MODEL') or os.getenv('GEMINI_MODEL') or 'gemini-3.5-flash-lite'


def pick_key():
    """배치 전용 키 우선(`GEMINI_API_KEY`). 챗봇 키(`GEMINI_API_KEY_CHAT`)는 사용자 챗봇 몫이라 건드리지 않는다."""
    return (os.getenv('GEMINI_API_KEY') or '').strip()


def call_gemini(api_key, prompt, model=None, timeout=40):
    """(text, usage) 를 돌려준다. usage = {prompt, output, thoughts}. 실패하면 LlmError(status)."""
    model = model or default_model()
    url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent'
    payload = {
        'contents': [{'role': 'user', 'parts': [{'text': prompt}]}],
        'generationConfig': {
            'temperature': 0.2,
            'maxOutputTokens': 400,
            'thinkingConfig': {'thinkingLevel': 'minimal'},   # 생각 토큰은 출력 단가로 청구된다 — 이 일엔 필요 없다
        },
    }
    try:
        res = requests.post(url, json=payload, headers={'x-goog-api-key': api_key}, timeout=timeout)
    except requests.RequestException as e:
        raise LlmError(f'network: {type(e).__name__}') from e
    if res.status_code != 200:
        raise LlmError(f'http {res.status_code}: {res.text[:200]}', status=res.status_code)
    data = res.json()
    meta = data.get('usageMetadata') or {}
    usage = {
        'prompt': meta.get('promptTokenCount') or 0,
        'output': meta.get('candidatesTokenCount') or 0,
        'thoughts': meta.get('thoughtsTokenCount') or 0,
    }
    parts = (data.get('candidates') or [{}])[0].get('content', {}).get('parts', [])
    return ''.join(p.get('text', '') for p in parts), usage


def cost_usd(prompt_tokens, output_tokens):
    return prompt_tokens / 1e6 * PRICE_IN_PER_M + output_tokens / 1e6 * PRICE_OUT_PER_M


# ---------------------------------------------------------------- 결과 정리

_alias = None


def _alias_map():
    global _alias
    if _alias is None:
        import ingredient_dictionary as d
        _alias = d.get_alias_to_canonical()
    return _alias


_mid = None


def _mid_category(name):
    """사전의 중분류(식재료 원물 / 양념·조미료 / 유제품 …). 사전에 없으면 None."""
    global _mid
    if _mid is None:
        import csv
        import ingredient_dictionary as d
        _mid = {}
        try:
            with open(d._find_csv(), encoding='utf-8-sig', newline='') as f:
                for r in csv.DictReader(f):
                    k = (r.get('keyword') or r.get('1keyword') or '').strip()
                    if k and (r.get('대분류') or '').strip() in d._MATERIAL_CATEGORIES:
                        _mid[k] = (r.get('중분류') or '').strip()
        except Exception as e:  # noqa: BLE001  사전을 못 읽으면 이 검사만 건너뛴다
            print(f'[recipe_substitutes] 사전 분류 읽기 실패(무시): {e}', flush=True)
    return _mid.get(name) or None


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
        m = re.search(r'\{[\s\S]*\}', cleaned)
        if m:
            try:
                return json.loads(m.group(0))
            except json.JSONDecodeError:
                return None
    return None


def parse_result(text, tokens):
    """모델 답(줄마다 `재료=대체1,대체2`)을 `{재료: [{name, note}]}` 로 정리한다. 「없음」 → 빈 결과. 한 줄도 못 읽고 글이 있으면 None(= 실패, 저장 안 함).

    * 키는 이 레시피 재료 토큰에 있는 것만(없는 이름은 버린다).
    * 대체 이름은 재료 사전 대표어로 정규화 — 사전에 없으면 버린다(냉장고 재료와 맞춰 볼 수 없는 이름이라 칩이 못 된다).
    * 자기 자신·중복은 뺀다. 최대 3개(프롬프트는 2개까지 청하지만 저장 한도는 넉넉히).
    * 옛 형식(JSON `{"재료":[{"n":..}]}`)도 읽는다.
    반환 두 번째 값은 통계 {raw, kept, dropped_unknown}.
    """
    import ingredient_dictionary as d
    alias = _alias_map()
    tokset = set(tokens)
    text = (text or '').strip()
    if not text:
        return None, None
    pairs = []   # (재료, [(이름, 메모)])
    parsed = _extract_json(text) if text.lstrip().startswith(('{', '`')) else None
    if isinstance(parsed, dict):
        for key, subs in parsed.items():
            lst = []
            for s in (subs if isinstance(subs, list) else []):
                if isinstance(s, str):
                    lst.append((s, ''))
                elif isinstance(s, dict):
                    lst.append((s.get('n') or s.get('name') or '', s.get('t') or s.get('note') or ''))
            pairs.append((str(key).strip(), lst))
    else:
        for line in text.splitlines():
            line = line.strip().lstrip('-*•').strip()
            if '=' not in line:
                continue
            key, _, rest = line.partition('=')
            pairs.append((key.strip(), [(x.strip(), '') for x in re.split(r'[,，、/]', rest)]))
        if not pairs and text.replace('「', '').replace('」', '').strip() not in ('없음', '없음.'):
            return None, None
    out, stats = {}, {'raw': 0, 'kept': 0, 'dropped_unknown': 0}
    for key, subs in pairs:
        if key not in tokset:
            continue
        picked, seen = [], {key}
        for name, note in subs:
            name = str(name).strip()
            if not name:
                continue
            stats['raw'] += 1
            canon = d.resolve_canonical(name, alias)
            if not canon:
                stats['dropped_unknown'] += 1
                continue
            if canon in seen:
                continue
            # 규칙 한 겹 더(AI 가 가끔 어긋난 쌍을 낸다 — 「고구마 → 설탕」「대추 → 블루베리」류): 사전 중분류가 다르면 버린다.
            # 원물 ↔ 양념·조미료, 유제품 ↔ 원물처럼 역할이 아예 다른 것만 막는 거친 검사다(같은 중분류 안의 어긋남은 못 잡는다).
            ca, cb = _mid_category(key), _mid_category(canon)
            if ca and cb and ca != cb:
                stats['dropped_category'] = stats.get('dropped_category', 0) + 1
                continue
            seen.add(canon)
            picked.append({'name': canon, 'note': str(note).strip()[:NOTE_CHARS]})
            stats['kept'] += 1
            if len(picked) >= MAX_SUBS:
                break
        if picked:
            out[key] = picked
    return out, stats


# ---------------------------------------------------------------- 저장·조회

def save(conn, recipe_id, result, model, commit=True):
    """한 레시피의 결과를 저장한다(이미 있으면 갈아 끼움). 대체가 없어도 완료 표시 행('')은 남긴다."""
    now = datetime.now()
    cur = conn.cursor()
    try:
        cur.execute(f'DELETE FROM {TABLE} WHERE recipe_id=%s', (recipe_id,))
        rows = [(recipe_id, '', '[]', now, model)]
        for ing, subs in result.items():
            rows.append((recipe_id, ing[:100], json.dumps(subs, ensure_ascii=False), now, model))
        cur.executemany(
            f'INSERT INTO {TABLE} (recipe_id, ingredient, substitutes, generated_at, model) VALUES (%s,%s,%s,%s,%s)',
            rows)
        if commit:
            conn.commit()
    finally:
        cur.close()


_missing_until = 0.0


def load_for_recipe(conn, recipe_id):
    """화면용: `{재료: [이름, …]}`. 처리한 적 없으면(또는 표가 없으면) None — 호출부는 키를 생략한다.

    처리했는데 대체가 하나도 없으면 `{}`(빈 객체) — 화면이 「표 기반 후보로 되돌아가지 않기」위해 구분한다.
    어떤 실패든 None 으로 삼킨다: 대체 정보가 없다고 레시피 창이 안 열리면 안 된다.
    """
    global _missing_until
    if time.time() < _missing_until:
        return None
    cur = conn.cursor()
    try:
        cur.execute(f'SELECT ingredient, substitutes FROM {TABLE} WHERE recipe_id=%s', (recipe_id,))
        rows = cur.fetchall()
    except Exception as e:  # noqa: BLE001
        # 표가 아직 없는 환경(1146) — 1분 동안은 다시 묻지 않는다.
        _missing_until = time.time() + 60
        print(f'[recipe_substitutes] 조회 실패(무시): {e}', flush=True)
        return None
    finally:
        cur.close()
    if not rows:
        return None
    out = {}
    for r in rows:
        ing = r['ingredient'] if isinstance(r, dict) else r[0]
        raw = r['substitutes'] if isinstance(r, dict) else r[1]
        if not ing:
            continue
        try:
            lst = json.loads(raw) if isinstance(raw, (str, bytes)) else (raw or [])
            names = [x['name'] for x in lst if isinstance(x, dict) and x.get('name')]
        except (ValueError, TypeError, KeyError):
            continue
        if names:
            out[ing] = names
    return out
