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

식구 그룹(household):
    그냥 두면 **그룹이 깨진다.** `households.storage_user_id` 는 그 그룹의 공유
    냉장고가 어느 계정에 있는지를 가리키는데, 그게 탈퇴시킨 계정이면 남은 멤버들의
    공유 냉장고가 죽은 계정을 보게 된다. 그래서:

      1. 합쳐지는 계정이 `storage_user_id` / `created_by` 이던 그룹은 **남는
         계정으로 넘긴다.**
      2. 소속(`users.household_id`)은 **활성 멤버가 있는 쪽**을 고른다. 남는 계정이
         혼자만 있는 그룹에 있고 합쳐지는 계정 쪽에 다른 사람이 있으면, 사람이
         있는 그룹으로 옮긴다. 양쪽 다 사람이 있으면 자동으로 정하지 않고 알린다 —
         남과 얽힌 문제라 함부로 결정할 일이 아니다.
      3. 아무도 안 남은 그룹은 지운다.

쓰는 법:
    python scripts/merge_duplicate_accounts.py                  # 미리보기 (기본)
    python scripts/merge_duplicate_accounts.py --commit         # 실제 반영
    python scripts/merge_duplicate_accounts.py --fix-orphans    # 이미 합친 뒤
                                                                # 깨진 그룹만 손보기
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
    'charset': 'utf8mb4',
    # 서버 시계가 UTC 라 세션 타임존을 KST 로 고정한다(backend/app.py 와 동일).
    # 빠뜨리면 이 스크립트가 쓰는 NOW() 만 9시간 느리게 찍힌다.
    'init_command': "SET time_zone = '+09:00'",
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
        #
        # 접두어가 `deleted+` 가 아니라 `merged+` 인 이유:
        # **사용자가 직접 탈퇴한 계정과 구분해야 한다.** 직접 탈퇴는 "새 계정으로
        # 시작" 이라는 뜻이라 옛 그룹·데이터를 새 계정에 끌고 오면 안 되는데,
        # 병합은 반대로 끌고 와야 한다. 구분이 없으면 --fix-orphans 가 진짜
        # 탈퇴 계정까지 손대게 된다(실제로 그럴 뻔했다).
        released = f"merged+{loser['id']}+{loser['email']}"[:255]
        cursor.execute(
            "UPDATE users SET deleted_at = NOW(), email = %s, updated_at = NOW() WHERE id = %s",
            (released, loser["id"]),
        )
    return moved


def active_members(cursor, household_id, exclude=()):
    """그 그룹에 남아 있는 활성 멤버 (exclude 는 제외)."""
    if not household_id:
        return []
    cursor.execute(
        "SELECT id, nickname FROM users WHERE household_id = %s AND deleted_at IS NULL",
        (household_id,),
    )
    return [r for r in cursor.fetchall() if r["id"] not in exclude]


