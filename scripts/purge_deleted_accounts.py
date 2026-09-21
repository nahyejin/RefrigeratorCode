# -*- coding: utf-8 -*-
"""탈퇴 후 1년이 지난 계정과 그 데이터를 완전히 지운다 (매일 배치).

왜 필요한가 (2026-09-22):
    회원 탈퇴(`/api/auth/delete-account`)는 계정을 쓸 수 없게 표시(`users.deleted_at`)만 하고
    데이터는 남긴다 — 같은 이메일로 탈퇴·재가입을 반복해 가입 혜택(크레딧)을 여러 번 받는 것을
    막기 위해서다. 그 대신 계정 삭제 안내(`/account-deletion`)와 개인정보처리방침에
    「탈퇴 후 1년 보관 뒤 모두 삭제, 요청하면 7일 안에 삭제」라고 약속했다. 이 스크립트가 그 약속을 지킨다.

쓰는 법:
    python -u scripts/purge_deleted_accounts.py                  # 미리보기(지울 대상만 출력)
    python -u scripts/purge_deleted_accounts.py --write          # 1년 지난 탈퇴 계정 실제 삭제
    python -u scripts/purge_deleted_accounts.py --user-id 123 --write
        # 삭제 요청(이메일·DM)을 받았을 때: 그 계정 하나를 1년을 기다리지 않고 바로 삭제.
        # 탈퇴하지 않은 계정이면 거부한다 — 먼저 앱에서 탈퇴하거나 본인 확인 후 진행할 것.

지우는 범위:
    그 사람 자신의 행(user_id = 그 계정)만 지운다. 가족 식구가 남긴 행(요리 기록·식단의 주인이
    다른 식구인 것)은 그 식구의 데이터라 남긴다 — 안내 페이지에도 그렇게 적었다.
    테이블을 새로 만들어 user_id 를 담게 되면 USER_TABLES 에 추가할 것.
"""

import argparse
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for p in (ROOT, os.path.join(ROOT, "scripts"), os.path.join(ROOT, "ingredient_management")):
    if p not in sys.path:
        sys.path.insert(0, p)

from ingredient_management.llm_ingredient_extraction import _load_env_files  # noqa: E402
from ingredient_management.update_used_ingredients_batch import _connect_db  # noqa: E402

RETENTION_DAYS = 365  # 계정 삭제 안내·개인정보처리방침의 「1년」과 같아야 한다

# (테이블, user 를 가리키는 컬럼) — 그 사람 자신의 데이터
USER_TABLES = [
    ("user_ingredients", "user_id"),
    ("user_favorite_recipes", "user_id"),
    ("user_recorded_recipes", "user_id"),
    ("user_completed_recipes", "user_id"),
    ("user_manual_cook_logs", "user_id"),
    ("user_meal_plans", "user_id"),
    ("ai_plan_chat_sessions", "user_id"),
    ("family_action_notifications", "target_user_id"),
    ("family_action_notifications", "actor_user_id"),
    ("push_subscriptions", "user_id"),
    ("push_device_tokens", "user_id"),
    ("apple_refresh_tokens", "user_id"),
    ("llm_usage", "user_id"),
    ("usage_requests", "user_id"),
    ("user_quota", "user_id"),
    ("credit_grants", "user_id"),
    ("credit_identity_claims", "user_id"),
    ("user_events", "user_id"),
]


def existing_tables(cursor):
    cursor.execute("SHOW TABLES")
    return {list(r.values())[0] for r in cursor.fetchall()}


def purge_user(cursor, tables, user_id):
    """한 계정의 데이터를 지우고, 지운 행 수를 (테이블 → 수) 로 돌려준다."""
    counts = {}
    for table, col in USER_TABLES:
        if table not in tables:
            continue
        cursor.execute(f"DELETE FROM {table} WHERE {col} = %s", (user_id,))
        if cursor.rowcount:
            counts[f"{table}.{col}"] = cursor.rowcount
    cursor.execute("DELETE FROM users WHERE id = %s AND deleted_at IS NOT NULL", (user_id,))
    counts["users"] = cursor.rowcount
    return counts


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true", help="실제로 지운다")
    ap.add_argument("--user-id", type=int, help="삭제 요청을 받은 계정 하나만 바로 지운다")
    args = ap.parse_args()

    _load_env_files()
    conn = _connect_db(read_timeout_sec=60)
    cursor = conn.cursor()
    tables = existing_tables(cursor)

    if args.user_id:
        cursor.execute("SELECT id, email, deleted_at FROM users WHERE id = %s", (args.user_id,))
        row = cursor.fetchone()
        if not row:
            print(f"user_id={args.user_id} 계정이 없습니다.")
            conn.close()
            return 1
        if row["deleted_at"] is None:
            print(f"user_id={args.user_id} 는 탈퇴하지 않은 계정입니다 — 앱에서 탈퇴하거나 본인 확인 후 "
                  "먼저 탈퇴 처리한 뒤 다시 실행하세요.")
            conn.close()
            return 1
        targets = [row]
    else:
        cursor.execute(
            "SELECT id, email, deleted_at FROM users "
            "WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL %s DAY",
            (RETENTION_DAYS,),
        )
        targets = cursor.fetchall()

    print(f"삭제 대상 {len(targets)}개 계정 (보관 기간 {RETENTION_DAYS}일)", flush=True)
    for t in targets:
        print(f"  id={t['id']} 탈퇴={t['deleted_at']}", flush=True)
        if args.write:
            counts = purge_user(cursor, tables, t["id"])
            conn.commit()
            print(f"    삭제: {counts}", flush=True)

    conn.close()
    if not args.write:
        print("미리보기입니다. --write 를 붙이면 실제로 지웁니다.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
