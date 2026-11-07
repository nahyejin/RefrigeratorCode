"""레시피별 대체 재료를 AI 로 미리 계산해 `recipe_substitutes` 표에 저장한다(대체 재료 3단계, 2026-11-07).

    # 1) 무작위 30건을 돌려 보고 결과·토큰·비용만 CSV 로 (DB 에 아무것도 쓰지 않는다 — 읽기 전용)
    python scripts\\build_recipe_substitutes.py --dry-run --limit 30

    # 2) 실제 저장(운영 DB 에 쓴다 — 표를 만들고 행을 넣는다). 중단되면 같은 명령을 다시 — 이미 처리한 건은 건너뛴다
    python scripts\\build_recipe_substitutes.py --commit

    # 3) 매일 새로 들어온 레시피만 채우기(= --commit 과 같다. 처리한 건은 자동으로 건너뜀)
    python scripts\\build_recipe_substitutes.py --commit --resume --limit 2000

레시피 1건당 AI 호출 1회(재료 전부 한꺼번에). 결과 CSV 는 `ingredient_management/outputs/` 에 쌓인다.
429(한도)·키 오류가 나면 **우회하지 않고 멈춘다** — 그때까지 저장한 건 남아 있고, 다시 돌리면 이어서 한다.
"""
import argparse
import csv
import json
import os
import random
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, 'backend'))

import pymysql.cursors  # noqa: E402
from db_env import connect, _load_env  # noqa: E402

_load_env()
import recipe_substitutes as rs  # noqa: E402
from recipe_visibility import RECIPE_READY  # noqa: E402

OUT_DIR = os.path.join(ROOT, 'ingredient_management', 'outputs')


class Abort(Exception):
    """더 돌리면 안 되는 오류(키 오류·한도 계속 초과)."""


class RateLimiter:
    def __init__(self, rpm):
        self.interval = 60.0 / max(rpm, 1)
        self.lock = threading.Lock()
        self.next_at = 0.0

    def wait(self):
        with self.lock:
            now = time.time()
            at = max(now, self.next_at)
            self.next_at = at + self.interval
        if at > now:
            time.sleep(at - now)


def fetch_recipes(conn, args, done_ids):
    cur = conn.cursor(pymysql.cursors.DictCursor)
    try:
        # 목록에 실제로 나오는 글만(recipe_visibility.RECIPE_READY: AI 가 재료를 확정했고 재료 4개 이상) — AI 확정 전 글은 재료가 바뀔 수 있어 키가 어긋난다
        where = [RECIPE_READY]
        params = []
        if args.start_after_id:
            where.append('id > %s')
            params.append(args.start_after_id)
        if args.ids:
            where.append('id IN (%s)' % ','.join(['%s'] * len(args.ids)))
            params += args.ids
        # 먼저 id 만(싸다) 고르고, 고른 것만 본문을 가져온다 — 4만 건 본문을 매번 받으면 몇 분이 걸린다
        cur.execute('SELECT id FROM recipes WHERE ' + ' AND '.join(where)
                    + (' ORDER BY id DESC' if args.order == 'recent' else ' ORDER BY id'), params)
        ids = [r['id'] for r in cur.fetchall() if r['id'] not in done_ids]
        if args.random:
            random.Random(args.seed).shuffle(ids)
        if args.limit:
            ids = ids[:args.limit]
        rows = []
        for i in range(0, len(ids), 500):
            part = ids[i:i + 500]
            cur.execute('SELECT id, title, used_ingredients, ingredients_detail, cook_steps FROM recipes WHERE id IN (%s)'
                        % ','.join(['%s'] * len(part)), part)
            got = {r['id']: r for r in cur.fetchall()}
            rows += [got[x] for x in part if x in got]
    finally:
        cur.close()
    return rows[:args.limit] if args.limit else rows


def done_recipe_ids(conn):
    cur = conn.cursor()
    try:
        cur.execute(f"SELECT recipe_id FROM {rs.TABLE} WHERE ingredient=''")
        return {r[0] if not isinstance(r, dict) else r['recipe_id'] for r in cur.fetchall()}
    except Exception:  # noqa: BLE001  표가 아직 없음
        return set()
    finally:
        cur.close()


