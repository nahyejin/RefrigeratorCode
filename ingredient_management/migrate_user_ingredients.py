"""
사용자 냉장고 재료(user_ingredients.name)를 현재 사전의 대표어로 맞춘다.

왜 필요한가:
  냉장고 재료는 추가 시점의 대표어로 저장된다(MyFridge.tsx 가 ingredientDict 로
  변환). 그래서 나중에 사전에서 대표어가 바뀌면 저장된 값만 옛 이름으로 남는다.
  백엔드 매칭은 사전을 거치지 않고 문자열을 그대로 FIND_IN_SET 하므로
  (app.py), 이렇게 어긋난 재료는 서버 기준 매칭률·정렬·필터에서 누락된다.

  예) `미림` 은 사전에서 `맛술` 의 동의어라 레시피에는 맛술로 저장되는데,
      냉장고에 미림으로 저장된 사용자는 맛술 레시피와 매칭되지 않는다.

사전을 고친 뒤에 한 번씩 돌려주면 된다. 기본은 미리보기, 반영은 --commit.

사용 예:
  python -u ingredient_management/migrate_user_ingredients.py
  python -u ingredient_management/migrate_user_ingredients.py --commit
"""

import argparse
import os
import sys

_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _PROJECT_ROOT not in sys.path:
    sys.path.append(_PROJECT_ROOT)

from ingredient_management.llm_ingredient_extraction import (
    _load_env_files,
    _resolve_canonical,
    load_alias_to_canonical,
)
from ingredient_management.update_used_ingredients_batch import _connect_db


def run(*, commit):
    _load_env_files()
    alias_to_canonical = load_alias_to_canonical()

    conn = _connect_db(read_timeout_sec=60)
    cursor = conn.cursor()
    cursor.execute("SELECT id, user_id, name FROM user_ingredients")
    rows = cursor.fetchall()
    cursor.close()
    print(f"사용자 재료: {len(rows)}건", flush=True)

    changes = []
    for row in rows:
        name = (row.get("name") or "").strip()
        if not name:
            continue
        canonical = _resolve_canonical(name, alias_to_canonical)
        # 사전에 없는 이름(사용자가 직접 적은 것)은 건드리지 않는다.
        if canonical and canonical != name:
            changes.append((row["id"], row["user_id"], name, canonical))

    if not changes:
        print("바꿀 재료 없음 (모두 현재 대표어와 일치).", flush=True)
        conn.close()
        return

    print(f"\n대표어와 어긋난 재료: {len(changes)}건", flush=True)
    for _, user_id, old, new in changes:
        print(f"   user_id={user_id}  {old} -> {new}", flush=True)

    if not commit:
        print("\nDB 미반영 (미리보기만). 반영하려면 --commit 을 추가하세요.", flush=True)
        conn.close()
        return

    write_cursor = conn.cursor()
    applied = 0
    skipped_dup = 0
    for rid, user_id, _old, new in changes:
        # 같은 사용자가 이미 대표어 이름으로 그 재료를 갖고 있으면 중복이 되므로
        # 옛 이름 행을 지운다 (이름만 바꾸면 같은 재료가 두 줄이 된다).
        write_cursor.execute(
            "SELECT id FROM user_ingredients WHERE user_id = %s AND name = %s AND id <> %s",
            (user_id, new, rid),
        )
        if write_cursor.fetchone():
            write_cursor.execute("DELETE FROM user_ingredients WHERE id = %s", (rid,))
            skipped_dup += 1
        else:
            write_cursor.execute(
                "UPDATE user_ingredients SET name = %s WHERE id = %s", (new, rid)
            )
            applied += 1
    conn.commit()
    write_cursor.close()
    conn.close()
    print(f"\n반영 완료. 이름 변경 {applied}건, 중복이라 삭제 {skipped_dup}건", flush=True)


def main():
    parser = argparse.ArgumentParser(description="냉장고 재료를 현재 사전 대표어로 맞춤")
    parser.add_argument("--commit", action="store_true", help="DB에 실제로 반영")
    args = parser.parse_args()
    run(commit=args.commit)


if __name__ == "__main__":
    main()
