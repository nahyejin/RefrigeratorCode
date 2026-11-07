"""레시피별 대체 재료를 AI 로 미리 계산해 `recipe_substitutes` 표에 저장한다(대체 재료 3단계, 2026-11-07).

    # 1) 무작위 36건(= 3호출)을 돌려 보고 결과·토큰·비용만 CSV 로 (DB 에 아무것도 쓰지 않는다 — 읽기 전용)
    python scripts\\build_recipe_substitutes.py --dry-run --limit 36

    # 2) 실제 저장(운영 DB 에 쓴다 — 표를 만들고 행을 넣는다). 하루 몫만 하고 정상 종료한다
    python scripts\\build_recipe_substitutes.py --commit --daily-limit 1500

    # 3) 다음 날 같은 명령을 다시(또는 매일 배치에 붙인다) — 이미 처리한 건은 건너뛰고 최신 글부터 이어서 한다

방식: 한 호출에 레시피 12건을 묶는다(무료 티어의 병목은 하루 호출 약 500회). 한도는 지킨다:
  --daily-limit  하루 최대 처리 레시피 수(기본 1500, 로컬 기록 파일로 하루 안의 여러 번 실행을 합산)
  --rpm          분당 호출 상한(기본 8)
429·키 오류·할당량 초과가 나면 **우회하지 않고 즉시 정상 종료**(종료 코드 0, 요약 JSON 의 stopped)한다 —
매일 배치를 절대 막지 않는다. 그때까지 저장한 건 남아 있고 다음 실행이 이어서 한다.
처리 안 된 글 + (처리 뒤 재추출로) 재료가 바뀐 글이 대상이다. 결과 CSV 는 `ingredient_management/outputs/` 에 쌓인다.
"""
import argparse
import csv
import json
import os
import sys
import time
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, 'backend'))

from db_env import connect, _load_env  # noqa: E402

_load_env()
import recipe_substitutes as rs  # noqa: E402
import recipe_substitutes_runner as rr  # noqa: E402

