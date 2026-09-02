"""사진에서 읽혔지만 재료 사전에 없던 이름들을 꺼내 본다.

무엇을 위한 것인가:
    사진 인식 품질은 모델보다 **사전이 얼마나 두꺼운지**에 더 크게 좌우된다.
    사용자가 영수증을 찍었는데 "사전에 없어요" 로 회색 처리되는 항목이 곧
    사전의 구멍이다. 서버는 그것들을 `ingredient_dictionary_misses` 에
    쌓아 두는데(backend/app.py 의 _record_dictionary_misses), 쌓기만 하고
    꺼내 볼 방법이 없으면 모아 둔 의미가 없다.

무엇을 보여주나:
    자주 걸린 순서로 목록을 내고, **지금 사전으로 다시 조회해 본 결과**를
    함께 보여준다. 기록된 뒤에 사전을 보강했다면 이제는 잡히는 이름이 있는데,
    그건 이미 해결된 것이므로 목록에서 구분해 줘야 헛수고를 안 한다.

쓰는 법:
    python scripts/show_dictionary_misses.py            # 안 잡히는 것만 (기본)
    python scripts/show_dictionary_misses.py --all      # 이미 해결된 것도 함께
    python scripts/show_dictionary_misses.py --limit 100
    python scripts/show_dictionary_misses.py --csv misses.csv
"""

import argparse
import csv
import os
import sys

import pymysql

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"))

from ingredient_dictionary import (  # noqa: E402
    DictionaryUnavailable,
    get_alias_to_canonical,
    resolve_canonical,
)

DB_CONFIG = {
    "host": os.getenv("DB_HOST") or os.getenv("MYSQLHOST") or "caboose.proxy.rlwy.net",
    "user": os.getenv("DB_USER") or os.getenv("MYSQLUSER") or "root",
    "password": os.getenv("DB_PASSWORD") or os.getenv("MYSQLPASSWORD") or "HkqYFCoKPPPxgryxiEbUYxcYynQXxeRF",
    "db": os.getenv("DB_NAME") or os.getenv("MYSQLDATABASE") or "railway",
    "port": int(os.getenv("DB_PORT") or os.getenv("MYSQLPORT") or 47779),
    'charset': 'utf8mb4',
    # 서버 시계가 UTC 라 세션 타임존을 KST 로 고정한다(backend/app.py 와 동일).
    # 빠뜨리면 이 스크립트가 쓰는 NOW() 만 9시간 느리게 찍힌다.
    'init_command': "SET time_zone = '+09:00'",
    "cursorclass": pymysql.cursors.DictCursor,
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=50, help="몇 개까지 볼지 (기본 50)")
    parser.add_argument("--all", action="store_true", help="지금 사전으로 잡히는 것도 함께 본다")
    parser.add_argument("--csv", help="결과를 CSV 로도 저장할 경로")
    args = parser.parse_args()

    try:
        alias_to_canonical = get_alias_to_canonical()
    except DictionaryUnavailable as e:
        print(f"재료 사전을 읽지 못했습니다: {e}")
        return 1

    conn = pymysql.connect(**DB_CONFIG)
    try:
        with conn.cursor() as cursor:
            cursor.execute("SHOW TABLES LIKE 'ingredient_dictionary_misses'")
            if not cursor.fetchone():
                print("아직 기록된 미매칭 재료가 없습니다 (표가 만들어지지 않았습니다).")
                print("사진 인식을 한 번이라도 쓰면 서버가 표를 만듭니다.")
                return 0

            cursor.execute(
                """
                SELECT raw_name, hit_count, last_mode, first_seen, last_seen
                FROM ingredient_dictionary_misses
                ORDER BY hit_count DESC, last_seen DESC
                """
            )
            rows = cursor.fetchall()
    finally:
        conn.close()

    for row in rows:
        row["now_resolves_to"] = resolve_canonical(row["raw_name"], alias_to_canonical)

    unresolved = [r for r in rows if not r["now_resolves_to"]]
    resolved = [r for r in rows if r["now_resolves_to"]]

    print(f"기록된 미매칭 이름: {len(rows)}개")
    print(f"  - 지금 사전으로도 안 잡힘: {len(unresolved)}개  <- 사전에 보탤 후보")
    print(f"  - 그 사이 사전 보강으로 해결됨: {len(resolved)}개")
    print()

    shown = rows if args.all else unresolved
    print(f"{'이름':<24} {'횟수':>4}  {'마지막 모드':<12} {'마지막 기록':<20} 지금 결과")
    print("-" * 92)
    for row in shown[: args.limit]:
        now = row["now_resolves_to"] or "-"
        print(
            f"{row['raw_name']:<24} {row['hit_count']:>4}  "
            f"{(row['last_mode'] or '-'):<12} {str(row['last_seen']):<20} {now}"
        )
    if len(shown) > args.limit:
        print(f"... 그 외 {len(shown) - args.limit}개 (--limit 으로 늘려 보세요)")

    if args.csv:
        with open(args.csv, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(
                f, fieldnames=["raw_name", "hit_count", "last_mode", "first_seen", "last_seen", "now_resolves_to"]
            )
            writer.writeheader()
            writer.writerows(shown)
        print(f"\nCSV 저장: {args.csv}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
