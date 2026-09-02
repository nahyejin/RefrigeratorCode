import pandas as pd
import pymysql

# CSV 파일 경로
csv_path = "C:/Users/user/Desktop/recipes.csv"

# CSV 로드 (UTF-8 인코딩)
df = pd.read_csv(csv_path, encoding='utf-8')

# 컬럼 순서 맞추기 (DB 컬럼 순서와 동일하게)
df = df[['id', 'title', 'link', 'content', 'used_ingredients', 'used_ingredients_block',
         'block_reason', 'author', 'thumbnail', 'platform', 'hits', 'likes', 'comments', 'post_time', 'collected_at']]

# DB 연결
conn = pymysql.connect(
    host='caboose.proxy.rlwy.net',
    port=47779,
    user='root',
    password='HkqYFCoKPPPxgryxiEbUYxcYynQXxeRF',
    database='railway',
    charset='utf8mb4',
    # 서버 시계가 UTC 라 세션 타임존을 KST 로 고정한다(backend/app.py 와 동일).
    # 빠뜨리면 이 스크립트가 쓰는 NOW() 만 9시간 느리게 찍힌다.
    init_command="SET time_zone = '+09:00'",
)
cursor = conn.cursor()

# INSERT 쿼리
sql = """
    INSERT INTO recipes (
        id, title, link, content, used_ingredients, used_ingredients_block,
        block_reason, author, thumbnail, platform, hits, likes, comments, post_time, collected_at
    )
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
"""

# 데이터 업로드 (1000건마다 커밋)
for i, row in df.iterrows():
    # 타입 변환: post_time/date, collected_at/datetime
    row = row.copy()
    if pd.notnull(row['post_time']):
        row['post_time'] = str(row['post_time'])[:10]  # YYYY-MM-DD
    else:
        row['post_time'] = None
    if pd.notnull(row['collected_at']):
        row['collected_at'] = str(row['collected_at'])[:19]  # YYYY-MM-DD HH:MM:SS
    else:
        row['collected_at'] = None
    values = tuple(row.fillna(None))
    try:
        cursor.execute(sql, values)
    except Exception as e:
        print(f"Error at row {i}: {e}")
    if (i + 1) % 1000 == 0:
        conn.commit()
        print(f"{i + 1} rows inserted...")

conn.commit()
conn.close()
print("All done!") 