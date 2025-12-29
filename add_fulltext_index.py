"""
Railway MySQL에 FULLTEXT 인덱스를 추가하는 스크립트
"""
import pymysql
import os
from dotenv import load_dotenv

# 환경변수 로드
if os.getenv('FLASK_ENV', '').lower() == 'development' or not os.getenv('GOOGLE_CLIENT_ID'):
    load_dotenv(override=False)

# Railway 환경변수 우선 사용
# 외부 접근을 위해 공개 도메인/포트 사용
db_host = (
    os.getenv('RAILWAY_TCP_PROXY_DOMAIN')  # Railway 공개 도메인 (외부 접근용)
    or os.getenv('MYSQLHOST')  # Railway 내부 환경변수
    or os.getenv('DB_HOST')
    or os.getenv('MYSQL_HOST')
    or 'localhost'
)
db_user = (
    os.getenv('MYSQLUSER')  # Railway 환경변수
    or os.getenv('DB_USER')
    or os.getenv('MYSQL_USER')
    or 'root'
)
db_password = (
    os.getenv('MYSQLPASSWORD')  # Railway 환경변수
    or os.getenv('DB_PASSWORD')
    or os.getenv('MYSQL_PASSWORD')
    or ''
)
db_name = (
    os.getenv('MYSQLDATABASE')  # Railway 환경변수
    or os.getenv('MYSQL_DATABASE')
    or os.getenv('DB_NAME')
    or 'cookmatch'
)
db_port = int(
    os.getenv('RAILWAY_TCP_PROXY_PORT')  # Railway 공개 포트 (외부 접근용)
    or os.getenv('MYSQLPORT')  # Railway 환경변수
    or os.getenv('DB_PORT')
    or os.getenv('MYSQL_PORT')
    or 3306
)

print(f"데이터베이스 연결 시도: {db_host}:{db_port}/{db_name}")

try:
    # 데이터베이스 연결
    connection = pymysql.connect(
        host=db_host,
        user=db_user,
        password=db_password,
        database=db_name,
        port=db_port,
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor
    )
    
    print("✓ 데이터베이스 연결 성공!")
    
    with connection.cursor() as cursor:
        # 기존 인덱스 확인
        print("\n기존 인덱스 확인 중...")
        cursor.execute("SHOW INDEX FROM recipes WHERE Key_name = 'ft_title_content'")
        existing_index = cursor.fetchone()
        
        if existing_index:
            print("⚠ ft_title_content 인덱스가 이미 존재합니다.")
        else:
            print("→ FULLTEXT 인덱스 추가 중...")
            # FULLTEXT 인덱스 추가
            cursor.execute("""
                ALTER TABLE recipes 
                ADD FULLTEXT INDEX ft_title_content (title, content)
            """)
            connection.commit()
            print("✓ FULLTEXT 인덱스 추가 완료!")
        
        # 인덱스 확인
        print("\n인덱스 확인 중...")
        cursor.execute("SHOW INDEX FROM recipes WHERE Key_name = 'ft_title_content'")
        index_info = cursor.fetchall()
        
        if index_info:
            print("\n✓ 인덱스 정보:")
            for idx in index_info:
                print(f"  - Key_name: {idx['Key_name']}")
                print(f"  - Column_name: {idx['Column_name']}")
                print(f"  - Index_type: {idx['Index_type']}")
        else:
            print("⚠ 인덱스를 찾을 수 없습니다.")
    
    connection.close()
    print("\n✓ 작업 완료!")
    
except Exception as e:
    print(f"\n✗ 오류 발생: {e}")
    import traceback
    traceback.print_exc()

