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
month_ago = today - timedelta(days=30)  # 최근 30일
month_start = datetime(today.year, today.month, 1)

print("=== 날짜 범위 확인 ===")
print(f"오늘: {today.strftime('%Y-%m-%d')}")
print(f"1주일 전: {week_ago.strftime('%Y-%m-%d')}")
print(f"30일 전: {month_ago.strftime('%Y-%m-%d')}")
print(f"이번달 시작: {month_start.strftime('%Y-%m-%d')}")

# 각 기간별 레시피 수 확인
print("\n=== 기간별 레시피 수 ===")

# 오늘
cursor.execute("SELECT COUNT(*) as count FROM recipes WHERE DATE(post_time) = %s", (today.strftime('%Y-%m-%d'),))
today_count = cursor.fetchone()['count']
print(f"오늘 ({today.strftime('%Y-%m-%d')}): {today_count}개")

# 이번주
cursor.execute("SELECT COUNT(*) as count FROM recipes WHERE DATE(post_time) >= %s AND DATE(post_time) <= %s", 
              (week_ago.strftime('%Y-%m-%d'), today.strftime('%Y-%m-%d')))
week_count = cursor.fetchone()['count']
print(f"이번주 ({week_ago.strftime('%Y-%m-%d')} ~ {today.strftime('%Y-%m-%d')}): {week_count}개")

# 최근 30일
cursor.execute("SELECT COUNT(*) as count FROM recipes WHERE DATE(post_time) >= %s AND DATE(post_time) <= %s", 
              (month_ago.strftime('%Y-%m-%d'), today.strftime('%Y-%m-%d')))
month_30_count = cursor.fetchone()['count']
print(f"최근 30일 ({month_ago.strftime('%Y-%m-%d')} ~ {today.strftime('%Y-%m-%d')}): {month_30_count}개")

# 이번달 (1일부터)
cursor.execute("SELECT COUNT(*) as count FROM recipes WHERE DATE(post_time) >= %s AND DATE(post_time) <= %s", 
              (month_start.strftime('%Y-%m-%d'), today.strftime('%Y-%m-%d')))
month_count = cursor.fetchone()['count']
print(f"이번달 ({month_start.strftime('%Y-%m-%d')} ~ {today.strftime('%Y-%m-%d')}): {month_count}개")

# 전체
cursor.execute("SELECT COUNT(*) as count FROM recipes")
total_count = cursor.fetchone()['count']
print(f"전체: {total_count}개")

# 최근 날짜 데이터 샘플 확인
print("\n=== 최근 날짜 데이터 샘플 ===")
cursor.execute("SELECT id, title, post_time FROM recipes ORDER BY post_time DESC LIMIT 10")
recent_recipes = cursor.fetchall()
for recipe in recent_recipes:
    print(f"ID: {recipe['id']}, 제목: {recipe['title'][:30]}..., 날짜: {recipe['post_time']}")

db.close() 