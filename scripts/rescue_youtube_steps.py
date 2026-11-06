"""조리 순서가 없는 유튜브 글을 **자막으로 구제**한다(2026-11-06).

    python scripts\\rescue_youtube_steps.py                 # 시험: 20건을 처리해 보되 DB 에는 쓰지 않는다(dry-run)
    python scripts\\rescue_youtube_steps.py --limit 300 --commit   # 300건 처리하고 DB 에 반영
    python scripts\\rescue_youtube_steps.py --ids 3620 1413        # 특정 글만

하는 일: 조리 순서(`cook_steps`)가 빈 유튜브 글마다 ① 한국어 자막(자동 생성 포함)을 가져와 ② 영상 설명 + 자막을 기존 AI 추출
(`llm_ingredient_extraction.GeminiExtractor`)에 넣어 ③ 조리 순서가 2단계 이상 나오면 `cook_steps`·`ingredients_detail` 을 채운다
(이미 값이 있는 행은 건드리지 않는다). **삭제는 하지 않는다** — 실패한 글은 목록(CSV)에만 남는다.

- **천천히**: 자막 요청 사이 `--delay` 초(기본 8초) 쉰다. 유튜브가 막으면(`IpBlocked`) 그 자리에서 멈추고, 다음 실행이 이어서 한다.
- **기록**: `ingredient_management/outputs/youtube_rescue_log.csv` 에 글마다 결과(ok/disabled/no_korean/…)를 남긴다. 끝난 결과(성공·자막 없음 등)는
  다음 실행에서 건너뛰고, 막힘·AI 일시 오류는 다시 시도한다. 처음부터 다시 하려면 이 파일을 지운다.
- DB 접속은 `backend/.env`(`db_env`)에서만 읽는다. 이 글들은 사용자 기록(즐겨찾기 등)에 쓰이는 것도 있어 삭제는 목록을 본 뒤 따로 정한다.
"""
import argparse
import csv
import os
import sys
import time
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

import pymysql  # noqa: E402
from dotenv import load_dotenv  # noqa: E402

from db_env import db_settings  # noqa: E402
from ingredient_management import llm_ingredient_extraction as lie  # noqa: E402
from ingredient_management import youtube_transcript as yt  # noqa: E402

LOG = os.path.join(ROOT, 'ingredient_management', 'outputs', 'youtube_rescue_log.csv')
# 끝난 결과 — 다음 실행에서 다시 하지 않는다. (blocked·llm_error 는 다시 시도)
TERMINAL = {'ok', 'ok_dry', 'disabled', 'no_korean', 'unavailable', 'too_short', 'no_steps', 'not_recipe', 'multi', 'no_video_id'}


def load_done():
    done = set()
    if os.path.exists(LOG):
        with open(LOG, encoding='utf-8-sig', newline='') as f:
            for r in csv.DictReader(f):
                if r.get('status') in TERMINAL and not (r.get('status') == 'ok_dry'):
                    done.add(int(r['id']))
    return done


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--limit', type=int, default=20)
    ap.add_argument('--delay', type=float, default=yt.MIN_INTERVAL_SEC)
    ap.add_argument('--commit', action='store_true', help='DB 에 반영(없으면 시험만)')
    ap.add_argument('--ids', type=int, nargs='*')
    args = ap.parse_args()
    yt.MIN_INTERVAL_SEC = max(args.delay, 3.0)  # 너무 빠르게는 못 하게

    load_dotenv(os.path.join(ROOT, 'backend', '.env'))
    key = (os.getenv('GEMINI_API_KEY') or '').strip()
    if not key:
        raise SystemExit('GEMINI_API_KEY 가 필요합니다 (backend/.env).')
    extractor = lie.GeminiExtractor(key, rpm=30)

    conn = pymysql.connect(**{**db_settings(), 'charset': 'utf8mb4', 'cursorclass': pymysql.cursors.DictCursor,
                              'read_timeout': 120, 'connect_timeout': 30})
    cur = conn.cursor()
    if args.ids:
        cur.execute("SELECT id, title, link, content FROM recipes WHERE id IN (%s)" % ','.join(['%s'] * len(args.ids)), args.ids)
    else:
        done = load_done()
        cur.execute("SELECT id, title, link, content FROM recipes WHERE platform LIKE 'youtube%' "
                    "AND (cook_steps IS NULL OR cook_steps='') ORDER BY id")
    rows = cur.fetchall()
    if not args.ids:
        rows = [r for r in rows if r['id'] not in done][:args.limit]
    print(f"처리할 글 {len(rows)}건 ({'DB 반영' if args.commit else '시험(DB 안 씀)'}), 요청 간격 {yt.MIN_INTERVAL_SEC:.0f}초")

    os.makedirs(os.path.dirname(LOG), exist_ok=True)
    new_file = not os.path.exists(LOG)
    logf = open(LOG, 'a', encoding='utf-8-sig', newline='')
    w = csv.writer(logf)
    if new_file:
        w.writerow(['id', 'ts', 'status', 'steps', 'title'])

    counts = {}

    def log(row, status, steps=0):
        counts[status] = counts.get(status, 0) + 1
        w.writerow([row['id'], datetime.now().isoformat(timespec='seconds'), status, steps, (row['title'] or '')[:60]])
        logf.flush()
        print(f"  [{row['id']}] {status}{f' {steps}단계' if steps else ''}  {(row['title'] or '')[:30]}", flush=True)

    stopped = None
    for row in rows:
        if extractor.quota_exhausted:
            stopped = 'AI 일일 한도 소진'
            break
        try:
            text, reason = yt.fetch_korean_transcript(row['link'])
        except yt.TranscriptBlocked:
            log(row, 'blocked')
            stopped = '유튜브가 요청을 막음(잠시 뒤 다시 실행)'
            break
        if text is None:
            log(row, reason if reason in TERMINAL else 'error')
            continue
        res, err = extractor.extract(yt.build_content(row['content'], text))
        if err:
            log(row, 'llm_error')
            continue
        if res.get('not_recipe'):
            log(row, 'multi' if res.get('reason') == 'multi_recipe' else 'not_recipe')
            continue
        steps, detail = res.get('steps') or [], res.get('detail') or []
        if len(steps) < 2:
            log(row, 'no_steps')
            continue
        if args.commit:
            cur.execute("UPDATE recipes SET cook_steps=%s, ingredients_detail=COALESCE(NULLIF(ingredients_detail,''), %s) "
                        "WHERE id=%s AND (cook_steps IS NULL OR cook_steps='')",
                        ("\n".join(steps), "\n".join(detail) if detail else None, row['id']))
            conn.commit()
            log(row, 'ok', len(steps))
        else:
            log(row, 'ok_dry', len(steps))

    logf.close()
    conn.close()
    print('\n결과:', counts)
    if stopped:
        print('중단:', stopped)


if __name__ == '__main__':
    main()
