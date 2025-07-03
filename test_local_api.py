import requests
import json

# 로컬 필터링 API 테스트
api_url = "http://localhost:5000/api/recipes/filter?match_rate_min=30&match_rate_max=100&sort_by=match_rate&size=20"

try:
    response = requests.get(api_url)
    if response.status_code == 200:
        data = response.json()
        print("=== 로컬 필터링 API 응답 상세 분석 ===")
        print(f"응답 레시피 수: {len(data.get('recipes', []))}")
        print(f"총 레시피 수: {data.get('total', 0)}")
        print(f"페이지: {data.get('page', 1)}")
        print(f"페이지 크기: {data.get('size', 20)}")
        print(f"적용된 필터: {data.get('filters', {})}")
        
        recipes = data.get('recipes', [])
        # 플랫폼별 분포
        platform_counts = {}
        for recipe in recipes:
            platform = recipe.get('platform', 'unknown')
            platform_counts[platform] = platform_counts.get(platform, 0) + 1
        print("\n=== 플랫폼별 분포 ===")
        for platform, count in platform_counts.items():
            print(f"{platform}: {count}개")
        
        # 유튜브 레시피 상세 확인
        youtube_recipes = [r for r in recipes if 'youtube' in r.get('platform', '').lower()]
        print(f"\n=== 유튜브 레시피 ({len(youtube_recipes)}개) ===")
        for i, recipe in enumerate(youtube_recipes[:5]):
            print(f"{i+1}. ID: {recipe.get('id')}, 제목: {recipe.get('title', 'N/A')[:30]}..., 플랫폼: {recipe.get('platform', 'N/A')}")
        
        # 네이버 레시피 상세 확인
        naver_recipes = [r for r in recipes if 'naver' in r.get('platform', '').lower()]
        print(f"\n=== 네이버 레시피 ({len(naver_recipes)}개) ===")
        for i, recipe in enumerate(naver_recipes[:5]):
            print(f"{i+1}. ID: {recipe.get('id')}, 제목: {recipe.get('title', 'N/A')[:30]}..., 플랫폼: {recipe.get('platform', 'N/A')}")
        
        # ID 범위 확인
        if recipes:
            ids = [r.get('id', 0) for r in recipes]
            print(f"\n=== ID 범위 ===")
            print(f"최소 ID: {min(ids)}")
            print(f"최대 ID: {max(ids)}")
            print(f"ID 정렬: {'내림차순' if ids[0] > ids[-1] else '오름차순'}")
    else:
        print(f"API 오류: {response.status_code}")
        print(response.text)
except Exception as e:
    print(f"연결 오류: {e}")
 