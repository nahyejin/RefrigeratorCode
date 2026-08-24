import pymysql
from datetime import datetime, timedelta

# DB 연결
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

# 전체 YouTube 레시피 수
cursor.execute("SELECT COUNT(*) as total FROM recipes WHERE platform LIKE '%youtube%'")
result = cursor.fetchone()
print(f"전체 YouTube 레시피: {result['total']}개")

# 최근 1시간 내 추가된 데이터
cursor.execute("SELECT COUNT(*) as total FROM recipes WHERE platform LIKE '%youtube%' AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)")
result = cursor.fetchone()
print(f"최근 1시간 내 추가된 YouTube 레시피: {result['total']}개")

# 최근 24시간 내 추가된 데이터
cursor.execute("SELECT COUNT(*) as total FROM recipes WHERE platform LIKE '%youtube%' AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)")
result = cursor.fetchone()
print(f"최근 24시간 내 추가된 YouTube 레시피: {result['total']}개")

# 최근 추가된 5개 레시피
cursor.execute("SELECT title, created_at, post_time FROM recipes WHERE platform LIKE '%youtube%' ORDER BY created_at DESC LIMIT 5")
results = cursor.fetchall()
print("\n최근 추가된 5개 레시피:")
for r in results:
    print(f"- {r['title']} (생성: {r['created_at']}, 게시: {r['post_time']})")

# 오늘 게시된 영상 수
cursor.execute("SELECT COUNT(*) as total FROM recipes WHERE platform LIKE '%youtube%' AND post_time >= CURDATE()")
result = cursor.fetchone()
print(f"\n오늘 게시된 YouTube 영상: {result['total']}개")

# 최근 7일 게시된 영상 수
cursor.execute("SELECT COUNT(*) as total FROM recipes WHERE platform LIKE '%youtube%' AND post_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)")
result = cursor.fetchone()
print(f"최근 7일 게시된 YouTube 영상: {result['total']}개")

db.close() 