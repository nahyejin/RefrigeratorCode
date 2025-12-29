-- FULLTEXT 인덱스 추가 및 쿼리 최적화
-- Railway MySQL에서 실행하세요

-- 1. 기존 인덱스 확인
SHOW INDEX FROM recipes;

-- 2. FULLTEXT 인덱스 추가 (title과 content에 대해)
-- 이미 존재하면 에러가 발생하므로, 먼저 확인 후 실행하세요
ALTER TABLE recipes 
ADD FULLTEXT INDEX ft_title_content (title, content);

-- 3. 인덱스 추가 확인
SHOW INDEX FROM recipes WHERE Key_name = 'ft_title_content';

-- 4. 추가 인덱스 (선택사항, 성능 향상)
-- platform 컬럼에 인덱스 추가 (플랫폼 필터링 성능 향상)
CREATE INDEX idx_platform ON recipes(platform);

-- post_time 컬럼에 인덱스 추가 (날짜 정렬 성능 향상)
CREATE INDEX idx_post_time ON recipes(post_time DESC);

-- used_ingredients 컬럼에 인덱스 추가 (재료 필터링 성능 향상)
-- TEXT 컬럼에는 직접 인덱스를 만들 수 없으므로, 필요시 전문 검색 인덱스 사용
-- CREATE INDEX idx_used_ingredients ON recipes(used_ingredients(255));

-- 5. 인덱스 사용 확인 쿼리 (EXPLAIN 사용)
-- EXPLAIN SELECT * FROM recipes WHERE MATCH(title, content) AGAINST('유아식' IN BOOLEAN MODE);


