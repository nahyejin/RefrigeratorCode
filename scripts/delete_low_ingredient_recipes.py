"""AI 가 판단한 재료가 3개 이하인 레시피를 DB 에서 지운다(2026-10-08 사용자 결정).

    python scripts/delete_low_ingredient_recipes.py            # 미리 보기만(아무것도 안 지움)
    python scripts/delete_low_ingredient_recipes.py --apply    # 백업을 남기고 실제로 지움
    python scripts/delete_low_ingredient_recipes.py --restore backups/low_ingredient_recipes_….json  # 되살림

- 대상: `llm_ingredients_at` 이 있고(AI 가 재료를 쓴 글) `used_ingredients` 가 3개 이하인 레시피.
  목록·검색·추천에서는 이미 `backend/recipe_visibility.py` 조건으로 빠져 있다 — 이 스크립트는 DB 정리용.
- **사용자가 이미 쓴 레시피는 건너뛴다**(완료·기록·즐겨찾기·식단 계획). 지우면 그 사람 기록에서 사라진다.
- 지우기 전에 `backups/low_ingredient_recipes_YYYYMMDD_HHMMSS.json` 에 레시피 행과 `recipe_ingredient`
  행을 통째로 남긴다(되살릴 때 쓴다). backups/ 는 저장소에 올리지 않는다.
"""
import argparse
import json
import os
import sys
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from db_env import connect  # noqa: E402

LOW = (
    "llm_ingredients_at IS NOT NULL AND ("
    " used_ingredients IS NULL OR used_ingredients = ''"
    " OR LENGTH(used_ingredients) - LENGTH(REPLACE(used_ingredients, ',', '')) <= 2)"
)
USED_BY = ["user_completed_recipes", "user_recorded_recipes", "user_favorite_recipes", "user_meal_plans"]


def restore(path):
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    conn = connect()
    cur = conn.cursor()
    try:
        for table in ("recipes", "recipe_ingredient"):
            for row in data.get(table, []):
                cols = list(row)
                cur.execute(
                    f"INSERT IGNORE INTO `{table}` ({','.join(f'`{c}`' for c in cols)}) VALUES ({','.join(['%s'] * len(cols))})",
                    [row[c] for c in cols],
                )
        conn.commit()
        print(f"되살림: 레시피 {len(data.get('recipes', []))}행, 재료 색인 {len(data.get('recipe_ingredient', []))}행")
    finally:
        conn.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="실제로 지운다(없으면 미리 보기만)")
    ap.add_argument("--restore", metavar="BACKUP_JSON", help="백업 파일로 되살린다")
    args = ap.parse_args()
    if args.restore:
        restore(args.restore)
        return

    conn = connect()
    cur = conn.cursor()
    cur.execute("SHOW TABLES")
    tables = {list(r.values())[0] for r in cur.fetchall()}
    keep_clauses = [f"id NOT IN (SELECT recipe_id FROM `{t}` WHERE recipe_id IS NOT NULL)" for t in USED_BY if t in tables]
    where = LOW + "".join(f" AND {c}" for c in keep_clauses)

    cur.execute(f"SELECT COUNT(*) n FROM recipes WHERE {LOW}")
    all_low = cur.fetchone()["n"]
    cur.execute(f"SELECT id, title, used_ingredients FROM recipes WHERE {where} ORDER BY id")
    targets = cur.fetchall()
    print(f"재료 3개 이하(AI 기준): {all_low}건 / 사용자가 쓴 글 {all_low - len(targets)}건은 건너뜀 / 지울 대상 {len(targets)}건")
    for r in targets[:10]:
        print(f"  {r['id']}  [{r['used_ingredients']}]  {r['title'][:40]}")
    if len(targets) > 10:
        print(f"  … 외 {len(targets) - 10}건")

    if not args.apply:
        print("\n미리 보기만 했어요. 실제로 지우려면 --apply 를 붙여 다시 실행하세요.")
        conn.close()
        return
    if not targets:
        conn.close()
        return

    ids = [r["id"] for r in targets]
    marks = ",".join(["%s"] * len(ids))
    cur.execute(f"SELECT * FROM recipes WHERE id IN ({marks})", ids)
    recipe_rows = cur.fetchall()
    ing_rows = []
    if "recipe_ingredient" in tables:
        cur.execute(f"SELECT * FROM recipe_ingredient WHERE recipe_id IN ({marks})", ids)
        ing_rows = cur.fetchall()

    os.makedirs(os.path.join(ROOT, "backups"), exist_ok=True)
    path = os.path.join(ROOT, "backups", f"low_ingredient_recipes_{datetime.now():%Y%m%d_%H%M%S}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"recipes": recipe_rows, "recipe_ingredient": ing_rows}, f, ensure_ascii=False, default=str)
    print(f"백업: {path} (레시피 {len(recipe_rows)}행, 재료 색인 {len(ing_rows)}행)")

    try:
        if "recipe_ingredient" in tables:
            cur.execute(f"DELETE FROM recipe_ingredient WHERE recipe_id IN ({marks})", ids)
        cur.execute(f"DELETE FROM recipes WHERE id IN ({marks})", ids)
        deleted = cur.rowcount
        conn.commit()
        print(f"지움: 레시피 {deleted}건")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
