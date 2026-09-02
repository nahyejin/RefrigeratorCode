import pymysql
import os

# DB 연결
db_config = {
    'host': os.getenv('DB_HOST') or os.getenv('MYSQLHOST') or os.getenv('MYSQL_HOST') or 'caboose.proxy.rlwy.net',
    'user': os.getenv('DB_USER') or os.getenv('MYSQLUSER') or os.getenv('MYSQL_USER') or 'root',
    'password': os.getenv('DB_PASSWORD') or os.getenv('MYSQLPASSWORD') or os.getenv('MYSQL_PASSWORD') or 'HkqYFCoKPPPxgryxiEbUYxcYynQXxeRF',
    'db': os.getenv('DB_NAME') or os.getenv('MYSQLDATABASE') or os.getenv('MYSQL_DATABASE') or 'railway',
    'port': int(os.getenv('DB_PORT') or os.getenv('MYSQLPORT') or os.getenv('MYSQL_PORT') or 47779),
    'charset': 'utf8mb4',
    # 서버 시계가 UTC 라 세션 타임존을 KST 로 고정한다(backend/app.py 와 동일).
    # 빠뜨리면 이 스크립트가 쓰는 NOW() 만 9시간 느리게 찍힌다.
    'init_command': "SET time_zone = '+09:00'",
    'cursorclass': pymysql.cursors.DictCursor
}

try:
    conn = pymysql.connect(**db_config)
    cursor = conn.cursor()
    
    print("=== 데이터베이스 상태 확인 ===\n")
    
    # 1. recipes 테이블 크기 확인
    print("1. recipes 테이블 정보:")
    cursor.execute("""
        SELECT 
            table_name,
            ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size (MB)',
            table_rows AS 'Rows'
        FROM information_schema.TABLES 
        WHERE table_schema = %s AND table_name = 'recipes'
    """, (db_config['db'],))
    result = cursor.fetchone()
    if result:
        print(f"   테이블 크기: {result['Size (MB)']} MB")
        print(f"   레코드 수: {result['Rows']:,}개")
    else:
        print("   테이블 정보를 찾을 수 없습니다.")
    
    # 2. 전체 레시피 수 확인
    cursor.execute("SELECT COUNT(*) as total FROM recipes")
    total = cursor.fetchone()['total']
    print(f"\n2. 전체 레시피 수: {total:,}개")
    
    # 3. 중복 데이터 확인
    cursor.execute("""
        SELECT link, COUNT(*) as count 
        FROM recipes 
        GROUP BY link 
        HAVING count > 1 
        ORDER BY count DESC 
        LIMIT 10
    """)
    duplicates = cursor.fetchall()
    if duplicates:
        print(f"\n3. 중복된 레시피 (상위 10개):")
        for dup in duplicates:
            print(f"   {dup['link']}: {dup['count']}개")
    else:
        print("\n3. 중복된 레시피 없음")
    
    # 4. 최근 수집된 데이터 확인
    cursor.execute("""
        SELECT 
            DATE(collected_at) as date,
            COUNT(*) as count
        FROM recipes
        WHERE collected_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY DATE(collected_at)
        ORDER BY date DESC
    """)
    recent = cursor.fetchall()
    if recent:
        print("\n4. 최근 7일간 수집된 레시피:")
        for r in recent:
            print(f"   {r['date']}: {r['count']:,}개")
    
    # 5. MySQL 변수 확인 (임시 테이블 크기 등)
    print("\n5. MySQL 설정 확인:")
    cursor.execute("SHOW VARIABLES LIKE 'tmp_table_size'")
    tmp_size = cursor.fetchone()
    if tmp_size:
        print(f"   tmp_table_size: {int(tmp_size['Value']) / 1024 / 1024:.2f} MB")
    
    cursor.execute("SHOW VARIABLES LIKE 'max_heap_table_size'")
    heap_size = cursor.fetchone()
    if heap_size:
        print(f"   max_heap_table_size: {int(heap_size['Value']) / 1024 / 1024:.2f} MB")
    
    # 6. 디스크 공간 확인 (가능한 경우)
    try:
        cursor.execute("SHOW VARIABLES LIKE 'innodb_data_file_path'")
        innodb_path = cursor.fetchone()
        if innodb_path:
            print(f"   innodb_data_file_path: {innodb_path['Value']}")
    except:
        pass
    
    conn.close()
    print("\n=== 확인 완료 ===")
    
except Exception as e:
    print(f"오류 발생: {e}")