OUT_DIR = rr.OUT_DIR


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument('--dry-run', action='store_true', help='DB 에 쓰지 않고 CSV 만(기본)')
    mode.add_argument('--commit', action='store_true', help='recipe_substitutes 에 저장(운영 DB 쓰기)')
    ap.add_argument('--limit', type=int, default=0, help='이번 실행에서 처리할 최대 건수(0 = 하루 한도까지)')
    ap.add_argument('--daily-limit', type=int, default=rr.DEFAULT_DAILY_LIMIT, help='하루 최대 처리 레시피 수')
    ap.add_argument('--resume', action='store_true', help='(호환용) 처리한 건 건너뛰기는 늘 켜져 있다')
    ap.add_argument('--random', action='store_true', help='무작위 표본(dry-run 은 기본으로 켠다)')
    ap.add_argument('--no-random', action='store_true', help='dry-run 에서도 최신 글부터(한도 로직 확인용)')
    ap.add_argument('--seed', type=int, default=20261107)
    ap.add_argument('--order', choices=['recent', 'id'], default='recent', help='recent = 최신 글부터(보이는 쪽부터)')
    ap.add_argument('--start-after-id', type=int, default=0)
    ap.add_argument('--ids', type=int, nargs='*', help='이 recipe_id 들만')
    ap.add_argument('--since-days', type=int, default=0, help='AI 재료 확정이 이 일수 안인 글만(0 = 전부)')
    ap.add_argument('--batch-size', type=int, default=rs.BATCH_SIZE, help='한 호출에 묶는 레시피 수')
    ap.add_argument('--rpm', type=int, default=rr.DEFAULT_RPM, help='분당 호출 상한')
    ap.add_argument('--max-minutes', type=int, default=0, help='이 시간(분)이 지나면 정상 종료(0 = 제한 없음)')
    ap.add_argument('--concurrency', type=int, default=1, help=argparse.SUPPRESS)   # 옛 옵션(무시): 한도를 지키려고 순차 호출만 한다
    ap.add_argument('--model', default=None)
    args = ap.parse_args()
    commit = args.commit
    rand = args.random or (not commit and not args.no_random and not args.ids)

    key = rs.pick_key()
    if not key:
        print('GEMINI_API_KEY 가 없습니다(backend/.env).')
        return 0 if commit else 2
    model = args.model or rs.default_model()
    args.rpm = min(args.rpm, 12)   # 무료 한도(분당 15)를 넘지 않게 상한

    conn = connect()
    state_file = rr.state_path(not commit)
    st = rr.load_state(state_file)
    remaining_today = max(0, args.daily_limit - st['recipes'])
    want = min(args.limit, remaining_today) if args.limit else remaining_today
    rows, info = rr.plan_pending(conn, want=want or 1, order=args.order, rand=rand, seed=args.seed, ids=args.ids,
                                 start_after_id=args.start_after_id, since_days=args.since_days)
    if want <= 0:
        rows = []   # 오늘 몫을 다 썼다 — 본문은 가져오지 않고 진행률만 보고 끝낸다
    print(f'진행 {info["done"]}/{info["total_ready"]}건 처리됨 · 남은 대상 {info["pending_total"]}건'
          f'(재료가 바뀐 재처리 {info["stale"]}건 포함) · 오늘 {st["recipes"]}/{args.daily_limit}건 사용 · '
          f'이번 실행 {len(rows)}건 · 모델 {model} · 묶음 {args.batch_size}건 · 분당 {args.rpm}회 · '
          f'{"저장(--commit)" if commit else "미리보기(DB 쓰기 없음)"}', flush=True)
    if not rows:
        reason = 'daily_limit' if remaining_today <= 0 else None
        print(json.dumps({'mode': 'commit' if commit else 'dryrun', 'recipes': 0, 'stopped': reason,
                          'progress': {'done': info['done'], 'total': info['total_ready']}}, ensure_ascii=False))
        return 0
    if commit:
        rs.ensure_table(conn)

    os.makedirs(OUT_DIR, exist_ok=True)
    stamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    tag = 'commit' if commit else 'dryrun'
    csv_path = os.path.join(OUT_DIR, f'recipe_substitutes_{tag}_{stamp}.csv')
    fh = open(csv_path, 'w', encoding='utf-8-sig', newline='')
    w = csv.writer(fh)
    w.writerow(['recipe_id', 'title', 'ingredient', 'substitutes', 'ok', 'batch', 'batch_size', 'reason', 'raw_answer'])
    raw_seen = set()

    def on_result(rec):
        r = rec['recipe']
        raw = ''
        if rec['batch'] not in raw_seen and rec.get('raw'):
            raw_seen.add(rec['batch'])
            raw = rec['raw'].replace('\n', ' // ')
        if not rec['ok']:
            w.writerow([r['id'], r['title'], '(건너뜀)', '', 0, rec['batch'], rec['n'], rec['reason'], raw])
        elif rec['result']:
            for ing, subs in rec['result'].items():
                w.writerow([r['id'], r['title'], ing,
                            ' | '.join(s['name'] + (f"({s['note']})" if s['note'] else '') for s in subs),
                            1, rec['batch'], rec['n'], '', raw])
                raw = ''
        else:
            w.writerow([r['id'], r['title'], '(대체 없음)', '', 1, rec['batch'], rec['n'], '', raw])
        fh.flush()

    sm = rr.run(rows, key=key, model=model, commit=commit, conn=conn if commit else None, rpm=args.rpm,
                batch_size=args.batch_size, daily_limit=args.daily_limit, state_file=state_file,
                on_result=on_result, max_minutes=args.max_minutes)
    fh.close()
    sm.update({'mode': tag, 'model': model, 'csv': csv_path,
               'progress': {'done': info['done'] + (sm['ok'] if commit else 0), 'total': info['total_ready'],
                            'remaining': info['pending_total'] - (sm['ok'] if commit else 0)},
               'price_note': f'입력 ${rs.PRICE_IN_PER_M}/1M, 출력(생각 포함) ${rs.PRICE_OUT_PER_M}/1M — 제3자 가격표 기준 추정 '
                             f'(무료 티어라 실제 청구는 0원)'})
    sm.pop('batch_sizes', None)
    with open(csv_path.replace('.csv', '_summary.json'), 'w', encoding='utf-8') as f:
        json.dump(sm, f, ensure_ascii=False, indent=2)
    print(json.dumps(sm, ensure_ascii=False, indent=2))
    p = sm['progress']
    print(f'[대체 재료] 진행 {p["done"]}/{p["total"]} · 이번 {sm["ok"]}건 {"저장" if commit else "처리(DB 쓰기 없음)"} · 호출 {sm["calls"]} · '
          f'건너뜀 {sum(sm["skipped"].values())}{" · 중단=" + sm["stopped"] if sm["stopped"] else ""}', flush=True)
    # 429·키 오류·할당량·연속 실패여도 0 — 매일 배치(수집 파이프라인)를 막지 않는다. 사유는 stopped 에 있다.
    return 0


if __name__ == '__main__':
    sys.exit(main())
