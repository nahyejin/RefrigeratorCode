"""지난 미리보기 CSV 에 있는 **사전에 없어 버려진 이름**을 어드민 표로 옮긴다.

왜 필요한가:
    `ingredient_management/llm_ingredient_extraction.py` 는 레시피 본문에서 LLM 이
    뽑은 이름 중 사전에 없는 것을 버리고, 그 목록을 미리보기 CSV 에만 남겨 왔다.
    로컬 파일이라 어드민 화면에서는 안 보였고, 그래서 "사전에 없던 이름" 목록에는
    **사진에서 읽힌 수십 건만** 떴다. 정작 물량은 레시피 본문 쪽이다(누적 8만 회 이상).

    앞으로 도는 배치는 스스로 표에 쌓지만, **이미 지나간 45,334건**은 이 스크립트로
    한 번 옮겨야 한다.

쓰는 법:
    python scripts/backfill_recipe_misses.py            # 미리보기
    python scripts/backfill_recipe_misses.py --write    # 실제로 넣기
"""

import argparse
import csv
import glob
import io
import os
from collections import Counter

import pymysql

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREVIEW_GLOB = os.path.join(ROOT, "ingredient_management", "llm_used_ingredients_preview_*.csv")

# 이름 같지 않은 것은 넣지 않는다 (backend/app.py 의 사진 인식 쪽과 같은 규칙).
_NOT_A_NAME = ("{", "}", "[", "]", '"', "':")


def looks_like_name(text):
    text = (text or "").strip()
    return bool(text) and len(text) <= 40 and not any(m in text for m in _NOT_A_NAME)


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
    parser.add_argument("--write", action="store_true", help="실제로 표에 넣는다")
    parser.add_argument("--min-hits", type=int, default=1,
                        help="이 횟수 미만은 건너뛴다 (기본 1 = 전부)")
    args = parser.parse_args()

    load_env()

    files = sorted(glob.glob(PREVIEW_GLOB))
    if not files:
        print("미리보기 CSV 가 없습니다:", PREVIEW_GLOB)
        return 1

    # CSV 한 칸에 본문 미리보기가 들어 있어 기본 한도를 넘는다.
    csv.field_size_limit(10 ** 7)

    counter = Counter()
    recipes = set()
    for path in files:
        with io.open(path, encoding="utf-8-sig", newline="") as f:
            for row in csv.DictReader(f):
                rid = (row.get("id") or "").strip()
                if rid:
                    recipes.add(rid)
                for name in (row.get("unmapped_ingredients") or "").split(","):
                    name = name.strip()
                    if looks_like_name(name):
                        counter[name] += 1

    items = [(n, c) for n, c in counter.items() if c >= args.min_hits]
    items.sort(key=lambda x: -x[1])

    print(f"미리보기 CSV {len(files)}개 · 레시피 {len(recipes):,}건")
    print(f"사전에 없어 버려진 이름 {len(items):,}종 / {sum(c for _, c in items):,}회")
    print("\n많이 나온 15개:")
    for name, count in items[:15]:
        print(f"  {count:6,}  {name}")

    if not args.write:
        print("\n미리보기입니다. 실제로 넣으려면 --write 를 붙이세요.")
        return 0

    conn = db()
    try:
        cursor = conn.cursor()
        cursor.execute("SHOW TABLES LIKE 'ingredient_dictionary_misses'")
        if not cursor.fetchone():
            print("표가 아직 없습니다. 서버를 한 번 띄워 표를 만든 뒤 다시 실행하세요.")
            return 1
        cursor.execute("SHOW COLUMNS FROM ingredient_dictionary_misses LIKE 'recipe_hits'")
        if not cursor.fetchone():
            cursor.execute(
                "ALTER TABLE ingredient_dictionary_misses "
                "ADD COLUMN recipe_hits INT NOT NULL DEFAULT 0"
            )
            conn.commit()

        # 다시 돌려도 두 번 더해지지 않도록 **덮어쓴다**.
        # 이 스크립트는 지나간 CSV 전체를 다시 세므로, 더하면 실행할 때마다 부풀어
        # 오른다. 앞으로 도는 배치는 그날 몫만 더한다(거긴 더하는 게 맞다).
        cursor.executemany(
            """
            INSERT INTO ingredient_dictionary_misses
                (raw_name, hit_count, recipe_hits, last_mode, first_seen, last_seen)
            VALUES (%s, 0, %s, 'recipe', NOW(), NOW())
            ON DUPLICATE KEY UPDATE
                recipe_hits = VALUES(recipe_hits),
                last_seen = NOW()
            """,
            [(name[:255], count) for name, count in items],
        )
        conn.commit()
    finally:
        conn.close()

    print(f"\n{len(items):,}종을 어드민 '사전' 탭에 넣었습니다.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
