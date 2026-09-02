"""이미 처리한 레시피를 **다시 판정하도록 되돌린다.**

왜 필요한가:
    LLM 프롬프트에 "이 글이 요리를 만드는 글인가" 판정을 새로 넣었다. 그런데
    이미 `llm_ingredients_done = 1` 인 글은 매일 도는 배치가 건너뛰므로, 누적
    45,000건은 판정을 영영 안 받는다. 이 스크립트가 그 플래그를 되돌린다.

    되돌리기만 하면 나머지는 **기존 배치가 알아서 한다** — 매일 새벽 3시에
    무료 한도만큼 갉아먹으며 처리하고, 요리 글이 아니라고 판정되면 그 자리에서
    지운다. 별도 배치를 새로 만들 필요가 없다.

얼마나 걸리나:
    12건을 한 번에 묶어 보내므로 45,000건이면 약 3,750회 호출이다.
    하루 상한이 440회쯤이라 **8~9일**에 걸쳐 끝난다. 그동안 앱은 정상 동작한다
    (판정 전 글도 계속 보인다).

    급하면 `--suspect-only` 로 제목이 수상한 것부터 돌릴 수 있다. 다만 제목
    규칙은 오탐이 있다 — `김진순 김치 비빔국수 레시피 식당 검증된 양념장` 처럼
    진짜 레시피에도 '식당' 이 들어간다. 그래서 이건 **순서를 앞당기는 용도**일
    뿐이고, 결국 전량을 도는 것이 맞다.

쓰는 법:
    python scripts/requeue_recipes_for_llm.py                  # 미리보기
    python scripts/requeue_recipes_for_llm.py --write          # 전량 예약
    python scripts/requeue_recipes_for_llm.py --write --suspect-only
"""

import argparse
import os

import pymysql

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 제목에 이런 말이 있으면 요리 글이 아닐 **가능성**이 있다.
# 확정이 아니다 — 실제 판정은 본문을 읽는 LLM 이 한다.
SUSPECT_WORDS = [
    "보관법", "보관방법", "말리는", "손질법", "고르는 법", "세척",
    "후기", "리뷰", "내돈내산", "언박싱",
    "맛집", "카페", "식당", "영업시간", "웨이팅",
    "협찬", "체험단", "공구", "할인", "쿠폰", "무료배송", "이벤트",
    "효능", "칼로리", "영양성분", "부작용",
]


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
        # 서버 시계가 UTC 라 세션 타임존을 KST 로 고정한다(backend/app.py 와 동일).
        init_command="SET time_zone = '+09:00'",
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true", help="실제로 되돌린다")
    parser.add_argument("--suspect-only", action="store_true",
                        help="제목이 수상한 것만 (순서를 앞당기는 용도)")
    args = parser.parse_args()

    load_env()

    where = "llm_ingredients_done = 1"
    params = ()
    if args.suspect_only:
        where += " AND (" + " OR ".join(["title LIKE %s"] * len(SUSPECT_WORDS)) + ")"
        params = tuple(f"%{w}%" for w in SUSPECT_WORDS)

    conn = db()
    try:
        cursor = conn.cursor()
        cursor.execute(f"SELECT COUNT(*) n FROM recipes WHERE {where}", params)
        count = cursor.fetchone()["n"]
        cursor.execute("SELECT COUNT(*) n FROM recipes WHERE llm_ingredients_done = 0")
        already = cursor.fetchone()["n"]
    finally:
        conn.close()

    days = (count + already) / 5280.0  # 하루 처리량 관측값
    print(f"다시 판정할 레시피: {count:,}건" + (" (제목 의심분만)" if args.suspect_only else " (전량)"))
    print(f"이미 대기 중: {already:,}건")
    print(f"예상 소요: 약 {days:.1f}일 (매일 새벽 3시 배치, 하루 약 5,280건)")

    if not args.write:
        print("\n미리보기입니다. 실제로 예약하려면 --write 를 붙이세요.")
        return 0

    conn = db()
    try:
        cursor = conn.cursor()
        cursor.execute(f"UPDATE recipes SET llm_ingredients_done = 0 WHERE {where}", params)
        conn.commit()
        print(f"\n{cursor.rowcount:,}건을 다시 판정하도록 예약했습니다.")
    finally:
        conn.close()

    print("이제 매일 새벽 3시 배치가 알아서 처리합니다. 따로 할 일은 없습니다.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
