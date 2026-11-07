"""레시피별 대체 재료 — 묶음 호출 + 며칠 분할 실행기 (2026-11-07, 대체 재료 3단계).

왜 이 파일이 따로 있나:
  `scripts/build_recipe_substitutes.py`(손으로/예약 작업으로 돌리는 도구)와 `ingredient_management/llm_ingredient_extraction.py`
  (새 글 수집 끝에 붙는 연결)가 **같은 코드**로 같은 표를 채우도록 한 곳에 모았다. 둘은 같은 「처리 완료」 표시
  (`recipe_substitutes` 의 `ingredient=''` 행)를 보므로 같은 레시피를 두 번 처리하지 않는다.

한도에 대한 원칙(사용자 결정: Gemini 결제를 켜지 않는다):
  * 무료 티어의 병목은 토큰이 아니라 **하루 호출 횟수**(8월 실측 500회/일/모델, 분당 15회)다. 그래서 12건을 한 호출에 묶는다.
  * 같은 `GEMINI_API_KEY` 를 매일 재료 추출 배치도 쓴다 → 이 실행기는 재료 추출이 **끝난 뒤** 남는 한도로만 돈다.
  * 429·키 오류·할당량 초과가 나면 **즉시 정상 종료**한다(예외를 밖으로 내지 않는다). 수집 파이프라인을 막지 않는다.
  * 하루 처리 건수 상한(`daily_limit`)과 분당 호출 상한(`rpm`)을 지킨다. 오늘 몇 건 처리했는지는 로컬 파일에 적어 둔다.
"""

import json
import os
import sys
import time
from datetime import datetime

_BACKEND = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(_BACKEND)
for _p in (_ROOT, _BACKEND):
    if _p not in sys.path:
        sys.path.insert(0, _p)

import recipe_substitutes as rs  # noqa: E402

OUT_DIR = os.path.join(_ROOT, 'ingredient_management', 'outputs')
DEFAULT_DAILY_LIMIT = 1500       # 하루 최대 처리 레시피 수(≈ 125호출)
DEFAULT_RPM = 8                  # 분당 호출 상한(무료 한도 15의 절반 남짓)
OFF_WORDS = ('0', 'false', 'off', 'no')


# ---------------------------------------------------------------- 하루 처리량 기록

def state_path(dry_run):
    return os.path.join(OUT_DIR, 'recipe_substitutes_daily_dryrun.json' if dry_run
                        else 'recipe_substitutes_daily.json')


def load_state(path):
    today = datetime.now().strftime('%Y-%m-%d')
    try:
        with open(path, encoding='utf-8') as f:
            st = json.load(f)
        if st.get('date') == today:
            return {'date': today, 'recipes': int(st.get('recipes', 0)), 'calls': int(st.get('calls', 0))}
    except (OSError, ValueError, TypeError):
        pass
    return {'date': today, 'recipes': 0, 'calls': 0}


def save_state(path, st):
    try:
        os.makedirs(OUT_DIR, exist_ok=True)
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(st, f)
    except OSError:
        pass


# ---------------------------------------------------------------- 대상 고르기 (읽기 전용)

def table_exists(conn):
    cur = conn.cursor()
    try:
        cur.execute("SHOW TABLES LIKE %s", (rs.TABLE,))
        return bool(cur.fetchall())
    finally:
        cur.close()


