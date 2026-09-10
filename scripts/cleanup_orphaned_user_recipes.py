# -*- coding: utf-8 -*-
"""레시피가 지워지면, 그 레시피를 가리키던 사용자 데이터도 같이 지운다.

왜 필요한가:
    `recipes` 를 지우는 자리가 여러 곳이다 — 크롤러 3개의 당일 저품질 정리,
    `llm_ingredient_extraction.py` 의 "재료 둘 다 비어 있으면 삭제", 오래된
    레시피 정리(`cleanup_old_recipes.py`), 수동 정리(`delete_single_ingredient_
    recipes.py`). 그런데 `user_favorite_recipes`/`user_recorded_recipes`/
    `user_completed_recipes` 는 `recipe_id` 에 외래키가 없어서(FK 제약 없음),
    레시피를 지워도 그 레시피를 가리키던 즐겨찾기·기록·완료 행이 그대로
    남는다. 화면에는 있는데 눌러도 없는 레시피가 뜨는 원인이었다.

쓰는 법:
    python scripts/cleanup_orphaned_user_recipes.py            # 미리보기
    python scripts/cleanup_orphaned_user_recipes.py --write    # 실제로 지움

다른 스크립트에서 쓰는 법:
    `DELETE FROM recipes ...` 를 커밋하기 **전에** 같은 커넥션의 커서로
    `cleanup_with_cursor(cursor)` 를 불러 준다. 그러면 레시피 삭제와 사용자
    데이터 정리가 한 트랜잭션으로 묶인다.
"""

import argparse
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

ORPHAN_TABLES = ("user_favorite_recipes", "user_recorded_recipes", "user_completed_recipes")


def cleanup_with_cursor(cursor):
    """더 이상 존재하지 않는 recipe_id 를 가리키는 행을 지운다. 커밋은 호출자 몫."""
    removed = {}
    for table in ORPHAN_TABLES:
        cursor.execute(
            f"DELETE t FROM {table} t LEFT JOIN recipes r ON t.recipe_id = r.id "
            "WHERE r.id IS NULL"
        )
        removed[table] = cursor.rowcount
    return removed


def _load_env():
    for path in (os.path.join(ROOT, "backend", ".env"), os.path.join(ROOT, ".env")):
        if not os.path.exists(path):
            continue
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip())


def _db():
    import pymysql
    return pymysql.connect(
        host=os.getenv("DB_HOST") or "caboose.proxy.rlwy.net",
        user=os.getenv("DB_USER") or "root",
        password=os.getenv("DB_PASSWORD") or "",
        db=os.getenv("DB_NAME") or "railway",
        port=int(os.getenv("DB_PORT") or 47779),
        charset="utf8mb4",
        connect_timeout=30,
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true", help="실제로 지운다 (기본은 미리보기)")
    args = ap.parse_args()

    _load_env()
    db = _db()
    cursor = db.cursor()
    try:
        if args.write:
            removed = cleanup_with_cursor(cursor)
            db.commit()
            for table, n in removed.items():
                print(f"{table}: {n}건 삭제")
        else:
            for table in ORPHAN_TABLES:
                cursor.execute(
                    f"SELECT COUNT(*) FROM {table} t LEFT JOIN recipes r ON t.recipe_id = r.id "
                    "WHERE r.id IS NULL"
                )
                n = cursor.fetchone()[0]
                print(f"{table}: {n}건 (미리보기 — 지우려면 --write)")
    finally:
        cursor.close()
        db.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
