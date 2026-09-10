import requests
import json
import pymysql
# 저장소 뿌리의 `db_env` 를 불러온다 — 접속 정보는 코드가 아니라
# `backend/.env` 에만 있다. 이 저장소는 공개다.
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.abspath(_os.path.join(_os.path.dirname(__file__), '..')))
from db_env import connect as _connect

# 직접 데이터베이스에서 확인
print("=== 직접 데이터베이스 쿼리 테스트 ===")
db = _connect()

cursor = db.cursor()

# 최근 30일 유튜브 레시피 확인
cursor.execute("""
    SELECT id, title, platform, post_time, likes, comments, hits
    FROM recipes
    WHERE post_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    AND platform LIKE '%youtube%'
    ORDER BY (1.0 * COALESCE(likes, 0) + 2.0 * COALESCE(comments, 0) + 0.5 * COALESCE(hits, 0)) DESC
    LIMIT 5
""")
youtube_recipes = cursor.fetchall()
print(f"YouTube 레시피 수: {len(youtube_recipes)}")
for recipe in youtube_recipes:
    print(f"- ID: {recipe['id']}, 제목: {recipe['title'][:30]}..., 플랫폼: {recipe['platform']}")

# 최근 30일 네이버 레시피 확인
cursor.execute("""
    SELECT id, title, platform, post_time, likes, comments
    FROM recipes
    WHERE post_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    AND platform LIKE '%naver%'
    ORDER BY (1.0 * COALESCE(likes, 0) + 2.0 * COALESCE(comments, 0)) DESC
    LIMIT 5
""")
naver_recipes = cursor.fetchall()
print(f"\nNaver 레시피 수: {len(naver_recipes)}")
for recipe in naver_recipes:
    print(f"- ID: {recipe['id']}, 제목: {recipe['title'][:30]}..., 플랫폼: {recipe['platform']}")

db.close()

print("\n=== API 응답 테스트 ===")
# API 테스트
try:
    response = requests.get('https://refrigeratorcode-production.up.railway.app/api/recipes/popular?period_type=month&size=5')
    if response.status_code == 200:
        data = response.json()
        print(f"API 응답 상태: {response.status_code}")
        print(f"응답 구조: {list(data.keys())}")
        print(f"YouTube 레시피 수: {len(data.get('youtube', []))}")
        print(f"Naver 레시피 수: {len(data.get('naver', []))}")
        
        if data.get('youtube'):
            print(f"YouTube 첫 번째 레시피: {data['youtube'][0].get('title', 'No title')[:30]}")
        if data.get('naver'):
            print(f"Naver 첫 번째 레시피: {data['naver'][0].get('title', 'No title')[:30]}")
    else:
        print(f"API 오류: {response.status_code}")
        print(response.text)
except Exception as e:
    print(f"연결 오류: {e}") 