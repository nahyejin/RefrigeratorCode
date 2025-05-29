import os
import logging
from datetime import datetime
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from database import Database

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# YouTube API 키 설정
YOUTUBE_API_KEY = 'AIzaSyAHp_0bod-XWi5yNItEhQu16VWKy-fBA2Q'

# YouTube API 클라이언트 초기화
youtube = build('youtube', 'v3', developerKey=YOUTUBE_API_KEY)

# 데이터베이스 초기화
db = Database()

def extract_channel_id(channel_url):
    """채널 URL에서 채널 ID를 추출하는 함수"""
    try:
        # URL에서 채널 ID 추출 로직
        if 'youtube.com/channel/' in channel_url:
            return channel_url.split('youtube.com/channel/')[1].split('/')[0]
        elif 'youtube.com/c/' in channel_url:
            # 커스텀 URL의 경우 추가 API 호출 필요
            return None
        return None
    except Exception as e:
        logger.error(f"Error extracting channel ID: {str(e)}")
        return None

def get_channel_info(channel_id):
    """채널 정보를 가져오는 함수"""
    try:
        response = youtube.channels().list(
            part='snippet,statistics',
            id=channel_id
        ).execute()
        
        if response['items']:
            return response['items'][0]
        return None
    except HttpError as e:
        logger.error(f"Error getting channel info: {str(e)}")
        return None

def get_channel_videos(channel_id, max_results=50):
    """채널의 최근 동영상을 가져오는 함수"""
    try:
        # 채널의 업로드 플레이리스트 ID 가져오기
        response = youtube.channels().list(
            part='contentDetails',
            id=channel_id
        ).execute()
        
        if not response['items']:
            return []
            
        uploads_playlist_id = response['items'][0]['contentDetails']['relatedPlaylists']['uploads']
        
        # 플레이리스트의 동영상 가져오기
        videos = []
        next_page_token = None
        
        while True:
            response = youtube.playlistItems().list(
                part='snippet',
                playlistId=uploads_playlist_id,
                maxResults=min(50, max_results - len(videos)),
                pageToken=next_page_token
            ).execute()
            
            videos.extend(response['items'])
            
            next_page_token = response.get('nextPageToken')
            if not next_page_token or len(videos) >= max_results:
                break
                
        return videos
    except HttpError as e:
        logger.error(f"Error getting channel videos: {str(e)}")
        return []

def is_recipe_video(video):
    """동영상이 레시피인지 확인하는 함수"""
    try:
        title = video['snippet']['title'].lower()
        description = video['snippet']['description'].lower()
        
        # 레시피 관련 키워드
        recipe_keywords = ['레시피', 'recipe', '요리', 'cooking', '음식', 'food']
        
        return any(keyword in title or keyword in description for keyword in recipe_keywords)
    except Exception as e:
        logger.error(f"Error checking if video is recipe: {str(e)}")
        return False

def create_recipe_from_video(video, influencer_name):
    """동영상 정보로부터 레시피 객체를 생성하는 함수"""
    try:
        video_id = video['snippet']['resourceId']['videoId']
        published_at = datetime.strptime(video['snippet']['publishedAt'], '%Y-%m-%dT%H:%M:%SZ')
        
        return {
            'title': video['snippet']['title'],
            'link': f"https://www.youtube.com/watch?v={video_id}",
            'content': video['snippet']['description'],
            'used_ingredients': '',  # YouTube API로는 재료 정보를 가져올 수 없음
            'used_ingredients_block': 'N',
            'block_reason': None,
            'author': influencer_name,
            'thumbnail': video['snippet']['thumbnails']['high']['url'],
            'platform': 'youtube',
            'likes': 0,  # 동영상 통계는 별도 API 호출 필요
            'comments': 0,  # 동영상 통계는 별도 API 호출 필요
            'post_time': published_at.date(),
            'collected_at': datetime.now()
        }
    except Exception as e:
        logger.error(f"Error creating recipe from video: {str(e)}")
        return None

def process_influencer(influencer):
    """인플루언서의 레시피를 처리하는 함수"""
    try:
        if not influencer.get('channel_url'):
            logger.warning(f"Skipping influencer {influencer.get('name')} - No channel URL provided")
            return
            
        logger.info(f"Processing influencer: {influencer['name']}")
        
        # 채널 URL에서 채널 ID 추출
        channel_id = extract_channel_id(influencer['channel_url'])
        if not channel_id:
            logger.error(f"Could not extract channel ID from URL: {influencer['channel_url']}")
            return
            
        # 채널 정보 가져오기
        channel_info = get_channel_info(channel_id)
        if not channel_info:
            logger.error(f"Could not get channel info for: {influencer['name']}")
            return
            
        # 채널의 최근 동영상 가져오기
        videos = get_channel_videos(channel_id)
        if not videos:
            logger.warning(f"No videos found for channel: {influencer['name']}")
            return
            
        # 레시피 동영상 필터링 및 저장
        recipe_count = 0
        for video in videos:
            if is_recipe_video(video):
                recipe = create_recipe_from_video(video, influencer['name'])
                if recipe:
                    db.save_recipe(recipe)
                    recipe_count += 1
                    
        logger.info(f"Processed {recipe_count} recipes from {influencer['name']}")
        
    except Exception as e:
        logger.error(f"Error processing influencer {influencer.get('name')}: {str(e)}")
        raise

if __name__ == '__main__':
    # 테스트용 인플루언서 데이터
    test_influencer = {
        'name': '백종원',
        'channel_url': 'https://www.youtube.com/channel/UCyn-K7rZLXjGl7VXGweIlcA'
    }
    
    try:
        process_influencer(test_influencer)
    except Exception as e:
        logger.error(f"Error in main execution: {str(e)}")
    finally:
        db.close() 