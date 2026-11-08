"""쌓인 크레딧 한 번 정리 (2026-11-08 사용자 결정 — 「테스트 기간이니 이미 있는 사람 것도 빼앗아도 돼」).

주간 지급이 「더해 주기」였던 동안 안 쓴 몫이 쌓였다. 지급 방식을 「그 주 몫까지 채우기」로 바꾸면서
이미 쌓인 잔액도 플랜 몫(무료 6 / PLUS 60)으로 한 번 맞춘다.

    python scripts\\trim_credit_balances.py --env <backend/.env 경로>            # 기본: 누가 얼마에서 얼마로 줄어드는지만 본다
    python scripts\\trim_credit_balances.py --env <backend/.env 경로> --apply    # 실제로 줄인다

- 지우지 않는다. 넘치는 만큼 **음수 지급 행**(reason='reset')을 하나 더 쌓아 잔액을 맞춘다 → 원장에 그대로 남고,
  되돌리려면 그 행만 지우면 된다(`DELETE FROM credit_grants WHERE reason='reset' AND period_key='trim-20261108'`).
- 같은 날 두 번 돌려도 한 사람당 한 번만 들어간다(period_key 가 같아 INSERT IGNORE).
- 운영 DB(Railway)에 붙는다.
"""
import argparse
import os
import sys
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, "backend"))

KEY = "trim-20261108"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--env", help="backend/.env 경로(이 체크아웃에 없을 때)")
    ap.add_argument("--apply", action="store_true")
    a = ap.parse_args()
    if a.env:
        from dotenv import load_dotenv
        load_dotenv(a.env, override=False)

    from db_env import connect
    import usage_quota as Q

    now = datetime.now(Q.KST)
    conn = connect()
    cur = conn.cursor()
    cur.execute("SELECT DISTINCT user_id FROM credit_grants")
    ids = [r["user_id"] for r in cur.fetchall()]
    rows = []
    for uid in ids:
        plan, _, _ = Q._plan_of(cur, uid, now)
        _, _, left = Q.balance(cur, uid)
        target = Q.weekly_for(plan)
        if left > target:
            cur.execute("SELECT nickname FROM users WHERE id = %s", (uid,))
            u = cur.fetchone() or {}
            rows.append((uid, u.get("nickname") or "(탈퇴/없음)", plan, int(left), target))

    rows.sort(key=lambda r: -r[3])
    print(f"정리 대상 {len(rows)}명 (전체 {len(ids)}명 중)")
    for uid, nick, plan, left, target in rows:
        print(f"  #{uid:<5} {nick:<14} {plan:<5} {left:>5} → {target}")
    if not a.apply:
        print("\n(dry-run — 바꾸지 않았습니다. 실제로 하려면 --apply)")
        return
    n = 0
    for uid, _nick, plan, left, target in rows:
        if Q._add_grant(cur, uid, target - left, "reset", KEY, f"쌓인 크레딧 정리 ({plan} {target}로)"):
            n += 1
    conn.commit()
    print(f"\n{n}명 정리했어요.")


if __name__ == "__main__":
    main()
