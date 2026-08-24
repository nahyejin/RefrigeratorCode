-- FULLTEXT 인덱스 추가
ALTER TABLE recipes 
ADD FULLTEXT INDEX ft_title_content (title, content);

-- 인덱스 확인
SHOW INDEX FROM recipes WHERE Key_name = 'ft_title_content';


