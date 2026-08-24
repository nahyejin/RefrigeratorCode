-- recipes 테이블에 FULLTEXT 인덱스 추가
-- title과 content 컬럼에 대한 전문 검색 인덱스

-- 기존 인덱스 확인
SHOW INDEX FROM recipes;

-- FULLTEXT 인덱스 추가 (title과 content에 대해)
ALTER TABLE recipes 
ADD FULLTEXT INDEX ft_title_content (title, content);

-- 인덱스 추가 확인
SHOW INDEX FROM recipes WHERE Key_name = 'ft_title_content';

-- FULLTEXT 검색 테스트 쿼리
-- MATCH() AGAINST() 사용 시 동의어를 하나의 검색어로 처리 가능
-- BOOLEAN MODE: 공백은 OR 의미 (하나라도 포함되면 매칭)
SELECT COUNT(*) as total_count
FROM recipes
WHERE MATCH(title, content) AGAINST('유아식 아기반찬 아기밥 돌아기 돌쟁이 두돌 12개월 13개월 14개월 15개월 18개월 24개월 36개월 세살 네살 유아식단 식판식 무염반찬' IN BOOLEAN MODE);

-- 성능 비교: LIKE vs FULLTEXT
-- LIKE 방식 (느림)
SELECT COUNT(*) as like_count
FROM recipes
WHERE title LIKE '%유아식%' OR content LIKE '%유아식%'
   OR title LIKE '%아기반찬%' OR content LIKE '%아기반찬%'
   OR title LIKE '%아기밥%' OR content LIKE '%아기밥%';

-- FULLTEXT 방식 (빠름, 인덱스 사용)
SELECT COUNT(*) as fulltext_count
FROM recipes
WHERE MATCH(title, content) AGAINST('유아식 아기반찬 아기밥' IN BOOLEAN MODE);

-- 개별 키워드별 개수 확인
SELECT 
  '유아식' as keyword,
  COUNT(*) as count
FROM recipes
WHERE MATCH(title, content) AGAINST('유아식' IN BOOLEAN MODE)

UNION ALL

SELECT 
  '아기반찬' as keyword,
  COUNT(*) as count
FROM recipes
WHERE MATCH(title, content) AGAINST('아기반찬' IN BOOLEAN MODE)

UNION ALL

SELECT 
  '아기밥' as keyword,
  COUNT(*) as count
FROM recipes
WHERE MATCH(title, content) AGAINST('아기밥' IN BOOLEAN MODE)

ORDER BY count DESC;

