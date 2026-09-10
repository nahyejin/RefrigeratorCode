import pymysql
# 저장소 뿌리의 `db_env` 를 불러온다 — 접속 정보는 코드가 아니라
# `backend/.env` 에만 있다. 이 저장소는 공개다.
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.abspath(_os.path.join(_os.path.dirname(__file__), '..')))
from db_env import connect as _connect

# Railway 데이터베이스 연결
db = _connect()

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