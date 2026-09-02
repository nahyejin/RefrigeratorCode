"""재료가 **하나뿐인** 레시피를 지운다.

왜 지우나:
    재료가 하나로 나온 글은 대개 레시피가 아니다. 표본을 보면
    `새송이버섯 보관법`, `밤보관방법`, `아보카도 오일 활용법`, `CU 신상 후기`
    처럼 **그 재료에 대한 글**이거나 제품 홍보다.

    진짜 레시피인데 추출이 실패해서 하나만 남은 경우도 섞여 있다. 그래도 지우는 게
    맞다 — 재료가 하나면 어차피 매칭에 못 쓰인다(재료 3개 이하는 추천에서 빠진다).
    남겨 둬야 자리만 차지하고, 매일 도는 배치가 계속 다시 훑는다.

    재료 0개는 이미 배치가 지운다(`llm_ingredient_extraction.py`). 이 스크립트는
    **이미 쌓여 있는 1개짜리**를 한 번 치우기 위한 것이고, 앞으로 들어오는 것은
    배치가 알아서 지운다.

왜 2개는 안 지우나:
    2개는 애매하다. `계란 + 소금` 처럼 진짜 간단한 레시피가 있다. 지금은 건드리지
    않고, 필요하면 `--max 2` 로 직접 돌린다.

쓰는 법:
    python scripts/delete_single_ingredient_recipes.py            # 미리보기 + 백업
    python scripts/delete_single_ingredient_recipes.py --write    # 실제로 삭제
"""

import argparse
import csv
import io
import os

from datetime import datetime

import pymysql

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 재료 개수 = 콤마 개수 + 1. 빈 값은 0 으로 본다.
COUNT_SQL = """
    CASE WHEN used_ingredients IS NULL OR TRIM(used_ingredients) = '' THEN 0
         ELSE CHAR_LENGTH(used_ingredients)
              - CHAR_LENGTH(REPLACE(used_ingredients, ',', '')) + 1 END
"""


def load_env():
    for path in (os.path.join(ROOT, "backend", ".env"), os.path.join(ROOT, ".env")):
        if not os.path.exists(path):
            continue
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    os.environ.setdefault(key.strip(), value.strip())


def db():
    return pymysql.connect(
        host=os.getenv("DB_HOST") or "caboose.proxy.rlwy.net",
        user=os.getenv("DB_USER") or "root",
        password=os.getenv("DB_PASSWORD") or "",
        db=os.getenv("DB_NAME") or "railway",
        port=int(os.getenv("DB_PORT") or 47779),
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        # 서버 시계가 UTC 라 세션 타임존을 KST 로 고정한다(backend/app.py 와 동일).
        init_command="SET time_zone = '+09:00'",
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true", help="실제로 삭제한다")
    parser.add_argument("--max", type=int, default=1,
                        help="재료가 이 개수 이하인 것을 지운다 (기본 1)")
    parser.add_argument("--backup-dir", default=None,
                        help="백업 CSV 를 둘 곳 (기본: 저장소 밖 임시 폴더)")
    args = parser.parse_args()

    load_env()
    conn = db()
    try:
        cursor = conn.cursor()
        cursor.execute(
            f"SELECT id, title, link, platform, used_ingredients, collected_at "
            f"FROM recipes WHERE {COUNT_SQL} BETWEEN 1 AND %s ORDER BY id",
            (args.max,),
        )
        rows = cursor.fetchall()
    finally:
        conn.close()

    if not rows:
        print(f"재료 {args.max}개 이하인 레시피가 없습니다.")
        return 0

    print(f"재료 {args.max}개 이하 레시피: {len(rows):,}건")
    print("\n앞에서 10건:")
    for r in rows[:10]:
        print(f"  {r['id']:>7}  {(r['title'] or '')[:44]:<44}  ← {r['used_ingredients']}")

    # 지우기 전에 **항상** 남긴다. 지운 뒤에 "그거 뭐였지" 를 물어볼 수 없다.
    backup_dir = args.backup_dir or os.environ.get("TEMP") or "."
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup = os.path.join(backup_dir, f"deleted_recipes_{args.max}ing_{stamp}.csv")
    with io.open(backup, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(
            f, fieldnames=["id", "title", "link", "platform", "used_ingredients", "collected_at"]
        )
        writer.writeheader()
        for r in rows:
            writer.writerow({**r, "collected_at": str(r["collected_at"] or "")})
    print(f"\n백업: {backup}")

    if not args.write:
        print("미리보기입니다. 실제로 지우려면 --write 를 붙이세요.")
        return 0

    conn = db()
    try:
        cursor = conn.cursor()
        ids = [r["id"] for r in rows]
        # 한 번에 다 보내면 쿼리가 너무 길어진다. 나눠서 지운다.
        removed = 0
        for i in range(0, len(ids), 500):
            chunk = ids[i:i + 500]
            marks = ",".join(["%s"] * len(chunk))
            cursor.execute(f"DELETE FROM recipes WHERE id IN ({marks})", tuple(chunk))
            removed += cursor.rowcount
        conn.commit()
    finally:
        conn.close()

    print(f"{removed:,}건을 지웠습니다.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
