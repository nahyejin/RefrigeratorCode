-- ============================================
-- 썸네일 문제 확인 쿼리 모음
-- ============================================

-- 1. 썸네일이 NULL이거나 빈 문자열인 레시피 개수
SELECT COUNT(*) as no_thumbnail_count
FROM recipes
WHERE thumbnail IS NULL 
   OR thumbnail = '' 
   OR TRIM(thumbnail) = '';

-- 2. 플랫폼별 썸네일 없는 레시피 개수
SELECT 
    platform,
    COUNT(*) as no_thumbnail_count
FROM recipes
WHERE thumbnail IS NULL 
   OR thumbnail = '' 
   OR TRIM(thumbnail) = ''
GROUP BY platform;

-- 3. YouTube 레시피 중 잘못된 썸네일 URL 패턴 확인
-- YouTube 썸네일 URL은 보통 'i.ytimg.com/vi/{video_id}/' 패턴을 가짐
-- link에서 video_id를 추출하고, thumbnail의 video_id와 일치하는지 확인
SELECT 
    id,
    title,
    platform,
    link,
    thumbnail,
    -- link에서 video_id 추출
    SUBSTRING_INDEX(SUBSTRING_INDEX(link, 'v=', -1), '&', 1) as link_video_id,
    -- thumbnail에서 video_id 추출 (i.ytimg.com/vi/{video_id}/ 패턴)
    CASE 
        WHEN thumbnail LIKE '%i.ytimg.com/vi/%' THEN
            SUBSTRING_INDEX(SUBSTRING_INDEX(thumbnail, '/vi/', -1), '/', 1)
        ELSE NULL
    END as thumbnail_video_id,
    collected_at
FROM recipes
WHERE platform LIKE '%youtube%'
  AND thumbnail IS NOT NULL 
  AND thumbnail != ''
  AND thumbnail NOT LIKE '%i.ytimg.com/vi/%'
LIMIT 20;

-- 4. YouTube 레시피 중 썸네일 URL이 있지만 비디오 ID가 일치하지 않는 경우
SELECT 
    id,
    title,
    platform,
    link,
    thumbnail,
    SUBSTRING_INDEX(SUBSTRING_INDEX(link, 'v=', -1), '&', 1) as link_video_id,
    CASE 
        WHEN thumbnail LIKE '%i.ytimg.com/vi/%' THEN
            SUBSTRING_INDEX(SUBSTRING_INDEX(thumbnail, '/vi/', -1), '/', 1)
        ELSE NULL
    END as thumbnail_video_id
FROM recipes
WHERE platform LIKE '%youtube%'
  AND thumbnail IS NOT NULL 
  AND thumbnail != ''
  AND thumbnail LIKE '%i.ytimg.com/vi/%'
  AND SUBSTRING_INDEX(SUBSTRING_INDEX(link, 'v=', -1), '&', 1) != 
      SUBSTRING_INDEX(SUBSTRING_INDEX(thumbnail, '/vi/', -1), '/', 1)
LIMIT 20;

-- 5. YouTube 레시피 중 썸네일 URL 패턴이 이상한 경우 (i.ytimg.com이 아닌 경우)
SELECT 
    id,
    title,
    platform,
    link,
    thumbnail,
    collected_at
FROM recipes
WHERE platform LIKE '%youtube%'
  AND thumbnail IS NOT NULL 
  AND thumbnail != ''
  AND thumbnail NOT LIKE '%i.ytimg.com%'
LIMIT 20;

-- 6. 최근 수집된 YouTube 레시피 중 썸네일 확인 (샘플)
SELECT 
    id,
    title,
    platform,
    link,
    thumbnail,
    collected_at
FROM recipes
WHERE platform LIKE '%youtube%'
ORDER BY collected_at DESC
LIMIT 20;

