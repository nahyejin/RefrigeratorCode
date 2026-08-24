from googleapiclient.discovery import build
import os
from dotenv import load_dotenv

load_dotenv()


def test_youtube_api_key():
    # 환경 변수에서 API 키 가져오기
    api_key = os.getenv('YOUTUBE_API_KEY')
    if not api_key:
        print("API 키가 설정되지 않았습니다.")
        return

    # YouTube API 클라이언트 생성
    youtube = build('youtube', 'v3', developerKey=api_key)

    # 간단한 검색 요청
    request = youtube.search().list(
        part='snippet',
        q='test',
        type='video',
        maxResults=1
    )

    try:
        response = request.execute()
        print("API 키가 유효합니다. 응답:", response)
    except Exception as e:
        print("API 키가 유효하지 않거나 오류가 발생했습니다:", e)


if __name__ == "__main__":
    test_youtube_api_key() 