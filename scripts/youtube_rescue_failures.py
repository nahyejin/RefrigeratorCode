"""유튜브 조리 순서 구제에 실패한 글 목록(CSV)을 만든다 — 읽기 전용(2026-11-12).

    python scripts\youtube_rescue_failures.py [출력.csv]

`youtube_rescue_log.csv` 에서 글마다 **가장 마지막 결과**를 보고, 끝난 실패(disabled/no_korean/unavailable/too_short/no_steps/not_recipe/multi/
no_video_id/error)인 글만 모은다. 지금도 DB 에서 조리 순서가 비어 있는 글만 남기고, 사용자 기록 표(즐겨찾기·완료·기록·식단·공유·가족 알림·쿠팡 클릭)에
연결된 건수를 붙인다. **삭제는 하지 않는다** — 사용자 판단용 목록이다.
"""
import csv
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

import pymysql  # noqa: E402

from db_env import db_settings  # noqa: E402

LOG = os.path.join(ROOT, 'ingredient_management', 'outputs', 'youtube_rescue_log.csv')
FAIL = {'disabled', 'no_korean', 'unavailable', 'too_short', 'no_steps', 'not_recipe', 'multi', 'no_video_id', 'error'}
LINKED = ['user_favorite_recipes', 'user_completed_recipes', 'user_recorded_recipes', 'user_meal_plans',
          'recipe_shares', 'family_action_notifications', 'coupang_clicks']


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'ingredient_management', 'outputs', 'youtube_rescue_failures_2026-11-12.csv')
    last = {}
    with open(LOG, encoding='utf-8-sig', newline='') as f:
        for r in csv.DictReader(f):
            last[int(r['id'])] = r['status']
    ids = [i for i, st in last.items() if st in FAIL]
    conn = pymysql.connect(**{**db_settings(), 'charset': 'utf8mb4', 'cursorclass': pymysql.cursors.DictCursor})
    cur = conn.cursor()
    rows = []
    for i in range(0, len(ids), 500):
        chunk = ids[i:i + 500]
        cur.execute("SELECT id, title, link FROM recipes WHERE id IN (%s) AND (cook_steps IS NULL OR cook_steps='')" % ','.join(['%s'] * len(chunk)), chunk)
        rows += cur.fetchall()
    by_id = {r['id']: r for r in rows}
    counts = {t: {} for t in LINKED}
    for t in LINKED:
        for i in range(0, len(by_id), 500):
            chunk = list(by_id)[i:i + 500]
            cur.execute("SELECT recipe_id, COUNT(*) c FROM `%s` WHERE recipe_id IN (%s) GROUP BY recipe_id" % (t, ','.join(['%s'] * len(chunk))), chunk)
            for r in cur.fetchall():
                counts[t][r['recipe_id']] = r['c']
    with open(out, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f)
        w.writerow(['id', 'title', 'reason', 'link', 'user_links_total'] + LINKED)
        summary = {}
        linked_recipes = 0
        for i in sorted(by_id):
            r = by_id[i]
            per = [counts[t].get(i, 0) for t in LINKED]
            w.writerow([i, r['title'], last[i], r['link'], sum(per)] + per)
            summary[last[i]] = summary.get(last[i], 0) + 1
            linked_recipes += 1 if sum(per[:5]) else 0
    print('실패 글', len(by_id), '건', summary)
    print('사용자 기록(즐겨찾기·완료·기록·식단·공유)에 연결된 글', linked_recipes, '건')
    for t in LINKED:
        print(' ', t, sum(counts[t].values()), '행 /', len(counts[t]), '글')
    print('->', out)


if __name__ == '__main__':
    main()