def process_one(recipe, key, model, limiter):
    """한 레시피. 결과 dict 를 돌려주고, 한도/키 오류면 Abort."""
    tokens = rs.ingredient_tokens(recipe)
    prompt = rs.build_prompt(recipe)
    delay = 8
    for attempt in range(4):
        limiter.wait()
        try:
            text, usage = rs.call_gemini(key, prompt, model)
            break
        except rs.LlmError as e:
            if e.status in (400, 401, 403):
                raise Abort(f'키/요청 오류 {e}')
            if e.status == 429 or (e.status or 0) >= 500 or e.status is None:
                if attempt == 3:
                    if e.status == 429:
                        raise Abort(f'429 한도가 계속 초과됨: {e}')
                    return {'id': recipe['id'], 'ok': False, 'error': str(e)[:120], 'usage': {}, 'prompt_text': prompt}
                time.sleep(delay)
                delay *= 3
                continue
            return {'id': recipe['id'], 'ok': False, 'error': str(e)[:120], 'usage': {}, 'prompt_text': prompt}
    result, stats = rs.parse_result(text, tokens)
    if result is None:
        return {'id': recipe['id'], 'ok': False, 'error': 'JSON 해석 실패: ' + text[:80], 'usage': usage, 'prompt_text': prompt}
    return {'id': recipe['id'], 'ok': True, 'result': result, 'stats': stats, 'usage': usage,
            'title': recipe['title'], 'tokens': tokens, 'raw': text}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument('--dry-run', action='store_true', help='DB 에 쓰지 않고 CSV 만(기본)')
    mode.add_argument('--commit', action='store_true', help='recipe_substitutes 에 저장(운영 DB 쓰기)')
    ap.add_argument('--limit', type=int, default=0, help='처리할 최대 건수(0 = 전부)')
    ap.add_argument('--resume', action='store_true', help='이미 처리한 recipe_id 건너뛰기(--commit 은 늘 그렇게 한다)')
    ap.add_argument('--random', action='store_true', help='무작위 표본(dry-run 은 기본으로 켠다)')
    ap.add_argument('--seed', type=int, default=20261107)
    ap.add_argument('--order', choices=['recent', 'id'], default='recent', help='recent = 최신 글부터(보이는 쪽부터)')
    ap.add_argument('--start-after-id', type=int, default=0)
    ap.add_argument('--ids', type=int, nargs='*', help='이 recipe_id 들만')
    ap.add_argument('--batch-size', type=int, default=150, help='DB 에 한 번에 확정하는 건수')
    ap.add_argument('--concurrency', type=int, default=4)
    ap.add_argument('--rpm', type=int, default=60, help='분당 호출 상한')
    ap.add_argument('--model', default=None)
    args = ap.parse_args()
    commit = args.commit
    if not commit:
        args.random = True if not args.ids else args.random

    key = rs.pick_key()
    if not key:
        print('GEMINI_API_KEY 가 없습니다(backend/.env).')
        return 2
    model = args.model or rs.default_model()

    conn = connect()
    done = done_recipe_ids(conn) if (commit or args.resume) else set()
    recipes = fetch_recipes(conn, args, done)
    print(f'대상 {len(recipes)}건 (이미 처리 {len(done)}건 제외) · 모델 {model} · '
          f'{"저장(--commit)" if commit else "미리보기(DB 쓰기 없음)"}', flush=True)
    if not recipes:
        return 0
    if commit:
        rs.ensure_table(conn)

    os.makedirs(OUT_DIR, exist_ok=True)
    stamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    tag = 'commit' if commit else 'dryrun'
    csv_path = os.path.join(OUT_DIR, f'recipe_substitutes_{tag}_{stamp}.csv')
    fh = open(csv_path, 'w', encoding='utf-8-sig', newline='')
    w = csv.writer(fh)
    w.writerow(['recipe_id', 'title', 'ingredient', 'substitutes', 'ok', 'prompt_tokens', 'output_tokens', 'thought_tokens', 'error'])

    limiter = RateLimiter(args.rpm)
    tot = {'ok': 0, 'fail': 0, 'pt': 0, 'ot': 0, 'th': 0, 'raw': 0, 'kept': 0, 'unk': 0, 'cat': 0, 'with_subs': 0, 'ings': 0, 'subs_ings': 0}
    t0 = time.time()
    aborted = None
    stop = threading.Event()

    def work(r):
        if stop.is_set():
            return None
        try:
            return process_one(r, key, model, limiter)
        except Abort as e:
            stop.set()
            return {'abort': str(e)}

    for b in range(0, len(recipes), args.batch_size):
        chunk = recipes[b:b + args.batch_size]
        with ThreadPoolExecutor(max_workers=args.concurrency) as ex:
            results = list(ex.map(work, chunk))
        for r in results:
            if r is None:
                continue
            if 'abort' in r:
                aborted = r['abort']
                continue
            u = r['usage']
            pt, ot, th = u.get('prompt', 0), u.get('output', 0), u.get('thoughts', 0)
            tot['pt'] += pt
            tot['ot'] += ot
            tot['th'] += th
            if not r['ok']:
                tot['fail'] += 1
                w.writerow([r['id'], '', '', '', 0, pt, ot, th, r['error']])
                continue
            tot['ok'] += 1
            tot['raw'] += r['stats']['raw']
            tot['kept'] += r['stats']['kept']
            tot['unk'] += r['stats']['dropped_unknown']
            tot['cat'] += r['stats'].get('dropped_category', 0)
            tot['ings'] += len(r['tokens'])
            tot['subs_ings'] += len(r['result'])
            tot['with_subs'] += 1 if r['result'] else 0
            if r['result']:
                for ing, subs in r['result'].items():
                    w.writerow([r['id'], r['title'], ing,
                                ' | '.join(s['name'] + (f"({s['note']})" if s['note'] else '') for s in subs), 1, pt, ot, th, ''])
            else:
                w.writerow([r['id'], r['title'], '(대체 없음)', '', 1, pt, ot, th, ''])
            if commit:
                try:
                    rs.save(conn, r['id'], r['result'], model, commit=False)
                except Exception:  # noqa: BLE001 연결이 끊겼으면 한 번 다시 연결
                    conn = connect()
                    rs.save(conn, r['id'], r['result'], model, commit=False)
        if commit:
            try:
                conn.commit()
            except Exception:  # noqa: BLE001
                conn = connect()
        fh.flush()
        n = tot['ok'] + tot['fail']
        cost = rs.cost_usd(tot['pt'], tot['ot'] + tot['th'])
        print(f'  진행 {n}/{len(recipes)} · 성공 {tot["ok"]} 실패 {tot["fail"]} · 누적 약 ${cost:.4f}(추정) · {time.time() - t0:.0f}초', flush=True)
        if aborted:
            print(f'중단: {aborted}', flush=True)
            break
    fh.close()

    n = tot['ok'] + tot['fail']
    cost = rs.cost_usd(tot['pt'], tot['ot'] + tot['th'])
    summary = {
        'mode': tag, 'model': model, 'recipes': n, 'ok': tot['ok'], 'fail': tot['fail'],
        'fail_rate': round(tot['fail'] / n, 4) if n else None,
        'avg_prompt_tokens': round(tot['pt'] / n, 1) if n else None,
        'avg_output_tokens': round(tot['ot'] / n, 1) if n else None,
        'avg_thought_tokens': round(tot['th'] / n, 1) if n else None,
        'cost_usd_estimate': round(cost, 5),
        'cost_per_recipe_usd': round(cost / n, 6) if n else None,
        'recipes_with_any_substitute': tot['with_subs'],
        'ingredients_total': tot['ings'], 'ingredients_with_substitutes': tot['subs_ings'],
        'subs_kept': tot['kept'], 'subs_dropped_not_in_dictionary': tot['unk'], 'subs_dropped_category_mismatch': tot['cat'], 'subs_raw': tot['raw'],
        'seconds': round(time.time() - t0, 1), 'aborted': aborted, 'csv': csv_path,
        'price_note': f'입력 ${rs.PRICE_IN_PER_M}/1M, 출력(생각 포함) ${rs.PRICE_OUT_PER_M}/1M — 제3자 가격표 기준 추정',
    }
    with open(csv_path.replace('.csv', '_summary.json'), 'w', encoding='utf-8') as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 1 if aborted else 0


if __name__ == '__main__':
    sys.exit(main())
