# -*- coding: utf-8 -*-
"""냉장고요리 필터용 미리 센 표(`recipe_filter_terms`)를 만들고 처음 한 번 채운다.

왜: backend/filter_terms.py 맨 위 설명 참고 — 필터가 본문 194MB 를 매번 읽어 서버 메모리를 쓴다.

쓰는 법 (기본은 **읽기만** 한다 — 표를 만들지도 채우지도 않는다):
    python scripts/build_filter_terms.py                 # 계산만 해서 크기·시간을 보여 준다
    python scripts/build_filter_terms.py --commit        # 표를 만들고 아직 안 센 글을 전부 채운다(약 1~2분)
    python scripts/build_filter_terms.py --commit --rebuild   # 이미 센 글도 다시 센다(필터 낱말을 바꾼 뒤)
    python scripts/build_filter_terms.py --commit --prune     # 지워진 글의 줄을 정리한다

중간에 멈춰도 다시 실행하면 **안 센 글부터 이어서** 한다.
끝나면 서버(`filter_terms.table_ready`)가 1분 안에 알아채고 필터가 이 표를 쓰기 시작한다.
`--commit` 전에는 서버가 예전 방식(본문 LIKE)으로 동작하므로 순서는 상관없다.
"""

import argparse
import os
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, "backend"))

import pymysql  # noqa: E402

from db_env import db_settings  # noqa: E402
import filter_terms  # noqa: E402

BATCH = 400


def connect():
    st = db_settings()
    return pymysql.connect(**{**st, "charset": "utf8mb4", "cursorclass": pymysql.cursors.DictCursor,
                              "read_timeout": 300, "write_timeout": 300, "connect_timeout": 30})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--commit", action="store_true", help="표를 만들고 채운다(없으면 읽기만)")
    ap.add_argument("--rebuild", action="store_true", help="이미 센 글도 다시 센다")
    ap.add_argument("--prune", action="store_true", help="지워진 글의 줄을 정리한다")
    ap.add_argument("--limit", type=int, default=0, help="(시험용) 이 개수만 처리")
    args = ap.parse_args()

    vocab = filter_terms.load_vocab()
    print(f"필터 낱말 {len(vocab)}개 (Filter_Keywords.csv)")
    if not vocab:
        raise SystemExit("낱말을 못 읽었다 — frontend/public/Filter_Keywords.csv 확인")

    conn = connect()
    cur = conn.cursor()
    if args.commit:
        cur.execute(filter_terms.CREATE_SQL)
        conn.commit()
        print("표 확인/생성 완료:", filter_terms.TABLE)

    done_ids = set()
    if not args.rebuild:
        try:
            cur.execute(f"SELECT recipe_id FROM {filter_terms.TABLE} WHERE term = %s", (filter_terms.DONE_TERM,))
            done_ids = {r["recipe_id"] for r in cur.fetchall()}
        except pymysql.err.ProgrammingError:
            done_ids = set()  # 표가 아직 없다(읽기 전용 시험)
    print(f"이미 센 글 {len(done_ids)}건")

    last_id = 0
    seen = processed = pairs = 0
    t0 = time.time()
    while True:
        cur.execute("SELECT id, title, content FROM recipes WHERE id > %s ORDER BY id LIMIT %s", (last_id, BATCH))
        rows = cur.fetchall()
        if not rows:
            break
        last_id = rows[-1]["id"]
        todo = [r for r in rows if r["id"] not in done_ids]
        seen += len(rows)
        batch_rows = []
        for r in todo:
            batch_rows.extend(filter_terms.rows_for(r["id"], r["title"], r["content"]))
        processed += len(todo)
        pairs += len(batch_rows) - len(todo)  # 표식 줄 제외
        if args.commit and todo:
            ids = [r["id"] for r in todo]
            cur.execute(f"DELETE FROM {filter_terms.TABLE} WHERE recipe_id IN ({','.join(['%s'] * len(ids))})", ids)
            cur.executemany(
                f"INSERT INTO {filter_terms.TABLE} (term, recipe_id, cnt) VALUES (%s, %s, %s)", batch_rows)
            conn.commit()
        if seen % (BATCH * 10) == 0:
            print(f"  {seen}건 훑음 · {processed}건 처리 · {time.time() - t0:.0f}초", flush=True)
        if args.limit and processed >= args.limit:
            break

    print(f"\n끝: {seen}건 훑고 {processed}건 처리 · 낱말-글 짝 {pairs:,}개 · {time.time() - t0:.0f}초 · "
          f"{'저장함' if args.commit else '저장 안 함(--commit 이 없다)'}")

    if args.prune and args.commit:
        cur.execute(f"DELETE t FROM {filter_terms.TABLE} t LEFT JOIN recipes r ON r.id = t.recipe_id WHERE r.id IS NULL")
        conn.commit()
        print("지워진 글의 줄 정리:", cur.rowcount, "줄")
    conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
