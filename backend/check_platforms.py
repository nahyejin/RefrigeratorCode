import pymysql
from datetime import datetime, timedelta

# Railway 데이터베이스 연결
db = pymysql.connect(
    host='caboose.proxy.rlwy.net',
    user='root',
    password='HkqYFCoKPPPxgryxiEbUYxcYynQXxeRF',
    db='railway',
    port=47779,
    charset='utf8mb4',
    cursorclass=pymysql.cursors.DictCursor
)

cursor = db.cursor()

# 오늘 날짜
today = datetime.now()
week_ago = today - timedelta(days=7)
month_ago = today - timedelta(days=30)

print("=== 플랫폼별 레시피 수 ===")

# 전체 플랫폼별 수
cursor.execute("SELECT platform, COUNT(*) as count FROM recipes GROUP BY platform ORDER BY count DESC")
platform_counts = cursor.fetchall()
for row in platform_counts:
    print(f"{row['platform']}: {row['count']}개")

print("\n=== 기간별 플랫폼별 레시피 수 ===")

# 최근 7일 플랫폼별 수
cursor.execute("""
    SELECT platform, COUNT(*) as count 
    FROM recipes 
    WHERE DATE(post_time) >= %s AND DATE(post_time) <= %s 
    GROUP BY platform 
    ORDER BY count DESC
""", (week_ago.strftime('%Y-%m-%d'), today.strftime('%Y-%m-%d')))
week_platform_counts = cursor.fetchall()
print(f"최근 7일 ({week_ago.strftime('%Y-%m-%d')} ~ {today.strftime('%Y-%m-%d')}):")
for row in week_platform_counts:
    print(f"  {row['platform']}: {row['count']}개")

# 최근 30일 플랫폼별 수
cursor.execute("""
    SELECT platform, COUNT(*) as count 
    FROM recipes 
    WHERE DATE(post_time) >= %s AND DATE(post_time) <= %s 
    GROUP BY platform 
    ORDER BY count DESC
""", (month_ago.strftime('%Y-%m-%d'), today.strftime('%Y-%m-%d')))
month_platform_counts = cursor.fetchall()
print(f"\n최근 30일 ({month_ago.strftime('%Y-%m-%d')} ~ {today.strftime('%Y-%m-%d')}):")
for row in month_platform_counts:
    print(f"  {row['platform']}: {row['count']}개")

# 유튜브 레시피 샘플 확인
print("\n=== 유튜브 레시피 샘플 ===")
cursor.execute("""
    SELECT id, title, platform, post_time 
    FROM recipes 
    WHERE platform LIKE '%youtube%' 
    ORDER BY post_time DESC 
    LIMIT 5
""")
youtube_samples = cursor.fetchall()
for recipe in youtube_samples:
    print(f"ID: {recipe['id']}, 제목: {recipe['title'][:30]}..., 플랫폼: {recipe['platform']}, 날짜: {recipe['post_time']}")

db.close() 