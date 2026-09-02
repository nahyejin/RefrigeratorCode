import pymysql
from datetime import datetime, timedelta

# DB 연결
conn = pymysql.connect(
    host='localhost',
    user='root',
    password='sk784512!!',
    db='refrigerator',
    charset='utf8mb4',
    cursorclass=pymysql.cursors.DictCursor,
    # 서버 시계가 UTC 라 세션 타임존을 KST 로 고정한다(backend/app.py 와 동일).
    # 이걸 빠뜨리면 이 스크립트가 쓰는 NOW() 만 9시간 느리게 찍혀서, 앱이 쓴
    # 시각과 나란히 놓았을 때 앞뒤가 뒤집힌다 — 실제로 사전 반영 시각이 승인
    # 시각보다 먼저인 것처럼 보였다.
    init_command="SET time_zone = '+09:00'",
)
cursor = conn.cursor()

# 전체 레시피 수와 null 비율
cursor.execute('SELECT COUNT(*) as total FROM recipes')
total = cursor.fetchone()['total']

cursor.execute('SELECT COUNT(*) as null_count FROM recipes WHERE used_ingredients IS NULL OR used_ingredients = ""')
null_count = cursor.fetchone()['null_count']

print(f'전체 레시피 수: {total}')
print(f'used_ingredients가 null인 레시피 수: {null_count}')
print(f'null 비율: {null_count/total*100:.1f}%')

# 최근 30일간 수집된 레시피 확인
cursor.execute('''
    SELECT 
        COUNT(*) as recent_total,
        COUNT(CASE WHEN used_ingredients IS NULL OR used_ingredients = "" THEN 1 END) as recent_null
    FROM recipes 
    WHERE collected_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
''')
recent_stats = cursor.fetchone()

print(f'\n최근 30일간 수집된 레시피:')
print(f'  전체: {recent_stats["recent_total"]}개')
print(f'  null: {recent_stats["recent_null"]}개')
if recent_stats["recent_total"] > 0:
    print(f'  null 비율: {recent_stats["recent_null"]/recent_stats["recent_total"]*100:.1f}%')

# 최근 수집된 레시피 중 null인 것들
cursor.execute('''
    SELECT id, title, platform, collected_at, used_ingredients
    FROM recipes 
    WHERE (used_ingredients IS NULL OR used_ingredients = "") 
    AND collected_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    ORDER BY collected_at DESC
    LIMIT 10
''')
recent_nulls = cursor.fetchall()

if recent_nulls:
    print(f'\n최근 30일간 수집된 null 레시피들:')
    for recipe in recent_nulls:
        print(f'  ID: {recipe["id"]}, 제목: {recipe["title"][:50]}..., 플랫폼: {recipe["platform"]}, 수집일: {recipe["collected_at"]}')
else:
    print(f'\n최근 30일간 수집된 null 레시피: 없음')

# 플랫폼별 최근 수집 현황
cursor.execute('''
    SELECT 
        platform,
        COUNT(*) as total,
        COUNT(CASE WHEN used_ingredients IS NULL OR used_ingredients = "" THEN 1 END) as null_count
    FROM recipes 
    WHERE collected_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    GROUP BY platform
    ORDER BY total DESC
''')
platform_stats = cursor.fetchall()

print(f'\n플랫폼별 최근 30일간 수집 현황:')
for stat in platform_stats:
    null_rate = stat["null_count"]/stat["total"]*100 if stat["total"] > 0 else 0
    print(f'  {stat["platform"]}: 전체 {stat["total"]}개, null {stat["null_count"]}개 ({null_rate:.1f}%)')

# 가장 최근에 수집된 레시피 10개 확인
cursor.execute('''
    SELECT id, title, platform, collected_at, used_ingredients, used_ingredients_block
    FROM recipes 
    ORDER BY collected_at DESC
    LIMIT 10
''')
latest_recipes = cursor.fetchall()

print(f'\n가장 최근에 수집된 레시피 10개:')
for recipe in latest_recipes:
    has_ingredients = "있음" if recipe["used_ingredients"] and recipe["used_ingredients"].strip() else "없음"
    has_block = "있음" if recipe["used_ingredients_block"] and recipe["used_ingredients_block"].strip() else "없음"
    print(f'  ID: {recipe["id"]}, 제목: {recipe["title"][:40]}..., 플랫폼: {recipe["platform"]}, 수집일: {recipe["collected_at"]}, 재료: {has_ingredients}, 블록: {has_block}')

cursor.close()
conn.close() 