def plan_pending(conn, *, want, order='recent', rand=False, seed=0, ids=None, start_after_id=0, since_days=0):
    """처리할 레시피 id 를 정한다(읽기 전용). 반환 (rows, info).

    대상 = 목록에 나오는 글(RECIPE_READY) 중
      * 아직 처리 안 한 글 + 처리했지만 **그 뒤 재료가 바뀐 글**(완료 표시 행의 재료 지문 ≠ 지금 재료 지문).
    `since_days` > 0 이면 AI 가 재료를 확정한 지(`llm_ingredients_at`) 그 일수 안인 글만 — 수집 연결이 「새 글만」 맡게.
    """
    import random
    import pymysql.cursors
    from recipe_visibility import RECIPE_READY
    cur = conn.cursor(pymysql.cursors.DictCursor)
    try:
        where = [RECIPE_READY]
        params = []
        if start_after_id:
            where.append('id > %s')
            params.append(start_after_id)
        if ids:
            where.append('id IN (%s)' % ','.join(['%s'] * len(ids)))
            params += list(ids)
        cur.execute('SELECT id, used_ingredients FROM recipes WHERE ' + ' AND '.join(where), params)
        ready = {r['id']: r['used_ingredients'] for r in cur.fetchall()}
        recent = None
        if since_days:
            cur.execute('SELECT id FROM recipes WHERE ' + RECIPE_READY
                        + ' AND llm_ingredients_at >= NOW() - INTERVAL %s DAY', (int(since_days),))
            recent = {r['id'] for r in cur.fetchall()}
        done = {}
        if table_exists(conn):
            cur.execute(f"SELECT recipe_id, substitutes FROM {rs.TABLE} WHERE ingredient=''")
            for r in cur.fetchall():
                h = None
                try:
                    v = r['substitutes']
                    v = json.loads(v) if isinstance(v, (str, bytes)) else v
                    h = v.get('h') if isinstance(v, dict) else None
                except (ValueError, TypeError):
                    pass
                done[r['recipe_id']] = h
        new_ids, stale_ids = [], []
        for rid, used in ready.items():
            if recent is not None and rid not in recent:
                continue
            if rid not in done:
                new_ids.append(rid)
            elif done[rid] and done[rid] != rs.ingredients_hash({'used_ingredients': used}):
                stale_ids.append(rid)   # 처리 뒤 재추출로 재료가 바뀜 → 다시
        rev = (order == 'recent')
        new_ids.sort(reverse=rev)
        stale_ids.sort(reverse=rev)
        pending = stale_ids + new_ids
        if rand:
            random.Random(seed).shuffle(pending)
        info = {'total_ready': len(ready), 'done': sum(1 for i in ready if i in done),
                'stale': len(stale_ids), 'new_pending': len(new_ids),
                'pending_total': len(pending)}
        pick = pending[:want] if want else pending
        rows = []
        for i in range(0, len(pick), 500):
            part = pick[i:i + 500]
            cur.execute('SELECT id, title, used_ingredients, ingredients_detail FROM recipes WHERE id IN (%s)'
                        % ','.join(['%s'] * len(part)), part)
            got = {r['id']: r for r in cur.fetchall()}
            rows += [got[x] for x in part if x in got]
    finally:
        cur.close()
    return rows, info


# ---------------------------------------------------------------- 실행

class _Stop(Exception):
    def __init__(self, reason):
        super().__init__(reason)
        self.reason = reason


def _call_with_retry(key, model, prompt, max_output, sleep=time.sleep, log=print):
    """한 번의 묶음 호출. 한도·키 문제면 _Stop, 일시 오류는 재시도 후 (None, usage) = 이 묶음만 건너뜀."""
    delay = 5
    for attempt in range(3):
        try:
            return rs.call_gemini(key, prompt, model, timeout=60, max_output=max_output)
        except rs.LlmError as e:
            st = e.status
            if st in (400, 401, 403):
                raise _Stop('key_error')
            if st == 429:
                body = (e.body or str(e)).replace(' ', '').lower()
                if 'perday' in body:
                    raise _Stop('quota')
                if attempt == 0:      # 분당 제한 등: 한 번만 기다렸다 다시. 또 429 면 한도로 보고 멈춘다(우회 금지)
                    log('  429(분당/불명) — 40초 기다렸다 한 번만 다시 시도합니다.')
                    sleep(40)
                    continue
                raise _Stop('quota')
            if attempt == 2:
                return None, {}
            sleep(delay)
            delay *= 3
    return None, {}


