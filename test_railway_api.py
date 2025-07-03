import requests
import json

# Railway API 테스트
api_url = "https://refrigeratorcode-production.up.railway.app/api/recipes"

try:
    response = requests.get(api_url)
    if response.status_code == 200:
        data = response.json()
        print("=== Railway API 응답 테스트 ===")
        print(f"총 레시피 수: {data.get('total', 0)}")
        print(f"현재 페이지: {data.get('page', 1)}")
        
        if data.get('recipes') and len(data['recipes']) > 0:
            first_recipe = data['recipes'][0]
            print("\n=== 첫 번째 레시피 ===")
            print(f"제목: {first_recipe.get('title', 'N/A')}")
            print(f"작성자: {first_recipe.get('author', 'N/A')}")
            print(f"플랫폼: {first_recipe.get('platform', 'N/A')}")
            print(f"좋아요: {first_recipe.get('likes', 0)}")
            print(f"댓글: {first_recipe.get('comments', 0)}")
            
            # 한글 인코딩 확인
            title = first_recipe.get('title', '')
            if '\\u' in title:
                print("⚠️  한글이 유니코드 이스케이프 시퀀스로 인코딩됨")
                # 디코딩 시도
                try:
                    decoded_title = title.encode().decode('unicode_escape')
                    print(f"디코딩된 제목: {decoded_title}")
                except:
                    print("디코딩 실패")
            else:
                print("✅ 한글이 정상적으로 표시됨")
    else:
        print(f"API 오류: {response.status_code}")
        print(response.text)
        
except Exception as e:
    print(f"연결 오류: {e}") 