import pandas as pd
import pymysql
import re
import sys
import os

# 상위 디렉토리 경로 추가
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ingredient_text_utils 모듈 import
from backend.backend.ingredient_text_utils import unit_keywords, normalize_quantity_expression

# ✅ 사전 불러오기
ingredient_df = pd.read_csv(r"C:\Users\user\Desktop\RefrigeratorCode\frontend\public\ingredient_profile_dict_with_substitutes.csv", encoding="utf-8")

# ✅ "대분류"가 '재료','포장/제품'인 항목만 필터링
ingredient_df_filtered = ingredient_df[ingredient_df["대분류"].isin(["재료", "포장/제품"])]

# ✅ 사전 분리: 일반 / 한 글자
normal_dict, short_dict = {}, {}

for _, row in ingredient_df_filtered.iterrows():
    if pd.isna(row["ingredient_name"]):
        continue
    base_name = str(row["ingredient_name"]).strip()
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
            
# ✅ 한 글자 재료는 "단독 단어" + "짧은 문장"에서만 인정
def is_valid_short_match(word, line):
    pattern = rf"(?<![가-힣A-Za-z]){re.escape(word)}(?![가-힣A-Za-z])"
    return bool(re.search(pattern, line)) and len(line.strip()) <= 25

# ✅ DB 연결
db = pymysql.connect(
    host='localhost',
    user='root',
    password='sk784512!!',
    db='refrigerator',
    charset='utf8mb4',
    cursorclass=pymysql.cursors.DictCursor
)
cursor = db.cursor()

# ✅ 레시피 불러오기
cursor.execute("SELECT id, content FROM recipes")
recipes = cursor.fetchall()

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

# ✅ 메인 처리
total_recipes = len(recipes)
for i, recipe in enumerate(recipes, 1):
    if i % 10 == 0:
        print(f"🔄 진행 중: {i}/{total_recipes} ({round(i/total_recipes*100)}%) 완료")
        
    recipe_id = recipe['id']
    content = recipe['content']
    
    # 재료 블록 추출
    block, reason = extract_best_ingredient_block(content)
    
    # 재료 목록 추출
    ingredients = extract_ingredients(block)
    
    # DB 업데이트
    cursor.execute("""
        UPDATE recipes 
        SET used_ingredients = %s,
            used_ingredients_block = %s,
            block_reason = %s
        WHERE id = %s
    """, (
        ",".join(ingredients) if ingredients else None,
        block if block else None,
        reason,
        recipe_id
    ))
    
db.commit()
print("✅ used_ingredients, used_ingredients_block, block_reason 업데이트 완료!")

# 연결 종료
cursor.close()
db.close() 