def run(recipes, *, key, model, commit, conn=None, rpm=DEFAULT_RPM, batch_size=rs.BATCH_SIZE,
        daily_limit=DEFAULT_DAILY_LIMIT, state_file=None, on_result=None, max_minutes=0, log=print,
        sleep=time.sleep, call=None):
    """recipes 를 묶음으로 호출해 저장(commit)하거나 결과만 모은다. **예외를 밖으로 내지 않고** 요약 dict 를 돌려준다.

    summary['stopped'] : None(전부 처리) | 'daily_limit'(오늘 몫 끝, 정상) | 'quota'(429·한도) | 'key_error' | 'errors'(연속 실패) | 'time'
    call: 시험용으로 호출 함수를 갈아 끼울 수 있다(prompt, max_output) -> (text, usage).
    """
    state_file = state_file or state_path(not commit)
    st = load_state(state_file)
    sm = {'recipes_in': len(recipes), 'calls': 0, 'ok': 0, 'skipped': {}, 'with_subs': 0,
          'pt': 0, 'ot': 0, 'th': 0, 'stopped': None, 'today_before': st['recipes'],
          'batch_size': batch_size, 'rpm': rpm, 'daily_limit': daily_limit,
          'foreign_keys': 0, 'subs_kept': 0, 'subs_dropped_unknown': 0, 'subs_dropped_category': 0, 'subs_raw': 0,
          'batch_sizes': []}
    interval = 60.0 / max(rpm, 1)
    last_call = 0.0
    t0 = time.time()
    fails_in_row = 0
    todo = list(recipes)
    batches = rs.make_batches(todo, batch_size)
    try:
        for bi, batch in enumerate(batches):
            if max_minutes and (time.time() - t0) > max_minutes * 60:
                raise _Stop('time')
            remaining = daily_limit - st['recipes']
            if remaining <= 0:
                raise _Stop('daily_limit')
            if len(batch) > remaining:
                batch = batch[:remaining]
            wait = last_call + interval - time.time()
            if wait > 0:
                sleep(wait)
            last_call = time.time()
            prompt = rs.build_batch_prompt(batch)
            mo = rs.batch_max_output(len(batch))
            if call:
                text, usage = call(prompt, mo)
            else:
                text, usage = _call_with_retry(key, model, prompt, mo, sleep=sleep, log=log)
            sm['calls'] += 1
            st['calls'] += 1
            st['recipes'] += len(batch)
            save_state(state_file, st)
            sm['batch_sizes'].append(len(batch))
            sm['pt'] += usage.get('prompt', 0)
            sm['ot'] += usage.get('output', 0)
            sm['th'] += usage.get('thoughts', 0)
            if text is None:     # 일시 오류로 이 묶음 통째로 실패 → 처리 표시 없이 다음 실행에서 다시
                fails_in_row += 1
                for r in batch:
                    sm['skipped']['call_failed'] = sm['skipped'].get('call_failed', 0) + 1
                    if on_result:
                        on_result({'recipe': r, 'ok': False, 'reason': 'call_failed', 'batch': bi, 'usage': usage, 'n': len(batch)})
                if fails_in_row >= 3:
                    raise _Stop('errors')
                continue
            fails_in_row = 0
            parsed = rs.parse_batch(text, batch)
            for r, (res, info) in zip(batch, parsed):
                rec = {'recipe': r, 'batch': bi, 'usage': usage, 'n': len(batch), 'raw': text}
                if res is None:
                    sm['skipped'][info] = sm['skipped'].get(info, 0) + 1
                    rec.update(ok=False, reason=info)
                else:
                    sm['ok'] += 1
                    sm['with_subs'] += 1 if res else 0
                    sm['foreign_keys'] += info.get('foreign_keys', 0)
                    sm['subs_kept'] += info.get('kept', 0)
                    sm['subs_raw'] += info.get('raw', 0)
                    sm['subs_dropped_unknown'] += info.get('dropped_unknown', 0)
                    sm['subs_dropped_category'] += info.get('dropped_category', 0)
                    rec.update(ok=True, result=res, stats=info)
                    if commit:
                        conn.ping(reconnect=True)
                        rs.save(conn, r['id'], res, model, commit=False, ihash=rs.ingredients_hash(r))
                if on_result:
                    on_result(rec)
            if commit:
                conn.commit()
    except _Stop as s:
        sm['stopped'] = s.reason
    except Exception as e:  # noqa: BLE001  어떤 오류도 호출한 쪽(수집 파이프라인)으로 새지 않는다
        sm['stopped'] = 'errors'
        sm['error'] = f'{type(e).__name__}: {e}'[:200]
        if commit and conn is not None:
            try:
                conn.rollback()
            except Exception:  # noqa: BLE001
                pass
    sm['seconds'] = round(time.time() - t0, 1)
    sm['today_after'] = st['recipes']
    sm['calls_today'] = st['calls']
    attempted = sum(sm['skipped'].values()) + sm['ok']
    sm['attempted'] = attempted
    sm['format_error_rate'] = round((attempted - sm['ok']) / attempted, 4) if attempted else None
    sm['avg_prompt_tokens_per_recipe'] = round(sm['pt'] / attempted, 1) if attempted else None
    sm['avg_output_tokens_per_recipe'] = round((sm['ot'] + sm['th']) / attempted, 1) if attempted else None
    cost = rs.cost_usd(sm['pt'], sm['ot'] + sm['th'])
    sm['cost_usd_estimate'] = round(cost, 6)
    sm['cost_per_recipe_usd_estimate'] = round(cost / attempted, 7) if attempted else None
    return sm


