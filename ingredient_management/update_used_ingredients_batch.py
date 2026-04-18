"""
본문(content)에서 재료 블록·used_ingredients 추출.

- 사전: frontend/public/ingredient_profile_dict_with_substitutes.csv
- 한 글자 재료 중 `SHORT_HANGUL_REQUIRES_SPACES_BOTH_SIDES`(기본: 게)는
  본문 줄 안에서 ` 공백+글자+공백 ` 패턴만 인정. 그 외 한 글자(파·무 등)는 기존 단어 경계 규칙.

DB 전체 재계산 (환경변수로 DB 접속):
  python update_used_ingredients_batch.py --dry-run
  python update_used_ingredients_batch.py --limit 200
  python update_used_ingredients_batch.py
"""

import pandas as pd
import pymysql
import re
import sys
import os
import argparse

# 상위 디렉토리 경로 추가
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(_PROJECT_ROOT)

# ingredient_text_utils 모듈 import
from backend.backend.ingredient_text_utils import unit_keywords, normalize_quantity_expression

# ✅ 사전 불러오기 (프로젝트 루트 기준 경로)
_INGREDIENT_CSV = os.path.join(
    _PROJECT_ROOT, "frontend", "public", "ingredient_profile_dict_with_substitutes.csv"
)
ingredient_df = pd.read_csv(_INGREDIENT_CSV, encoding="utf-8")

# ✅ 컬럼명 정리: '1keyword'를 'keyword'로 변경
if '1keyword' in ingredient_df.columns:
    ingredient_df = ingredient_df.rename(columns={'1keyword': 'keyword'})

# ✅ "대분류"가 '재료','포장/제품'인 항목만 필터링
ingredient_df_filtered = ingredient_df[ingredient_df["대분류"].isin(["재료", "포장/제품"])]

# ✅ 사전 분리: 일반 / 한 글자
normal_dict, short_dict = {}, {}

for _, row in ingredient_df_filtered.iterrows():
    if pd.isna(row["keyword"]):
        continue
    base_name = str(row["keyword"]).strip()
    synonyms = str(row["synonyms"]).split(", ") if not pd.isna(row["synonyms"]) else []
    names = [base_name] + synonyms

    for name in names:
        name = name.strip()
        if not name:
            continue
        if len(name) == 1:
            short_dict[name] = base_name
        else:
            normal_dict[name] = base_name
            
# ✅ 한 글자 재료: 기본은 비한글 접두·접미(단어 경계) + 짧은 줄.
# ✅ 아래 집합에 든 한 글자(예: 게)는 본문에 '공백+글자+공백' 패턴만 인정 — 조사/오인 매칭 완화.
#    (파·무·굴 등은 쉼표 나열에 공백 없이 자주 나와 양쪽 공백 규칙을 적용하지 않음)
SHORT_HANGUL_REQUIRES_SPACES_BOTH_SIDES = frozenset({"게"})


def is_valid_short_match(word, line):
    if not word:
        return False
    if len(line.strip()) > 25:
        return False
    if len(word) == 1 and re.match(r"^[가-힣]$", word):
        if word in SHORT_HANGUL_REQUIRES_SPACES_BOTH_SIDES:
            return bool(re.search(rf"(?<=\s){re.escape(word)}(?=\s)", line))
        pattern = rf"(?<![가-힣A-Za-z]){re.escape(word)}(?![가-힣A-Za-z])"
        return bool(re.search(pattern, line))
    pattern = rf"(?<![가-힣A-Za-z]){re.escape(word)}(?![가-힣A-Za-z])"
    return bool(re.search(pattern, line))

# ✅ 의미 키워드 줄 정제 함수
def clean_meaning_line(line):
    # 0. 앞쪽 장식 기호 제거 (기존보다 범위 확대)
    line = re.sub(r"^[*#■▶※•★●▷➤➡️\\-\\s]+", "", line)

    # 1. 괄호 안 내용 제거
    line = re.sub(r"\\([^)]*\\)", "", line)

    # 2. 껍데기 괄호 제거
    line = re.sub(r"[{}\\[\\]<>]", "", line)

    # 3. 뒤쪽 장식 기호도 제거 (기존에서 * 추가)
    line = re.sub(r"[:~•\\-\\.\\*\\s]+$", "", line.strip())

    return line.strip()

