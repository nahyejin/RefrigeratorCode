import pymysql

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

# recipes 테이블 구조 확인
print("=== Recipes 테이블 구조 ===")
cursor.execute('DESCRIBE recipes')
for row in cursor.fetchall():
    print(f"{row['Field']}: {row['Type']}")

print("\n=== 샘플 데이터 확인 ===")
cursor.execute('SELECT * FROM recipes LIMIT 1')
sample = cursor.fetchone()
if sample:
    for key, value in sample.items():
        print(f"{key}: {value}")

db.close() 