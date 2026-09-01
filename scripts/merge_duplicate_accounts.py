"""같은 이메일로 갈라진 계정을 하나로 합친다.

왜 이런 게 생겼나:
    `users` 의 유니크 키가 `(email, provider)` 복합이라, 같은 이메일이 제공자마다
    하나씩 존재할 수 있었다. 네이버로 로그인한 계정과 그 이메일로 직접 가입한
    계정이 서로 **다른 냉장고**를 갖게 됐다. 사용자가 예상하지 못하는 동작이다.

    새로 생기는 건 `get_or_create_user()` 의 이메일 연결로 막았다. 이 스크립트는
    **이미 갈라져 있는 것**을 정리한다.

어느 쪽을 남기나:
    **비밀번호를 가진 행**을 남긴다. 비밀번호 해시는 그 행에만 있어서, 그 행을
    지우면 아이디/비밀번호 로그인이 영영 안 된다. 반면 소셜 로그인은 이메일로
    찾아 붙일 수 있으므로 어느 행이든 상관없다.
    비밀번호가 양쪽 다 없으면 **먼저 만들어진 행**을 남긴다.

무엇을 옮기나:
    재료 · 즐겨찾기 · 완료 · 기록 · 사용량 원장. 이미 같은 것이 있으면 건너뛴다
    (재료는 이름 기준, 레시피는 recipe_id 기준).

    식구 그룹(`household_id`)은 **옮기지 않는다.** 두 계정이 서로 다른 그룹에
    속해 있을 수 있고, 그건 다른 사람들과 얽힌 문제라 자동으로 정할 일이 아니다.
    남는 계정의 그룹을 그대로 둔다.

쓰는 법:
    python scripts/merge_duplicate_accounts.py            # 미리보기 (기본)
    python scripts/merge_duplicate_accounts.py --commit   # 실제 반영
"""

import argparse
import json
import os
import sys
from datetime import datetime

import pymysql

BACKUP_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scratch_backups")

DB_CONFIG = {
    "host": os.getenv("DB_HOST") or os.getenv("MYSQLHOST") or "caboose.proxy.rlwy.net",
    "user": os.getenv("DB_USER") or "root",
    "password": os.getenv("DB_PASSWORD") or "",
    "db": os.getenv("DB_NAME") or "railway",
    "port": int(os.getenv("DB_PORT") or 47779),
    "charset": "utf8mb4",
    "cursorclass": pymysql.cursors.DictCursor,
}

# 옮길 표들. (표 이름, 중복 판정 컬럼)
MOVE_TABLES = [
    ("user_ingredients", "name"),
    ("user_favorite_recipes", "recipe_id"),
    ("user_completed_recipes", "recipe_id"),
    ("user_recorded_recipes", "recipe_id"),
    ("llm_usage", None),  # 사용 이력은 중복이라는 개념이 없다. 전부 옮긴다
]


def load_env():
    """backend/.env 를 읽어 환경변수로 올린다 (이미 있으면 덮지 않는다)."""
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    for path in (os.path.join(root, "backend", ".env"), os.path.join(root, ".env")):
        if not os.path.exists(path):
            continue
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    os.environ.setdefault(key.strip(), value.strip())


def find_groups(cursor):
    """중복 이메일 그룹 → [(살릴 id, [합칠 id...], 이메일)]"""
    cursor.execute(
        """
        SELECT id, email, provider, nickname, created_at, household_id,
               (password IS NOT NULL) AS has_pw
        FROM users
        WHERE deleted_at IS NULL
          AND email IN (
            SELECT email FROM (
              SELECT email FROM users WHERE deleted_at IS NULL
              GROUP BY email HAVING COUNT(*) > 1
            ) dup
          )
        ORDER BY email, created_at
        """
    )
    by_email = {}
    for row in cursor.fetchall():
        by_email.setdefault(row["email"], []).append(row)

    groups = []
    for email, rows in by_email.items():
        with_pw = [r for r in rows if r["has_pw"]]
        # 비밀번호를 가진 행을 남긴다 (해시가 그 행에만 있어서).
        # 여러 개면, 그리고 하나도 없으면, 먼저 만들어진 행.
        keeper = (with_pw or rows)[0]
        losers = [r for r in rows if r["id"] != keeper["id"]]
        groups.append((keeper, losers, email))
    return groups


