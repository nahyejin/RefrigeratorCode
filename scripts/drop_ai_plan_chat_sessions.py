"""옛 서버 데이터 정리 — 표 `ai_plan_chat_sessions`(AI 식단 추천 지난 대화, 2026-09-20 ~ 11-05)를 지운다.

    python scripts\\drop_ai_plan_chat_sessions.py            # 기본: 행 수만 보고 아무것도 바꾸지 않는다(dry-run)
    python scripts\\drop_ai_plan_chat_sessions.py --backup   # 표 전체를 scratch_backups\\ 에 JSON 으로 저장(읽기만)
    python scripts\\drop_ai_plan_chat_sessions.py --drop     # 백업을 먼저 저장하고, 성공했을 때만 DROP TABLE

- **DROP 은 되돌릴 수 없다.** `--drop` 은 항상 백업을 먼저 만들고, 백업 행 수가 DB 의 행 수와 다르면 멈춘다.
- 백업(`scratch_backups\\ai_plan_chat_sessions_<날짜시각>.json`)에는 회원의 AI 대화(내가 쓴 조건)가 들어 있다.
  `scratch_backups/` 는 .gitignore 대상이라 GitHub 에 올라가지 않는다. 클라우드 동기화 폴더로 옮기지 말 것.
- 접속 정보는 `backend/.env` 에서만 읽는다(`db_env`). 운영 DB(Railway) 에 붙는다.
- 서버 코드는 이미 이 표를 읽지도 쓰지도 않는다(backend/app.py 의 두 엔드포인트는 빈 응답만).
  회원 탈퇴(`WITHDRAWAL_CONTENT_TABLES`)·`scripts/purge_deleted_accounts.py` 는 표가 없으면 건너뛰므로 DROP 뒤에도 안전하다.
"""
import argparse
import json
import os
import sys
from datetime import date, datetime
from decimal import Decimal

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

import pymysql  # noqa: E402
from db_env import db_settings  # noqa: E402

TABLE = "ai_plan_chat_sessions"
BACKUP_DIR = os.path.join(ROOT, "scratch_backups")


def _jsonable(v):
    if isinstance(v, (datetime, date)):
        return v.isoformat(sep=" ") if isinstance(v, datetime) else v.isoformat()
    if isinstance(v, Decimal):
        return str(v)
    if isinstance(v, bytes):
        return v.decode("utf-8", "replace")
    return v


def connect():
    st = db_settings()
    return pymysql.connect(**{**st, "charset": "utf8mb4", "cursorclass": pymysql.cursors.DictCursor,
                              "read_timeout": 120, "write_timeout": 120})


def table_exists(cur):
    cur.execute("SHOW TABLES LIKE %s", (TABLE,))
    return bool(cur.fetchall())


def summary(cur):
    cur.execute(f"SELECT COUNT(*) n, COUNT(DISTINCT user_id) users, MIN(updated_at) oldest, "
                f"MAX(updated_at) newest, COALESCE(SUM(LENGTH(sessions_json)), 0) bytes FROM {TABLE}")
    return cur.fetchone()


def backup(cur):
    cur.execute(f"SELECT * FROM {TABLE} ORDER BY user_id")
    rows = cur.fetchall()
    os.makedirs(BACKUP_DIR, exist_ok=True)
    path = os.path.join(BACKUP_DIR, f"{TABLE}_{datetime.now():%Y%m%d_%H%M%S}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump([{k: _jsonable(v) for k, v in r.items()} for r in rows], f, ensure_ascii=False, indent=1)
    return path, len(rows)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--backup", action="store_true", help="표 전체를 scratch_backups/ 에 JSON 으로 저장(읽기만)")
    ap.add_argument("--drop", action="store_true", help="백업을 먼저 저장한 뒤 표를 DROP (되돌릴 수 없음)")
    args = ap.parse_args()

    conn = connect()
    cur = conn.cursor()
    cur.execute("SELECT DATABASE() d")
    print(f"접속: {conn.host} / DB {cur.fetchone()['d']}")

    if not table_exists(cur):
        print(f"표 {TABLE} 가 이미 없습니다. 할 일 없음.")
        return 0

    s = summary(cur)
    print(f"{TABLE}: {s['n']}행 · 사용자 {s['users']}명 · 가장 오래된 갱신 {s['oldest']} · 가장 최근 갱신 {s['newest']} · 합계 {s['bytes']} 바이트")

    if not (args.backup or args.drop):
        print("dry-run — 아무것도 바꾸지 않았습니다. 백업은 --backup, 삭제는 --drop.")
        return 0

    path, n = backup(cur)
    print(f"백업 저장: {path} ({n}행)")
    if n != s["n"]:
        print(f"중단: 백업 행 수({n})가 처음 센 행 수({s['n']})와 다릅니다. 아무것도 지우지 않았습니다.")
        return 1

    if not args.drop:
        return 0

    cur.execute(f"DROP TABLE {TABLE}")
    conn.commit()
    print(f"표 {TABLE} 를 삭제했습니다. 복구가 필요하면 위 백업 JSON 을 쓰세요.")
    print("다음 순서: backend/app.py 의 WITHDRAWAL_CONTENT_TABLES · scripts/purge_deleted_accounts.py USER_TABLES 에서 "
          f"'{TABLE}' 항목을 빼고, 개인정보처리방침(LegalPage.tsx)의 「예전 서버 기록」 문구를 지우고 개정일을 갱신.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
