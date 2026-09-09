# -*- coding: utf-8 -*-
"""**재료 → 레시피 역색인**을 만든다. 냉장고요리가 느린 근본 원인을 없앤다.

지금 무슨 일이 벌어지나:
    `/api/recipes/filter` 는 매칭률을 **행마다 계산**한다. 레시피 4만여 개
    하나하나에 대해

        REGEXP 한 번  +  FIND_IN_SET 을 냉장고 재료 수만큼  +  REPLACE 사슬

    을 돌린다. 재료가 14개면 42,000 x 15 = **63만 번**이다. 게다가 그 값으로
    정렬까지 하니 전부 계산해야 끝난다. `used_ingredients` 는 쉼표로 이어 붙인
    글자라 **인덱스를 탈 수가 없다** — 실측 2.5~7초가 여기서 나온다.

    쿼리를 다듬어서는 못 없앤다. 자료 구조를 바꿔야 한다.

무엇을 만드나:
    `recipe_ingredient(ingredient, recipe_id, weight)` — 한 레시피의 재료
    하나가 한 줄이다. `(ingredient, recipe_id)` 를 기본 키로 두면 "이 재료를
    쓰는 레시피" 를 인덱스로 바로 찾는다.

        SELECT recipe_id, SUM(weight) FROM recipe_ingredient
        WHERE ingredient IN (내 재료들) GROUP BY recipe_id

    이러면 **내 재료가 실제로 들어간 줄만** 훑는다. 4만 개 전체가 아니라.

    분모(그 레시피의 총 가중치)는 `recipes.ing_weight_total` 에 미리 넣어 둔다.
    매칭률 = 맞은 가중치 / 총 가중치.

가중치:
    조미료 0.3, 나머지 1.0 — `backend/app.py` 와 **같은 규칙, 같은 목록**이어야
    한다. 다르면 서버 정렬과 카드에 뜨는 숫자가 갈라진다.

쓰는 법:
    python scripts/build_ingredient_index.py                  # 미리보기
    python scripts/build_ingredient_index.py --write          # 처음부터 다시 만든다
    python scripts/build_ingredient_index.py --write --new    # 새로 들어온 것만 (매일 배치)

`--new` 는 아직 색인에 없는 레시피(`ing_weight_total IS NULL`)만 손댄다. 매일
밤 크롤링·LLM 이 끝난 뒤에 이걸 돌리면, 그날 들어온 레시피가 색인에 붙는다.
전체를 다시 만드는 데는 몇 분이 걸리므로 매일 돌릴 것이 아니다.
"""

import argparse
import os
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
from apply_dictionary_additions import load_env, db  # noqa: E402

# `backend/app.py` 와 같은 값이어야 한다. 하나만 고치면 숫자가 갈라진다.
SEASONING_WEIGHT = 0.3
CORE_WEIGHT = 1.0
SEASONING_INGREDIENTS = {
    '소금', '후추', '설탕', '식용유', '참기름', '들기름', '맛술', '미림',
    '식초', '물', '간장', '올리고당', '굴소스', '다시다', '미원',
}

CHUNK = 2000