def backup(cursor, user_ids, path):
    data = {"taken_at": datetime.now().isoformat(), "user_ids": user_ids, "tables": {}}
    placeholders = ",".join(["%s"] * len(user_ids))
    for table in ["users"] + [t for t, _ in MOVE_TABLES]:
        try:
            cursor.execute(f"SELECT * FROM {table} WHERE {'id' if table == 'users' else 'user_id'} IN ({placeholders})",
                           tuple(user_ids))
            data["tables"][table] = [
                {k: (v.isoformat() if hasattr(v, "isoformat") else v) for k, v in row.items()}
                for row in cursor.fetchall()
            ]
        except pymysql.err.ProgrammingError:
            continue  # 아직 없는 표는 건너뛴다
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return {t: len(rows) for t, rows in data["tables"].items()}


def merge_one(cursor, keeper, loser, commit):
    """loser 의 데이터를 keeper 로 옮기고 loser 를 탈퇴 처리한다."""
    moved = {}
    for table, dedupe_col in MOVE_TABLES:
        try:
            if dedupe_col:
                cursor.execute(
                    f"SELECT id FROM {table} WHERE user_id = %s AND {dedupe_col} NOT IN "
                    f"(SELECT {dedupe_col} FROM (SELECT {dedupe_col} FROM {table} WHERE user_id = %s) k)",
                    (loser["id"], keeper["id"]),
                )
            else:
                cursor.execute(f"SELECT id FROM {table} WHERE user_id = %s", (loser["id"],))
            ids = [r["id"] for r in cursor.fetchall()]
        except pymysql.err.ProgrammingError:
            continue

        moved[table] = len(ids)
        if commit and ids:
            placeholders = ",".join(["%s"] * len(ids))
            cursor.execute(
                f"UPDATE {table} SET user_id = %s WHERE id IN ({placeholders})",
                tuple([keeper["id"]] + ids),
            )

    if commit:
        # 탈퇴 처리 + 이메일 비우기.
        # 이메일을 비켜 놓아야 남는 계정만 그 이메일로 찾힌다 —
        # 소셜 로그인의 이메일 연결이 헷갈리지 않게.
        released = f"deleted+{loser['id']}+{loser['email']}"[:255]
        cursor.execute(
            "UPDATE users SET deleted_at = NOW(), email = %s, updated_at = NOW() WHERE id = %s",
            (released, loser["id"]),
        )
    return moved


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--commit", action="store_true", help="실제로 반영한다 (없으면 미리보기)")
    args = parser.parse_args()

    load_env()
    DB_CONFIG["password"] = os.getenv("DB_PASSWORD") or DB_CONFIG["password"]

    conn = pymysql.connect(**DB_CONFIG)
    try:
        cursor = conn.cursor()
        groups = find_groups(cursor)
        if not groups:
            print("중복 이메일 계정이 없습니다.")
            return 0

        all_ids = [g[0]["id"] for g in groups] + [l["id"] for g in groups for l in g[1]]
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        path = os.path.join(BACKUP_DIR, f"merge_backup_{stamp}.json")
        counts = backup(cursor, all_ids, path)
        print(f"백업: {path}")
        print(f"  {counts}\n")

        for keeper, losers, email in groups:
            print(f"[{email}]")
            print(f"  살림  id={keeper['id']} ({keeper['provider']}, {keeper['nickname']}, "
                  f"비번={'있음' if keeper['has_pw'] else '없음'}, 그룹={keeper['household_id']})")
            for loser in losers:
                moved = merge_one(cursor, keeper, loser, args.commit)
                detail = ", ".join(f"{t} {n}" for t, n in moved.items() if n)
                print(f"  합침  id={loser['id']} ({loser['provider']}, {loser['nickname']}, "
                      f"그룹={loser['household_id']}) → 옮김: {detail or '없음'}")
            print()

        if args.commit:
            conn.commit()
            print("반영했습니다.")
        else:
            print("미리보기입니다. 실제로 반영하려면 --commit 을 붙이세요.")
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
