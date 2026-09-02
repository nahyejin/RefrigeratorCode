import pymysql
import os
from datetime import datetime, timedelta

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
    
    print("=== 오래된 레시피 데이터 정리 ===\n")
    
    # 현재 데이터 확인
    cursor.execute("SELECT COUNT(*) as total FROM recipes")
    total_before = cursor.fetchone()['total']
    print(f"정리 전 레시피 수: {total_before:,}개\n")
    
    # 옵션 선택
    print("정리 옵션:")
    print("1. 60일 이상 된 데이터 삭제")
    print("2. 90일 이상 된 데이터 삭제")
    print("3. 180일 이상 된 데이터 삭제")
    print("4. 재료가 3개 이하인 오래된 데이터 삭제 (30일 이상)")
    
    choice = input("\n선택 (1-4): ").strip()
    
    if choice == '1':
        days = 60
        query = "DELETE FROM recipes WHERE collected_at < DATE_SUB(NOW(), INTERVAL 60 DAY)"
    elif choice == '2':
        days = 90
        query = "DELETE FROM recipes WHERE collected_at < DATE_SUB(NOW(), INTERVAL 90 DAY)"
    elif choice == '3':
        days = 180
        query = "DELETE FROM recipes WHERE collected_at < DATE_SUB(NOW(), INTERVAL 180 DAY)"
    elif choice == '4':
        days = 30
        query = """
        DELETE FROM recipes 
        WHERE collected_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
        AND (LENGTH(used_ingredients) - LENGTH(REPLACE(used_ingredients, ',', '')) + 1) <= 3
        """
    else:
        print("잘못된 선택입니다.")
        conn.close()
        exit()
    
    # 삭제될 데이터 수 확인
    if choice == '4':
        cursor.execute("""
            SELECT COUNT(*) as count 
            FROM recipes 
            WHERE collected_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
            AND (LENGTH(used_ingredients) - LENGTH(REPLACE(used_ingredients, ',', '')) + 1) <= 3
        """)
    else:
        cursor.execute(f"SELECT COUNT(*) as count FROM recipes WHERE collected_at < DATE_SUB(NOW(), INTERVAL {days} DAY)")
    
    delete_count = cursor.fetchone()['count']
    print(f"\n삭제될 레시피 수: {delete_count:,}개")
    
    if delete_count == 0:
        print("삭제할 데이터가 없습니다.")
        conn.close()
        exit()
    
    # 확인
    confirm = input(f"\n정말 {delete_count:,}개의 레시피를 삭제하시겠습니까? (yes/no): ").strip().lower()
    
    if confirm != 'yes':
        print("취소되었습니다.")
        conn.close()
        exit()
    
    # 삭제 실행
    print("\n삭제 중...")
    cursor.execute(query)
    deleted = cursor.rowcount
    conn.commit()
    
    # 결과 확인
    cursor.execute("SELECT COUNT(*) as total FROM recipes")
    total_after = cursor.fetchone()['total']
    
    print(f"\n✅ 삭제 완료!")
    print(f"   삭제된 레시피: {deleted:,}개")
    print(f"   정리 후 레시피 수: {total_after:,}개")
    print(f"   절약된 공간: 약 {deleted * 0.008:.2f} MB (추정)")
    
    # 테이블 최적화
    print("\n테이블 최적화 중...")
    try:
        cursor.execute("OPTIMIZE TABLE recipes")
        print("✅ 테이블 최적화 완료")
    except Exception as e:
        print(f"⚠️ 테이블 최적화 실패: {e}")
    
    conn.close()
    print("\n=== 정리 완료 ===")
    
except Exception as e:
    print(f"오류 발생: {e}")
    import traceback
    traceback.print_exc()