def weight_of(name):
    return SEASONING_WEIGHT if name in SEASONING_INGREDIENTS else CORE_WEIGHT


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--new", action="store_true",
                    help="아직 색인에 없는 레시피만 (매일 배치용)")
    args = ap.parse_args()
    load_env()

    conn = db()
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*) n FROM recipes WHERE llm_ingredients_at IS NOT NULL")
    total_recipes = cur.fetchone()["n"]
    print("대상 레시피 %d건" % total_recipes)

    if not args.write:
        cur.execute(
            "SELECT id, used_ingredients FROM recipes "
            "WHERE llm_ingredients_at IS NOT NULL LIMIT 2000")
        rows = cur.fetchall()
        pairs = sum(len([t for t in (r["used_ingredients"] or "").split(",") if t.strip()])
                    for r in rows)
        print("표본 %d건 기준 재료 줄 %d개 (레시피당 평균 %.1f개)"
              % (len(rows), pairs, pairs / max(1, len(rows))))
        print("전체로 치면 약 %d줄이 됩니다." % (pairs / max(1, len(rows)) * total_recipes))
        print("\n미리보기입니다. --write 를 붙이면 실제로 만듭니다.")
        conn.close()
        return 0

    t0 = time.time()

    # ── 어느 표에, 어느 레시피를 ──────────────────────────────────────
    #
    # 전체를 다시 만들 때는 `_new` 에 쌓았다가 마지막에 이름을 바꾼다 — 만드는
    # 동안에도 서비스는 옛 표를 그대로 쓴다.
    # 새로 들어온 것만 붙일 때는 그럴 필요가 없다. 이미 쓰고 있는 표에 바로 넣는다.
    table = "recipe_ingredient" if args.new else "recipe_ingredient_new"

    if args.new:
        cur.execute("SHOW TABLES LIKE 'recipe_ingredient'")
        if not cur.fetchone():
            print("색인이 아직 없습니다. --new 없이 한 번 만들어 주세요.")
            conn.close()
            return 1
        where = ("llm_ingredients_at IS NOT NULL AND "
                 "(ing_weight_total IS NULL OR ing_weight_total <= 0)")
    else:
        print("표를 만듭니다...")
        cur.execute("DROP TABLE IF EXISTS recipe_ingredient_new")
        # `(ingredient, recipe_id)` 순서가 중요하다. 우리가 묻는 것은 늘
        # "이 재료를 쓰는 레시피" 라서, 재료가 앞에 와야 인덱스를 탄다.
        cur.execute("""
            CREATE TABLE recipe_ingredient_new (
                ingredient VARCHAR(64) NOT NULL,
                recipe_id  INT NOT NULL,
                weight     DECIMAL(3,1) NOT NULL,
                PRIMARY KEY (ingredient, recipe_id),
                KEY idx_recipe (recipe_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """)
        where = "llm_ingredients_at IS NOT NULL"

    # `recipes` 에 분모를 담을 칸이 없으면 만든다.
    cur.execute("SHOW COLUMNS FROM recipes LIKE 'ing_weight_total'")
    if not cur.fetchone():
        print("recipes.ing_weight_total 칸을 만듭니다...")
        cur.execute("ALTER TABLE recipes ADD COLUMN ing_weight_total DECIMAL(6,1) NULL")
    conn.commit()

    # ── 채우기 ───────────────────────────────────────────────────────
    cur.execute("SELECT id, used_ingredients FROM recipes WHERE " + where)
    recipes = cur.fetchall()
    print("색인할 레시피 %d건" % len(recipes), flush=True)
    if not recipes and args.new:
        print("새로 붙일 것이 없습니다.")
        conn.close()
        return 0

    ids, pairs, seen_pairs = [], [], 0
    insert_sql = ("INSERT IGNORE INTO %s (ingredient, recipe_id, weight) "
                  "VALUES (%%s, %%s, %%s)" % table)

    if args.new:
        # 다시 돌려도 탈 나지 않게, 손댈 레시피의 옛 줄을 먼저 지운다.
        rid_all = [r["id"] for r in recipes]
        for i in range(0, len(rid_all), CHUNK):
            chunk = rid_all[i:i + CHUNK]
            cur.execute("DELETE FROM recipe_ingredient WHERE recipe_id IN (%s)"
                        % ",".join(["%s"] * len(chunk)), chunk)
        conn.commit()

    for r in recipes:
        rid = r["id"]
        ids.append(rid)
        names = []
        for tok in (r["used_ingredients"] or "").split(","):
            tok = tok.strip().replace(" ", "")
            if tok and tok not in names:      # 같은 재료가 두 번 적힌 글이 있다
                names.append(tok)
        if not names:
            continue
        for n in names:
            pairs.append((n[:64], rid, weight_of(n)))

        if len(pairs) >= CHUNK:
            cur.executemany(insert_sql, pairs)
            seen_pairs += len(pairs)
            pairs = []
            conn.commit()
            print("  재료 줄 %d개..." % seen_pairs, flush=True)

    if pairs:
        cur.executemany(insert_sql, pairs)
        seen_pairs += len(pairs)
        conn.commit()

    # ── 분모 ─────────────────────────────────────────────────────────
    #
    # 한 줄씩 `UPDATE` 를 보내면 42,000건에 몇십 분이 걸린다 — 왕복이 전부
    # 비용이다. 방금 만든 색인으로 서버 안에서 한 번에 합친다 (실측 36초).
    print("재료 줄 %d개 넣었습니다. 분모를 채웁니다..." % seen_pairs, flush=True)
    t1 = time.time()
    cur.execute("""
        UPDATE recipes r
        JOIN (SELECT recipe_id, SUM(weight) AS t FROM %s GROUP BY recipe_id) x
          ON x.recipe_id = r.id
        SET r.ing_weight_total = x.t
        WHERE %s
    """ % (table, "r.id IN (%s)" % ",".join(["%s"] * len(ids)) if args.new else "1=1"),
        ids if args.new else [])
    conn.commit()
    print("  %d행 · %.1f초" % (cur.rowcount, time.time() - t1), flush=True)

    # ── 갈아 끼우기 ──────────────────────────────────────────────────
    if not args.new:
        print("표를 갈아 끼웁니다...")
        cur.execute("SHOW TABLES LIKE 'recipe_ingredient'")
        if cur.fetchone():
            cur.execute("DROP TABLE IF EXISTS recipe_ingredient_old")
            cur.execute("RENAME TABLE recipe_ingredient TO recipe_ingredient_old, "
                        "recipe_ingredient_new TO recipe_ingredient")
            cur.execute("DROP TABLE recipe_ingredient_old")
        else:
            cur.execute("RENAME TABLE recipe_ingredient_new TO recipe_ingredient")
        conn.commit()

    cur.execute("SELECT COUNT(*) n FROM recipe_ingredient")
    lines = cur.fetchone()["n"]
    cur.execute("SELECT COUNT(*) n FROM recipes "
                "WHERE llm_ingredients_at IS NOT NULL AND "
                "(ing_weight_total IS NULL OR ing_weight_total <= 0)")
    left = cur.fetchone()["n"]
    print("\n완료: 재료 줄 %d개 · 분모 빈 레시피 %d건 · %.1f초"
          % (lines, left, time.time() - t0))
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