def fix_household(cursor, keeper_id, loser_id, commit):
    """합쳐진 계정이 남긴 그룹 문제를 정리한다.

    1) 합쳐지는 계정이 storage_user_id / created_by 이던 그룹은 남는 계정으로 넘긴다.
       안 넘기면 그 그룹의 공유 냉장고가 **죽은 계정**을 가리키게 된다.
    2) 소속은 활성 멤버가 있는 쪽으로. 양쪽 다 있으면 자동으로 정하지 않는다.
    3) 아무도 안 남은 그룹은 지운다.
    """
    notes = []

    cursor.execute("SELECT household_id FROM users WHERE id = %s", (keeper_id,))
    keeper_hh = (cursor.fetchone() or {}).get("household_id")
    cursor.execute("SELECT household_id FROM users WHERE id = %s", (loser_id,))
    loser_hh = (cursor.fetchone() or {}).get("household_id")

    # 1) 소유권 넘기기
    cursor.execute(
        "SELECT id FROM households WHERE storage_user_id = %s OR created_by = %s",
        (loser_id, loser_id),
    )
    owned = [r["id"] for r in cursor.fetchall()]
    for hh in owned:
        notes.append(f"그룹 {hh} 소유·저장계정을 {loser_id} → {keeper_id}")
        if commit:
            cursor.execute(
                "UPDATE households SET storage_user_id = CASE WHEN storage_user_id = %s THEN %s ELSE storage_user_id END, "
                "created_by = CASE WHEN created_by = %s THEN %s ELSE created_by END WHERE id = %s",
                (loser_id, keeper_id, loser_id, keeper_id, hh),
            )

    # 2) 소속 정하기
    if loser_hh and loser_hh != keeper_hh:
        others_loser = active_members(cursor, loser_hh, exclude=(keeper_id, loser_id))
        others_keeper = active_members(cursor, keeper_hh, exclude=(keeper_id, loser_id))
        if others_loser and others_keeper:
            notes.append(
                f"⚠️ 양쪽 그룹에 다른 사람이 있어 소속은 그대로 둠 "
                f"(남는 계정 {keeper_hh}, 합친 계정 {loser_hh}) — 사람이 정해야 함"
            )
        elif others_loser or not keeper_hh:
            notes.append(f"소속을 그룹 {keeper_hh} → {loser_hh} 로 옮김"
                         + (f" (그쪽에 {', '.join(m['nickname'] for m in others_loser)} 있음)"
                            if others_loser else ""))
            if commit:
                cursor.execute("UPDATE users SET household_id = %s WHERE id = %s", (loser_hh, keeper_id))
            keeper_hh, loser_hh = loser_hh, keeper_hh

    # 3) 빈 그룹 정리
    for hh in {loser_hh, keeper_hh}:
        if not hh:
            continue
        if not active_members(cursor, hh, exclude=(loser_id,)):
            notes.append(f"그룹 {hh} 은 남은 사람이 없어 삭제")
            if commit:
                cursor.execute("UPDATE users SET household_id = NULL WHERE household_id = %s", (hh,))
                cursor.execute("DELETE FROM household_share_requests WHERE household_id = %s", (hh,))
                cursor.execute("DELETE FROM households WHERE id = %s", (hh,))

    return notes


def fix_orphans(cursor, commit):
    """이미 합친 뒤에 남은 그룹 문제를 찾아 고친다 (재실행해도 안전).

    병합으로 닫은 계정의 이메일은 `merged+{id}+원래주소` 로 비켜 놓았으므로,
    접두어를 벗기면 살아 있는 같은 이메일 계정을 찾을 수 있다.

    ⚠️ `deleted+` (사용자가 직접 탈퇴) 는 건드리지 않는다. 직접 탈퇴는
    "새 계정으로 시작" 이라는 뜻이라, 옛 그룹을 새 계정에 끌고 오면 안 된다.
    """
    cursor.execute(
        "SELECT id, email, household_id FROM users WHERE deleted_at IS NOT NULL "
        "AND email LIKE 'merged+%'"
    )
    notes = []
    for row in cursor.fetchall():
        parts = row["email"].split("+", 2)
        if len(parts) != 3:
            continue
        original = parts[2]
        cursor.execute(
            "SELECT id FROM users WHERE email = %s AND deleted_at IS NULL LIMIT 1", (original,)
        )
        keeper = cursor.fetchone()
        if not keeper:
            continue  # 정말로 탈퇴한 사람. 건드리지 않는다
        got = fix_household(cursor, keeper["id"], row["id"], commit)
        if got:
            notes.append((original, keeper["id"], row["id"], got))
    return notes


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--commit", action="store_true", help="실제로 반영한다 (없으면 미리보기)")
    parser.add_argument("--fix-orphans", action="store_true",
                        help="이미 합친 뒤 깨진 그룹만 손본다")
    args = parser.parse_args()

    load_env()
    DB_CONFIG["password"] = os.getenv("DB_PASSWORD") or DB_CONFIG["password"]

    conn = pymysql.connect(**DB_CONFIG)
    try:
        cursor = conn.cursor()

        if args.fix_orphans:
            found = fix_orphans(cursor, args.commit)
            if not found:
                print("손볼 그룹이 없습니다.")
            for email, keeper_id, loser_id, notes in found:
                print(f"[{email}] 남는 계정 {keeper_id} / 합쳐진 계정 {loser_id}")
                for n in notes:
                    print(f"  - {n}")
            if args.commit:
                conn.commit()
                print("반영했습니다.")
            else:
                print("미리보기입니다. 실제로 반영하려면 --commit 을 붙이세요.")
            return 0

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
                for note in fix_household(cursor, keeper["id"], loser["id"], args.commit):
                    print(f"        {note}")
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
