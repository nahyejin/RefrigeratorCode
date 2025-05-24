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

# 테이블 초기화
cursor.execute("TRUNCATE TABLE recipes")
db.commit()
print("recipes 테이블이 초기화되었습니다.")

db.close() 