# ✅ used_ingredients_block 추출 함수 + 이유 반환
def extract_best_ingredient_block(text):
    normalized_text = normalize_quantity_expression(text)  # ✅ 여기 한 줄 추가
    lines = normalized_text.split("\n")  # ✅ 정규화된 텍스트 기준으로 줄 분리
    num_lines = len(lines)
    meaning_keywords = [
        "재료", "준비물", "준비할 재료", "준비할재료", "준비하실재료", "준비하실 재료",
        "필요해요", "필요 해요", "재료 안내", "재료안내", "주재료", "주 재료",
        "재료는요", "준비하이소", "요리재료", "요리 재료", "재료 준비", "재료준비"
    ]
    all_keys = list(normal_dict.keys()) + list(short_dict.keys())

    # ✅ 단위 키워드 정규식 생성 함수 (특정 줄에서 단위 키워드 패턴이 있는지 감지하는 역할)
    def strict_quantity_expression(unit):
        korean_numerals = ['한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉', '열']
        arabic_pattern = r"(?:[0-9]+|[일이삼사오육칠팔구십백천만]+)"
        korean_pattern = r"(?:{})".format("|".join(korean_numerals))
        combined_pattern = rf"(?:{arabic_pattern}|{korean_pattern})\\s*{re.escape(unit)}(?![가-힣])"
        return re.compile(combined_pattern)

    # ✅ 단위 키워드 패턴 컴파일
    compiled_unit_patterns = {
        unit: strict_quantity_expression(unit) for unit in unit_keywords
    }

    # ✅ 블록 확장 함수: 이후 3줄 동안 단위 키워드가 1회라도 나오면 계속 확장 반복
    def extend_block_dynamically(start_idx, base_length):
        end_idx = min(len(lines), start_idx + base_length)
        last_unit_line = end_idx - 1  # 기본 블록 끝
        i = end_idx

        buffer = []  # 최근 3줄 저장
        while i < len(lines):
            buffer.append(lines[i])
            if len(buffer) > 3:
                buffer.pop(0)

            # 최근 3줄 중 하나라도 단위 키워드 포함 시 계속 확장
            match_found = any(
                any(pattern.search(buf_line) for pattern in compiled_unit_patterns.values())
                for buf_line in buffer
            )

            if match_found:
                last_unit_line = i  # 마지막 감지 위치 갱신
                i += 1
            else:
                break

        # 마지막 감지된 줄 +3줄 포함
        final_end = last_unit_line + 1
        return "\n".join(lines[start_idx:final_end])

    # 1️⃣ 의미 기반 키워드 탐색
    for i, line in enumerate(lines):
        line_clean = clean_meaning_line(line.strip())
        for kw in meaning_keywords:
            if line_clean == kw:
                block = extend_block_dynamically(start_idx=max(0, i - 3), base_length=20)  # ← 여기 숫자만 늘려줘
                reason = f"의미 기반 키워드 탐색 (정제 후: {kw})"
                return block, reason

    # 2️⃣ 계량 단위 기반 시작점 탐색
    for i, line in enumerate(lines):
        matched_units = []
        for unit, pattern in compiled_unit_patterns.items():
            match = pattern.search(line)
            if match:
                pre_unit_text = line[:match.start()]
                if any(re.search(rf"{re.escape(ingredient)}\\s*$", pre_unit_text) for ingredient in normal_dict):
                    matched_units.append(unit)

        if matched_units:
            block = extend_block_dynamically(start_idx=max(0, i - 3), base_length=20)
            reason = f"계량 단위 기반 탐색 (감지된 단위: {', '.join(matched_units)})"
            return block, reason

    # 3️⃣ 재료명 기반 시작점 탐색
    for i, line in enumerate(lines):
        line_clean = clean_meaning_line(line.strip())
        for ingredient in normal_dict:
            if ingredient in line_clean:
                block = extend_block_dynamically(start_idx=max(0, i - 3), base_length=20)
                reason = f"재료명 기반 탐색 (감지된 재료: {ingredient})"
                return block, reason

    # 4️⃣ 한 글자 재료 기반 시작점 탐색
    for i, line in enumerate(lines):
        line_clean = clean_meaning_line(line.strip())
        for ingredient in short_dict:
            if is_valid_short_match(ingredient, line_clean):
                block = extend_block_dynamically(start_idx=max(0, i - 3), base_length=20)
                reason = f"한 글자 재료 기반 탐색 (감지된 재료: {ingredient})"
                return block, reason

    return "", "재료 블록을 찾을 수 없음"

# ✅ used_ingredients 추출 함수
def extract_ingredients(text):
    ingredients = set()
    lines = text.split("\n")
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        # 일반 재료명 매칭
        for ingredient in normal_dict:
            if ingredient in line:
                ingredients.add(normal_dict[ingredient])
                
        # 한 글자 재료명 매칭
        for ingredient in short_dict:
            if is_valid_short_match(ingredient, line):
                ingredients.add(short_dict[ingredient])
                
    return list(ingredients)

def _connect_db(*, read_timeout_sec: int = 600):
    """대량 본문 fetch·배치용으로 read_timeout 기본 10분."""
    db_host = os.getenv("DB_HOST") or os.getenv("MYSQLHOST") or os.getenv("MYSQL_HOST")
    db_user = os.getenv("DB_USER") or os.getenv("MYSQLUSER") or os.getenv("MYSQL_USER")
    db_password = os.getenv("DB_PASSWORD") or os.getenv("MYSQLPASSWORD") or os.getenv("MYSQL_PASSWORD")
    db_name = os.getenv("DB_NAME") or os.getenv("MYSQLDATABASE") or os.getenv("MYSQL_DATABASE")
    db_port = os.getenv("DB_PORT") or os.getenv("MYSQLPORT") or os.getenv("MYSQL_PORT")
    if not all([db_host, db_user, db_password is not None, db_name]):
        raise SystemExit(
            "DB 환경변수를 설정하세요: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME (및 선택 DB_PORT)"
        )
    return pymysql.connect(
        host=db_host,
        user=db_user,
        password=db_password,
        db=db_name,
        port=int(db_port) if db_port else 3306,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        connect_timeout=30,
        read_timeout=read_timeout_sec,
        write_timeout=120,
        autocommit=False,
    )


