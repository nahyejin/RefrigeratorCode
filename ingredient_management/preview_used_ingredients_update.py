"""
새 used_ingredients 추출 로직을 DB에 반영하기 전에 CSV로 미리보기.

예:
  python -u ingredient_management/preview_used_ingredients_update.py --limit 1000
  python -u ingredient_management/preview_used_ingredients_update.py --limit 1000 --order recent
"""

import argparse
import csv
import os
import sys
from datetime import datetime

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - optional local dependency
    load_dotenv = None

_PROJECT_ROOT_FOR_IMPORT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _PROJECT_ROOT_FOR_IMPORT not in sys.path:
    sys.path.append(_PROJECT_ROOT_FOR_IMPORT)

from ingredient_management.update_used_ingredients_batch import (
    _PROJECT_ROOT,
    _connect_db,
    _used_ingredient_token_set,
    recompute_recipe_row,
)


def _load_env_files():
    if load_dotenv is None:
        return
    load_dotenv(os.path.join(_PROJECT_ROOT, "backend", ".env"))
    load_dotenv(os.path.join(_PROJECT_ROOT, ".env"))


def _default_output_path(limit):
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"used_ingredients_preview_{limit}_{stamp}.csv"
    return os.path.join(_PROJECT_ROOT, "ingredient_management", filename)


def _token_diff(old_used, new_used):
    old_set = _used_ingredient_token_set(old_used)
    new_set = _used_ingredient_token_set(new_used)
    return (
        old_set != new_set,
        ",".join(sorted(new_set - old_set)),
        ",".join(sorted(old_set - new_set)),
    )


def _preview_text(text, limit=700):
    text = (text or "").replace("\r\n", "\n").replace("\r", "\n")
    return text[:limit]


def _select_sql(order):
    order_clause = "id DESC" if order == "recent" else "id ASC"
    return f"""
        SELECT
            id,
            title,
            link,
            platform,
            used_ingredients,
            used_ingredients_block,
            block_reason,
            content
        FROM recipes
        ORDER BY {order_clause}
        LIMIT %s OFFSET %s
    """


def write_preview_csv(*, limit, offset, order, output_path, only_changed):
    _load_env_files()

    conn = _connect_db(read_timeout_sec=120)
    cursor = conn.cursor()
    written = 0
    scanned = 0

    fieldnames = [
        "id",
        "title",
        "platform",
        "link",
        "changed",
        "added_ingredients",
        "removed_ingredients",
        "old_used_ingredients",
        "new_used_ingredients",
        "old_block_reason",
        "new_block_reason",
        "old_used_ingredients_block",
        "new_used_ingredients_block",
        "content_preview",
        "old_block_preview",
        "new_block_preview",
    ]

    try:
        cursor.execute(_select_sql(order), (limit, offset))
        rows = cursor.fetchall()

        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()

            for row in rows:
                scanned += 1
                new_used, new_block, new_reason = recompute_recipe_row(row.get("content") or "")
                changed, added, removed = _token_diff(row.get("used_ingredients"), new_used)

                if only_changed and not changed:
                    continue

                writer.writerow(
                    {
                        "id": row.get("id"),
                        "title": row.get("title"),
                        "platform": row.get("platform"),
                        "link": row.get("link"),
                        "changed": "Y" if changed else "N",
                        "added_ingredients": added,
                        "removed_ingredients": removed,
                        "old_used_ingredients": row.get("used_ingredients"),
                        "new_used_ingredients": new_used,
                        "old_block_reason": row.get("block_reason"),
                        "new_block_reason": new_reason,
                        "old_used_ingredients_block": row.get("used_ingredients_block"),
                        "new_used_ingredients_block": new_block,
                        "content_preview": _preview_text(row.get("content")),
                        "old_block_preview": _preview_text(row.get("used_ingredients_block")),
                        "new_block_preview": _preview_text(new_block),
                    }
                )
                written += 1
    finally:
        cursor.close()
        conn.close()

    return scanned, written, output_path


def main():
    parser = argparse.ArgumentParser(
        description="새 used_ingredients 추출 결과를 DB 업데이트 없이 CSV로 미리보기"
    )
    parser.add_argument("--limit", type=int, default=1000, help="미리보기할 recipes 행 수")
    parser.add_argument("--offset", type=int, default=0, help="ORDER BY 이후 건너뛸 행 수")
    parser.add_argument(
        "--order",
        choices=["id", "recent"],
        default="id",
        help="id=오래된 순, recent=최근 id 순",
    )
    parser.add_argument("--output", help="CSV 저장 경로")
    parser.add_argument(
        "--only-changed",
        action="store_true",
        help="새 결과가 기존 used_ingredients와 다른 행만 저장",
    )
    args = parser.parse_args()

    output_path = args.output or _default_output_path(args.limit)
    scanned, written, output_path = write_preview_csv(
        limit=args.limit,
        offset=args.offset,
        order=args.order,
        output_path=output_path,
        only_changed=args.only_changed,
    )

    print(f"완료. 읽은 행: {scanned}, CSV 저장 행: {written}")
    print(f"저장 위치: {output_path}")


if __name__ == "__main__":
    main()
