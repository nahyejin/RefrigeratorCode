"""
DB recipes.used_ingredients 정제.

[기본] 프론트 ingredientPillNoise.ts 와 동일: 쉼표 구간이 ` 한글1자 ` (앞·뒤 공백)인 토큰만 제거.

[선택] --strip-tokens 게
  쉼표로 나눈 토큰 trim 이 **지정한 글자와 정확히 일치**할 때만 제거.
  ※ "한글 1자 전부" 옵션은 파·무·굴 같은 **정상 재료까지 지우므로 넣지 않음**.

분석 시 [2]는 참고용(파·무 등 1음절 재료 포함 행), [3]이 실제 `게` 단독 토큰 행.

사용:
  python sanitize_used_ingredients_noise.py --analyze
  python sanitize_used_ingredients_noise.py --dry-run --strip-tokens 게
  python sanitize_used_ingredients_noise.py --strip-tokens 게

DB: 환경변수 DB_* / MYSQL* , backend/.env
"""

from __future__ import annotations

import argparse
import os
import re
import sys

try:
    from dotenv import load_dotenv

    _root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    load_dotenv(os.path.join(_root, "backend", ".env"))
    load_dotenv(os.path.join(_root, ".env"))
except ImportError:
    pass

import pymysql
import pymysql.cursors

# --- frontend/src/utils/ingredientPillNoise.ts 와 동일 ---


def is_spaced_standalone_single_hangul_noise(raw_segment: str) -> bool:
    t = raw_segment.strip()
    if len(t) != 1 or not re.match(r"^[가-힣]$", t):
        return False
    return bool(re.match(r"^\s+.\s+$", raw_segment))


def parse_strip_tokens(arg: str | None) -> frozenset[str]:
    if not arg or not str(arg).strip():
        return frozenset()
    return frozenset(x.strip() for x in str(arg).split(",") if x.strip())


def is_any_single_hangul_segment(raw_segment: str) -> bool:
    t = raw_segment.strip()
    return len(t) == 1 and bool(re.match(r"^[가-힣]$", t))


def parse_used_ingredients(
    value: str | None, *, strip_tokens: frozenset[str]
) -> list[str]:
    if value is None:
        return []
    s = value.strip()
    if not s:
        return []
    out: list[str] = []
    for seg in s.split(","):
        t = seg.strip()
        if not t:
            continue
        if is_spaced_standalone_single_hangul_noise(seg):
            continue
        if strip_tokens and t in strip_tokens:
            continue
        out.append(t)
    return out


def rebuild_used_ingredients_string(
    value: str | None, *, strip_tokens: frozenset[str]
) -> str | None:
    parts = parse_used_ingredients(value, strip_tokens=strip_tokens)
    if not parts:
        return None
    return ",".join(parts)


def get_connection():
    host = os.getenv("DB_HOST") or os.getenv("MYSQLHOST") or os.getenv("MYSQL_HOST")
    user = os.getenv("DB_USER") or os.getenv("MYSQLUSER") or os.getenv("MYSQL_USER")
    password = os.getenv("DB_PASSWORD") or os.getenv("MYSQLPASSWORD") or os.getenv("MYSQL_PASSWORD")
    db = os.getenv("DB_NAME") or os.getenv("MYSQLDATABASE") or os.getenv("MYSQL_DATABASE")
    port = os.getenv("DB_PORT") or os.getenv("MYSQLPORT") or os.getenv("MYSQL_PORT")
    if not all([host, user, password is not None, db]):
        print(
            "DB 연결 정보가 부족합니다. DB_HOST, DB_USER, DB_PASSWORD, DB_NAME 등을 설정하세요.",
            file=sys.stderr,
        )
        sys.exit(1)
    return pymysql.connect(
        host=host,
        user=user,
        password=password,
        database=db,
        port=int(port) if port else 3306,
        cursorclass=pymysql.cursors.DictCursor,
        charset="utf8mb4",
    )