def _used_ingredient_token_set(s):
    if not s:
        return frozenset()
    return frozenset(x.strip() for x in str(s).split(",") if x.strip())


def recompute_recipe_row(content):
    """본문으로부터 블록·재료·사유를 다시 계산 (DB 반영은 호출 측)."""
    block, reason = extract_best_ingredient_block(content or "")
    ingredients = extract_ingredients(block) if block else []
    used_str = ",".join(sorted(ingredients)) if ingredients else None
    return used_str, block if block else None, reason


# ✅ 메인: 본문 기준으로 used_ingredients 전면 재계산 후 DB UPDATE
if __name__ == "__main__":
    try:
        from dotenv import load_dotenv

        load_dotenv(os.path.join(_PROJECT_ROOT, "backend", ".env"))
        load_dotenv(os.path.join(_PROJECT_ROOT, ".env"))
    except ImportError:
        pass

    parser = argparse.ArgumentParser(
        description="recipes.content 기준으로 used_ingredients / block / block_reason 재생성"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="변경 건수만 출력하고 UPDATE 하지 않음",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="처리할 최대 행 수 (0=전체)",
    )
    args = parser.parse_args()

    print(
        "※ 방금까지 말 없었으면: pandas·재료 CSV 로드 시간입니다. 다음부터 단계별 로그가 나옵니다.",
        flush=True,
    )
    print(
        "※ 줄바꿈이 바로 안 보이면: python -u update_used_ingredients_batch.py ...",
        flush=True,
    )
    # SELECT 스트림이 열린 동안 같은 연결에서 UPDATE하면 MySQL 오류 → 읽기/쓰기 연결 분리
    print("DB 연결 중 (읽기 + 쓰기)...", flush=True)
    db_read = _connect_db()
    db_write = _connect_db() if not args.dry_run else None
    cursor = db_read.cursor()

    limit_sql = f" LIMIT {int(args.limit)} " if args.limit and args.limit > 0 else ""
    FETCH_BATCH = 150

    print(
        "SQL 실행 후 행을 여러 번에 나누어 받습니다(배치마다 로그).",
        flush=True,
    )
    cursor.execute(
        f"SELECT id, content, used_ingredients FROM recipes ORDER BY id{limit_sql}"
    )
    print("쿼리 실행됨. 첫 번째 행 묶음이 오기까지 잠시 걸릴 수 있습니다...", flush=True)

    total = 0
    changed = 0
    batch_idx = 0
    cur_write = db_write.cursor() if db_write else None

    try:
        while True:
            rows = cursor.fetchmany(FETCH_BATCH)
            if not rows:
                break
            batch_idx += 1
            print(
                f"  DB 수신 배치 {batch_idx}: +{len(rows)}행 (누적 {total + len(rows)}행까지 처리 예정)",
                flush=True,
            )
            for recipe in rows:
                total += 1
                recipe_id = recipe["id"]
                content = recipe["content"]
                old_used = recipe.get("used_ingredients")

                used_str, block, reason = recompute_recipe_row(content)

                if _used_ingredient_token_set(old_used) != _used_ingredient_token_set(used_str):
                    changed += 1

                if args.dry_run:
                    continue

                assert cur_write is not None
                try:
                    db_write.ping(reconnect=True)
                    cur_write.execute(
                        """
                        UPDATE recipes
                        SET used_ingredients = %s,
                            used_ingredients_block = %s,
                            block_reason = %s
                        WHERE id = %s
                        """,
                        (used_str, block, reason, recipe_id),
                    )
                    db_write.commit()
                except pymysql.err.OperationalError as e:
                    print(f"Error updating recipe {recipe_id}: {e}", flush=True)
                    try:
                        db_write.rollback()
                    except Exception:
                        pass
                    try:
                        db_write.ping(reconnect=True)
                        cur_write.execute(
                            """
                            UPDATE recipes
                            SET used_ingredients = %s,
                                used_ingredients_block = %s,
                                block_reason = %s
                            WHERE id = %s
                            """,
                            (used_str, block, reason, recipe_id),
                        )
                        db_write.commit()
                    except Exception as e2:
                        print(f"Retry failed for recipe {recipe_id}: {e2}", flush=True)

                if total % 500 == 0:
                    print(f"  재계산·저장 진행: {total}행", flush=True)
    finally:
        cursor.close()
        db_read.close()
        if cur_write:
            cur_write.close()
        if db_write:
            db_write.close()

    print(f"완료. 처리 행: {total}, 재료 집합이 달라지는 행: {changed}", flush=True)
    if args.dry_run:
        print("(dry-run 이므로 DB 미반영)", flush=True) 