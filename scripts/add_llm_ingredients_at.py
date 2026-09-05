# -*- coding: utf-8 -*-
"""`recipes.llm_ingredients_at` 열을 만든다 — **LLM 결과가 룰베이스에 덮이는 것을 막는 표식.**

무슨 일이 있었나 (2026-09-05):
    8월 26일부터 9월 3일까지 LLM 이 누적 레시피 44,868건의 재료를 한 바퀴 다
    다시 뽑았다(9/3 에 563건만 남아 사이클이 끝났다). 그 뒤 9/4 에 "요리 글인가"
    판정을 새로 넣으면서 `llm_ingredients_done` 을 전부 0 으로 되돌렸다.

    그런데 주 1회 크롤러가 마지막에 돌리는 **룰베이스 전량 재계산**의 조건이
    `WHERE llm_ingredients_done = 0` 이었다. 재예약으로 그 값이 전부 0 이 된
    직후인 **9/5 13:50~18:13 (4시간 22분)** 에 그 배치가 돌면서, 9일치 LLM
    결과를 **카탈로그 전체에 걸쳐 룰베이스 값으로 덮어썼다.**

    (평소 이 배치는 5분이면 끝난다 — 9/2 는 12:48~12:53 이었다. 4시간이
     걸렸다는 것 자체가 전량을 건드렸다는 증거다.)

왜 새 열이 필요한가:
    `llm_ingredients_done` 은 뜻이 두 개다 — "LLM 이 값을 넣어 뒀다" 와
    "다시 처리할 필요가 없다". 재예약은 두 번째 뜻으로 0 을 넣는데, 룰베이스
    배치는 첫 번째 뜻으로 읽었다. 그래서 **재예약과 무관한 표식**을 따로 둔다.

    `llm_ingredients_at` 은 LLM 이 실제로 값을 쓴 시각이다. 재처리 예약은 이
    값을 건드리지 않으므로, 룰베이스는 여기가 비어 있는 행 — 즉 **LLM 이 한
    번도 손대지 않은 행** — 만 채운다.

쓰는 법:
    python scripts/add_llm_ingredients_at.py            # 미리보기
    python scripts/add_llm_ingredients_at.py --write
"""

import argparse
import os

import pymysql

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


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
        connect_timeout=30,
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true", help="실제로 반영")
    args = ap.parse_args()

    load_env()
    conn = db()
    cur = conn.cursor()

    cur.execute("SHOW COLUMNS FROM recipes LIKE 'llm_ingredients_at'")
    exists = cur.fetchone() is not None
    print("llm_ingredients_at 열: %s" % ("이미 있음" if exists else "없음"))

    cur.execute("SELECT COUNT(*) c FROM recipes WHERE llm_ingredients_done = 1")
    n_done = cur.fetchone()["c"]
    print("llm_ingredients_done = 1 인 행: %d (이 행들에 시각을 채운다)" % n_done)

    if not args.write:
        print("\n미리보기입니다. 반영하려면 --write")
        conn.close()
        return

    if not exists:
        cur.execute("ALTER TABLE recipes ADD COLUMN llm_ingredients_at DATETIME NULL")
        conn.commit()
        print("열을 만들었습니다.")

    # 지금 done=1 인 행은 9/5~9/6 배치가 방금 LLM 으로 채운 것이라 값이 최신이다.
    # 나머지는 `renormalize_used_ingredients.py --restore` 가 복구하면서 채운다.
    cur.execute(
        "UPDATE recipes SET llm_ingredients_at = NOW() "
        "WHERE llm_ingredients_done = 1 AND llm_ingredients_at IS NULL"
    )
    conn.commit()
    print("시각을 채운 행: %d" % cur.rowcount)

    cur.execute("SELECT COUNT(*) c FROM recipes WHERE llm_ingredients_at IS NULL")
    print("아직 LLM 이 손대지 않은(=룰베이스 차례인) 행: %d" % cur.fetchone()["c"])
    conn.close()


if __name__ == "__main__":
    main()