# ---------------------------------------------------------------- 수집 연결 (새 글만)

def collection_enabled():
    return (os.getenv('SUBSTITUTES_AT_COLLECTION') or '1').strip().lower() not in OFF_WORDS


def run_for_collection(log=print, extractor_quota_exhausted=False):
    """새 글 수집(재료 확정) 끝에서 부른다. **어떤 경우에도 예외를 내지 않는다** — 로그 한 줄만 남기고 돌아간다.

    켜지는 조건(전부 맞아야 한다):
      * 환경변수 SUBSTITUTES_AT_COLLECTION 이 0/false/off/no 가 아니다(기본은 켜짐)
      * GEMINI_API_KEY 가 있다
      * `recipe_substitutes` 표가 **이미 있다**(표는 여기서 만들지 않는다 — 사용자가 처음 `--commit` 으로 돌릴 때 생긴다)
      * 이번 재료 추출이 429 로 끝나지 않았다(남는 한도로만 돈다)
    조정: SUBSTITUTES_AT_COLLECTION_LIMIT(한 번 최대 건수, 기본 300), SUBSTITUTES_COLLECTION_DAYS(재료 확정 후 며칠 안의 글만, 기본 3),
          SUBSTITUTES_DAILY_LIMIT(하루 상한, 기본 1500 — 일일 실행기와 같은 기록을 쓴다), SUBSTITUTES_AT_COLLECTION_MINUTES(기본 15).
    """
    conn = None
    try:
        if not collection_enabled():
            log('[대체 재료] SUBSTITUTES_AT_COLLECTION=0 — 건너뜁니다.')
            return None
        if extractor_quota_exhausted:
            log('[대체 재료] 오늘 재료 추출이 한도에 닿아 건너뜁니다(남는 한도가 없음).')
            return None
        key = rs.pick_key()
        if not key:
            log('[대체 재료] GEMINI_API_KEY 없음 — 건너뜁니다.')
            return None
        from db_env import connect
        conn = connect()
        if not table_exists(conn):
            log('[대체 재료] recipe_substitutes 표가 아직 없어 건너뜁니다(첫 `build_recipe_substitutes.py --commit` 실행 전).')
            return None
        limit = int(os.getenv('SUBSTITUTES_AT_COLLECTION_LIMIT') or 300)
        days = int(os.getenv('SUBSTITUTES_COLLECTION_DAYS') or 3)
        daily = int(os.getenv('SUBSTITUTES_DAILY_LIMIT') or DEFAULT_DAILY_LIMIT)
        minutes = int(os.getenv('SUBSTITUTES_AT_COLLECTION_MINUTES') or 15)
        st = load_state(state_path(False))
        want = max(0, min(limit, daily - st['recipes']))
        if want <= 0:
            log(f'[대체 재료] 오늘 몫({daily}건) 소진 — 건너뜁니다.')
            return None
        rows, info = plan_pending(conn, want=want, since_days=days)
        if not rows:
            log(f'[대체 재료] 새 글 중 처리할 것 없음(최근 {days}일 확정분 기준).')
            return None
        sm = run(rows, key=key, model=rs.default_model(), commit=True, conn=conn, rpm=DEFAULT_RPM,
                 daily_limit=daily, max_minutes=minutes, log=log)
        log(f"[대체 재료] 새 글 {sm['ok']}/{len(rows)}건 저장 · 호출 {sm['calls']} · 건너뜀 {sum(sm['skipped'].values())}"
            f"{' · 중단=' + sm['stopped'] if sm['stopped'] else ''} · 전체 진행 약 {info['done'] + sm['ok']}/{info['total_ready']}")
        return sm
    except BaseException as e:  # noqa: BLE001  SystemExit(DB 환경변수 누락 등)까지 삼킨다. Ctrl+C 만 통과.
        if isinstance(e, KeyboardInterrupt):
            raise
        try:
            log(f'[대체 재료] 건너뜀(수집은 그대로 진행): {type(e).__name__}: {str(e)[:150]}')
        except Exception:  # noqa: BLE001
            pass
        return None
    finally:
        try:
            if conn is not None:
                conn.close()
        except Exception:  # noqa: BLE001
            pass