def analyze_rows(rows: list) -> None:
    spaced_noise_rows = 0
    any_single_syllable_rows = 0  # 파·무·굴 등 포함 → 참고만
    standalone_game_rows = 0  # 토큰 중 하나가 정확히 '게'
    game_samples: list[tuple[int, str]] = []

    for r in rows:
        old = r["used_ingredients"]
        if not old or not str(old).strip():
            continue
        s = str(old).strip()
        has_spaced = False
        has_any_single = False
        has_game = False
        for seg in s.split(","):
            t = seg.strip()
            if not t:
                continue
            if is_spaced_standalone_single_hangul_noise(seg):
                has_spaced = True
            if is_any_single_hangul_segment(seg):
                has_any_single = True
            if t == "게":
                has_game = True
        if has_spaced:
            spaced_noise_rows += 1
        if has_any_single:
            any_single_syllable_rows += 1
        if has_game:
            standalone_game_rows += 1
            if len(game_samples) < 15:
                game_samples.append((r["id"], old[:120] + ("..." if len(old) > 120 else "")))

    print("--- 분석 (used_ingredients 문자열 기준) ---")
    print(
        f"[1] 프론트와 동일: 쉼표 구간이 ' 공백+한글1자+공백 ' 인 토큰이 있는 행: {spaced_noise_rows}"
    )
    print(
        f"[2] 참고: 쉼표 토큰 중 한글 딱 1음절인 항목이 하나라도 있는 행 (파·무·굴·술 등 **정상 재료** 포함): {any_single_syllable_rows}"
    )
    print(
        "     → 이 숫자만 보고 '한 글자 전부 삭제' 하면 **안 됩니다.**"
    )
    print(
        f"[3] 쉼표 토큰 중 trim 이 정확히 '게' 인 항목이 있는 행 (--strip-tokens 게 대상): {standalone_game_rows}"
    )
    if game_samples:
        print("    샘플 (최대 15건, 앞 120자):")
        for rid, snippet in game_samples:
            print(f"      id={rid}  {snippet!r}")
    print(
        "\n※ DB 일괄 정리 예:  python sanitize_used_ingredients_noise.py --dry-run --strip-tokens 게"
    )


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="UPDATE 없이 변경될 행만 집계")
    ap.add_argument(
        "--limit",
        type=int,
        default=0,
        help="DB에서 읽을 최대 행 수(테스트용). 0이면 전체",
    )
    ap.add_argument(
        "--analyze",
        action="store_true",
        help="규칙별 통계만 출력하고 종료 (UPDATE 없음)",
    )
    ap.add_argument(
        "--strip-tokens",
        type=str,
        default="",
        metavar="LIST",
        help='쉼표로 구분해 제거할 토큰 (정확히 일치할 때만). 예: "게" 또는 "게,도"',
    )
    args = ap.parse_args()

    strip_tokens = parse_strip_tokens(args.strip_tokens)

    conn = get_connection()
    try:
        limit_sql = f" LIMIT {int(args.limit)} " if args.limit and args.limit > 0 else ""
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT id, used_ingredients
                FROM recipes
                WHERE used_ingredients IS NOT NULL AND TRIM(used_ingredients) != ''
                ORDER BY id
                {limit_sql}
                """
            )
            rows = cur.fetchall()

        if args.analyze:
            analyze_rows(rows)
            return

        total = len(rows)
        to_change: list[tuple[int, str | None, str | None]] = []
        for r in rows:
            old = r["used_ingredients"]
            new = rebuild_used_ingredients_string(old, strip_tokens=strip_tokens)
            if new != old:
                to_change.append((r["id"], old, new))

        print(f"used_ingredients 보유 행: {total}")
        if strip_tokens:
            print(f"strip-tokens: {sorted(strip_tokens)!r}")
        else:
            print("strip-tokens: (없음) — 띄어쓰기 한글1자 노이즈만 제거")
        print(f"정제 후 문자열이 달라지는 행: {len(to_change)}")

        if args.dry_run:
            for _i, (rid, old, new) in enumerate(to_change[:20]):
                print(f"  id={rid}")
                print(f"    before: {old!r}")
                print(f"    after:  {new!r}")
            if len(to_change) > 20:
                print(f"  ... 외 {len(to_change) - 20}건")
            return

        if not to_change:
            print("변경할 행이 없습니다.")
            return

        batch = 0
        with conn.cursor() as cur:
            for rid, _old, new in to_change:
                cur.execute(
                    "UPDATE recipes SET used_ingredients = %s WHERE id = %s",
                    (new, rid),
                )
                batch += 1
                if batch % 500 == 0:
                    conn.commit()
                    print(f"  커밋: {batch}/{len(to_change)}")
            conn.commit()
        print(f"완료: {len(to_change)}행 UPDATE")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
