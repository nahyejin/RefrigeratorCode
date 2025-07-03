import requests
import json

def test_api(url, name):
    print(f"\n=== {name} 테스트 ===")
    try:
        response = requests.get(url)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ 성공: {len(data.get('recipes', []))}개 레시피")
            return True
        else:
            print(f"❌ 실패: {response.status_code}")
            print(f"응답: {response.text}")
            return False
    except Exception as e:
        print(f"❌ 연결 오류: {e}")
        return False

# 테스트할 API들
apis = [
    ("http://localhost:5000/api/recipes/filter?page=1&size=20&match_rate_min=30&match_rate_max=100&sort_by=match_rate", "필터링 API"),
    ("http://localhost:5000/api/recipes/popular?period=30&size=30", "인기 레시피 API"),
    ("http://localhost:5000/api/recipes?page=1&size=20", "기존 API (비교용)")
]

print("로컬 Flask 서버 API 테스트")
print("=" * 50)

results = []
for url, name in apis:
    results.append(test_api(url, name))

print("\n" + "=" * 50)
print("테스트 결과 요약:")
for i, (url, name) in enumerate(apis):
    status = "✅ 성공" if results[i] else "❌ 실패"
    print(f"{name}: {status}") 