-- 유아식 관련 키워드로 레시피 개수 확인 쿼리
-- 현재 필터링 로직과 동일하게: title 또는 content에 키워드가 포함되면 매칭

SELECT COUNT(*) as total_count
FROM recipes
WHERE 
  -- 유아식 관련 키워드들 (OR 조건: 하나라도 포함되면 매칭)
  title LIKE '%유아식%' OR content LIKE '%유아식%'
  OR title LIKE '%아기반찬%' OR content LIKE '%아기반찬%'
  OR title LIKE '%아기밥%' OR content LIKE '%아기밥%'
  OR title LIKE '%돌아기%' OR content LIKE '%돌아기%'
  OR title LIKE '%돌쟁이%' OR content LIKE '%돌쟁이%'
  OR title LIKE '%두돌%' OR content LIKE '%두돌%'
  OR title LIKE '%12개월%' OR content LIKE '%12개월%'
  OR title LIKE '%13개월%' OR content LIKE '%13개월%'
  OR title LIKE '%14개월%' OR content LIKE '%14개월%'
  OR title LIKE '%15개월%' OR content LIKE '%15개월%'
  OR title LIKE '%18개월%' OR content LIKE '%18개월%'
  OR title LIKE '%24개월%' OR content LIKE '%24개월%'
  OR title LIKE '%36개월%' OR content LIKE '%36개월%'
  OR title LIKE '%세살%' OR content LIKE '%세살%'
  OR title LIKE '%네살%' OR content LIKE '%네살%'
  OR title LIKE '%유아식단%' OR content LIKE '%유아식단%'
  OR title LIKE '%식판식%' OR content LIKE '%식판식%'
  OR title LIKE '%무염 반찬%' OR content LIKE '%무염 반찬%';

-- 키워드별 개수 확인 (어떤 키워드가 많이 매칭되는지 확인)
SELECT 
  '유아식' as keyword,
  COUNT(*) as count
FROM recipes
WHERE title LIKE '%유아식%' OR content LIKE '%유아식%'

UNION ALL

SELECT 
  '아기반찬' as keyword,
  COUNT(*) as count
FROM recipes
WHERE title LIKE '%아기반찬%' OR content LIKE '%아기반찬%'

UNION ALL

SELECT 
  '아기밥' as keyword,
  COUNT(*) as count
FROM recipes
WHERE title LIKE '%아기밥%' OR content LIKE '%아기밥%'

UNION ALL

SELECT 
  '돌아기' as keyword,
  COUNT(*) as count
FROM recipes
WHERE title LIKE '%돌아기%' OR content LIKE '%돌아기%'

UNION ALL

SELECT 
  '돌쟁이' as keyword,
  COUNT(*) as count
FROM recipes
WHERE title LIKE '%돌쟁이%' OR content LIKE '%돌쟁이%'

UNION ALL

SELECT 
  '두돌' as keyword,
  COUNT(*) as count
FROM recipes
WHERE title LIKE '%두돌%' OR content LIKE '%두돌%'

UNION ALL

SELECT 
  '12개월' as keyword,
  COUNT(*) as count
FROM recipes
WHERE title LIKE '%12개월%' OR content LIKE '%12개월%'

UNION ALL

SELECT 
  '13개월' as keyword,
  COUNT(*) as count
FROM recipes
WHERE title LIKE '%13개월%' OR content LIKE '%13개월%'

UNION ALL

SELECT 
  '14개월' as keyword,
  COUNT(*) as count
FROM recipes
WHERE title LIKE '%14개월%' OR content LIKE '%14개월%'

UNION ALL

SELECT 
  '15개월' as keyword,
  COUNT(*) as count
FROM recipes
WHERE title LIKE '%15개월%' OR content LIKE '%15개월%'

UNION ALL

SELECT 
  '18개월' as keyword,
  COUNT(*) as count
FROM recipes
WHERE title LIKE '%18개월%' OR content LIKE '%18개월%'

UNION ALL

SELECT 
  '24개월' as keyword,
  COUNT(*) as count
FROM recipes
WHERE title LIKE '%24개월%' OR content LIKE '%24개월%'

UNION ALL

SELECT 
  '36개월' as keyword,
  COUNT(*) as count
FROM recipes
WHERE title LIKE '%36개월%' OR content LIKE '%36개월%'

UNION ALL

SELECT 
  '세살' as keyword,
  COUNT(*) as count
FROM recipes
WHERE title LIKE '%세살%' OR content LIKE '%세살%'

UNION ALL

SELECT 
  '네살' as keyword,
  COUNT(*) as count
FROM recipes
WHERE title LIKE '%네살%' OR content LIKE '%네살%'

UNION ALL

SELECT 
  '유아식단' as keyword,
  COUNT(*) as count
FROM recipes
WHERE title LIKE '%유아식단%' OR content LIKE '%유아식단%'

UNION ALL

SELECT 
  '식판식' as keyword,
  COUNT(*) as count
FROM recipes
WHERE title LIKE '%식판식%' OR content LIKE '%식판식%'

UNION ALL

SELECT 
  '무염 반찬' as keyword,
  COUNT(*) as count
FROM recipes
WHERE title LIKE '%무염 반찬%' OR content LIKE '%무염 반찬%'

ORDER BY count DESC;

