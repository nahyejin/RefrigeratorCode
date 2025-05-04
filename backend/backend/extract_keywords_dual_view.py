# extract_keywords_dual_view_full_save.py

import pandas as pd
import re
from konlpy.tag import Komoran
from collections import Counter

# ✅ 형태소 분석기 (Komoran) 초기화
komoran = Komoran()

# ✅ 불용어 리스트
stopwords = set([
    '정도', '준비', '사용', '필요', '경우', '것', '수', '재료', '추가',
    '한번', '위해', '위', '후', '및', '다시', '등', '만큼', '시', '해도',
    '으로', '해서', '하기', '더', '있는', '없는', '요리', '방법', '정보',
    '관련', '기준', '정리', '만들기', '또는', '하나', '그냥', '적', '들', '때'
])

# ✅ 엑셀 데이터 불러오기
df = pd.read_excel("123.xlsx")
texts = df["used_ingredients_block"].dropna().tolist()

# ✅ 데이터 로딩 결과 출력
print(f"✅ 불러온 텍스트 수: {len(texts)}개")

# ✅ 명사 기반 키워드 추출
noun_list = []
for text in texts:
    clean_text = re.sub(r"[^\uAC00-\uD7A3a-zA-Z0-9\s]", " ", str(text)).strip()

    if not clean_text or len(clean_text) < 2:
        continue

    try:
        nouns = komoran.nouns(clean_text)
        filtered_nouns = [n for n in nouns if len(n) > 1 and n not in stopwords]
        noun_list.extend(filtered_nouns)
    except Exception as e:
        print(f"⚠️ Komoran 처리 실패한 텍스트 무시: {clean_text[:30]}...")
        continue

print(f"✅ 추출된 명사 수 (중복 포함): {len(noun_list)}개")

# ✅ 띄어쓰기 기준 키워드 추출
space_word_list = []
for text in texts:
    clean_text = re.sub(r"[^\uAC00-\uD7A3a-zA-Z0-9\s]", " ", str(text)).strip()

    if not clean_text or len(clean_text) < 2:
        continue

    tokens = clean_text.split()
    filtered_tokens = [w for w in tokens if len(w) > 1 and w not in stopwords]
    space_word_list.extend(filtered_tokens)

print(f"✅ 추출된 띄어쓰기 토큰 수 (중복 포함): {len(space_word_list)}개")

# ✅ 키워드 빈도수 계산 (전체 저장)
noun_counts = Counter(noun_list)
space_word_counts = Counter(space_word_list)

# ✅ 결과 저장
pd.DataFrame(noun_counts.items(), columns=["keyword", "count"]).to_csv(
    "keyword_noun_only_full.csv", index=False, encoding="utf-8-sig"
)

pd.DataFrame(space_word_counts.items(), columns=["keyword", "count"]).to_csv(
    "keyword_whitespace_split_full.csv", index=False, encoding="utf-8-sig"
)

print("✅ 모든 명사 저장 완료: keyword_noun_only_full.csv (명사 기반 전체)")
print("✅ 모든 띄어쓰기 토큰 저장 완료: keyword_whitespace_split_full.csv (띄어쓰기 기반 전체)")
print("✅ 코드 정상 종료 완료.")
