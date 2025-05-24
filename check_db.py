import pymysql

# MySQL 연결
db = pymysql.connect(
    host='localhost',
    user='root',
    password='sk784512!!',
    db='refrigerator',
    charset='utf8mb4',
    cursorclass=pymysql.cursors.DictCursor
)

cursor = db.cursor()

# 레코드 수 확인
cursor.execute("SELECT COUNT(*) as count FROM recipes")
result = cursor.fetchone()
print(f"현재 recipes 테이블의 레코드 수: {result['count']}")

# 최근 추가된 레코드 확인
cursor.execute("SELECT title, post_time, collected_at FROM recipes ORDER BY collected_at DESC LIMIT 5")
recent_records = cursor.fetchall()
print("\n최근 추가된 레코드:")
for record in recent_records:
    print(f"제목: {record['title']}")
    print(f"게시일: {record['post_time']}")
    print(f"수집일: {record['collected_at']}")
    print("---")

db.close() 