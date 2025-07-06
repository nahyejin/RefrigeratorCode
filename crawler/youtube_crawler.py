import os
import json
import pandas as pd
from datetime import datetime, timedelta
from googleapiclient.discovery import build
from dotenv import load_dotenv
import logging
from pathlib import Path
import time
import re
import pymysql
import urllib.parse
import subprocess
import sys

# Add ingredient_management directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'ingredient_management'))
from update_used_ingredients_batch import extract_best_ingredient_block, extract_ingredients

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('crawler.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class YouTubeCrawler:
    def __init__(self):
        load_dotenv()
        # 환경변수에서 API 키를 가져오거나 직접 설정
        self.api_key = os.getenv('YOUTUBE_API_KEY') or 'AIzaSyAHp_0bod-XWi5yNItEhQu16VWKy-fBA2Q'
        if not self.api_key:
            raise ValueError("YouTube API 키가 설정되지 않았습니다.")
        
        self.youtube = build('youtube', 'v3', developerKey=self.api_key)
        
        # DB 연결
        self.db = pymysql.connect(
            host='caboose.proxy.rlwy.net',
            user='root',
            password='HkqYFCoKPPPxgryxiEbUYxcYynQXxeRF',
            db='railway',
            port=3306,
            charset='utf8mb4',
            cursorclass=pymysql.cursors.DictCursor
        )
        
        # 할당량 추적 - 실제 API 응답 기반으로 관리
        self.daily_quota_limit = 9500
        self.quota_used = 0
        self.quota_exceeded = False
        
        # API 호출 카운터
        self.search_api_calls = 0
        self.videos_api_calls = 0
        
        # 채널 ID 캐시 테이블 생성
        self.create_channel_cache_table()
        
        # 에러 재시도 설정
        self.max_retries = 3
        self.retry_delay = 1  # 초
        
        # 할당량 상태 확인
        self.check_quota_status()
        
        logger.info(f"YouTube 크롤러 초기화 완료 - 할당량 제한: {self.daily_quota_limit} units")
    
    def create_channel_cache_table(self):
        """채널 ID 캐시 테이블 생성"""
        cursor = self.db.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS youtube_channel_cache (
                id INT AUTO_INCREMENT PRIMARY KEY,
                channel_url VARCHAR(255) UNIQUE NOT NULL,
                channel_id VARCHAR(50) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        self.db.commit()
        logger.info("채널 캐시 테이블 확인/생성 완료")
    
    def get_cached_channel_id(self, channel_url):
        """캐시에서 채널 ID 조회"""
        cursor = self.db.cursor()
        cursor.execute("SELECT channel_id FROM youtube_channel_cache WHERE channel_url = %s", (channel_url,))
        result = cursor.fetchone()
        if result:
            logger.info(f"캐시에서 채널 ID 조회: {channel_url} -> {result[0]}")
            return result[0]
        return None
    
    def save_channel_id_to_cache(self, channel_url, channel_id):
        """채널 ID를 캐시에 저장"""
        cursor = self.db.cursor()
        try:
            cursor.execute("""
                INSERT INTO youtube_channel_cache (channel_url, channel_id) 
                VALUES (%s, %s) 
                ON DUPLICATE KEY UPDATE channel_id = VALUES(channel_id)
            """, (channel_url, channel_id))
            self.db.commit()
            logger.info(f"캐시에 채널 ID 저장: {channel_url} -> {channel_id}")
        except Exception as e:
            logger.error(f"캐시 저장 실패: {e}")
    
    def log_api_call(self, api_type, description, cost):
        """API 호출 로깅"""
        self.quota_used += cost
        if api_type == 'search':
            self.search_api_calls += 1
        elif api_type == 'videos':
            self.videos_api_calls += 1
            
        logger.info(f"API 호출: {api_type} - {description} (할당량 비용: {cost}, 총 사용량: {self.quota_used})")
        
        # 할당량 체크 - 실제 API 응답을 기반으로 하므로 여기서는 로깅만
        if self.quota_used >= self.daily_quota_limit:
            logger.warning(f"예상 할당량 초과! (사용량: {self.quota_used}/{self.daily_quota_limit})")
    
    def make_api_request_with_retry(self, request_func, *args, **kwargs):
        """API 요청을 재시도 로직과 함께 실행"""
        for attempt in range(self.max_retries):
            try:
                if callable(request_func):
                    return request_func(*args, **kwargs)
                else:
                    return request_func.execute()
            except Exception as e:
                error_str = str(e)
                if 'quotaExceeded' in error_str or '403' in error_str and 'quota' in error_str.lower():
                    self.quota_exceeded = True
                    logger.error(f"할당량 초과로 조기 종료 (시도 {attempt + 1}/{self.max_retries})")
                    logger.error(f"API 에러: {error_str}")
                    # 할당량 초과 시 즉시 종료
                    raise e
                elif attempt < self.max_retries - 1:
                    wait_time = self.retry_delay * (2 ** attempt)  # 지수 백오프
                    logger.warning(f"API 요청 실패, {wait_time}초 후 재시도 ({attempt + 1}/{self.max_retries}): {e}")
                    time.sleep(wait_time)
                else:
                    logger.error(f"API 요청 최종 실패: {e}")
                    raise e
    
    def check_quota_remaining(self, required_quota):
        """할당량 잔여량 확인 - 실제 API 응답 기반으로 판단"""
        if self.quota_exceeded:
            return False
            
        # 예상 잔여량 계산 (실제와 다를 수 있음)
        remaining = self.daily_quota_limit - self.quota_used
        if remaining < required_quota:
            logger.warning(f"예상 할당량 부족: 필요 {required_quota}, 예상 잔여 {remaining}")
            # 실제 API 호출에서 할당량 초과 여부를 확인하므로 여기서는 경고만
            return True  # 실제 API 호출에서 확인하도록 함
        return True
    
    def get_channel_id_from_url(self, url):
        """URL에서 채널 ID 추출"""
        # 먼저 캐시에서 확인
        cached_id = self.get_cached_channel_id(url)
        if cached_id:
            return cached_id
        
        # URL 패턴에 따른 처리
        if '/channel/' in url:
            channel_id = url.split('/channel/')[-1].split('/')[0]
            self.save_channel_id_to_cache(url, channel_id)
            return channel_id
        elif '/c/' in url:
            custom_name = url.split('/c/')[-1].split('/')[0]
            # @username 형태로 변환하여 검색
            query = f"@{custom_name}"
        elif '/@' in url:
            query = url.split('/@')[-1].split('/')[0]
            if not query.startswith('@'):
                query = f"@{query}"
        else:
            return None
        
        # API 호출로 채널 ID 검색
        try:
            self.log_api_call('search', f'채널 검색: {query}', 100)
            
            request = self.youtube.search().list(
                part='id',
                q=query,
                type='channel',
                maxResults=1
            )
            response = self.make_api_request_with_retry(request)
            
            if response['items']:
                channel_id = response['items'][0]['id']['channelId']
                self.save_channel_id_to_cache(url, channel_id)
                return channel_id
            return None
            
        except Exception as e:
            logger.error(f"Error finding channel ID for {query}: {e}")
            return None
            
    def get_channel_videos(self, channel_id, max_results=50):
        """채널의 영상 목록 가져오기"""
        try:
            self.log_api_call('search', f'채널 영상 목록: {channel_id} (페이지 1)', 100)
            
            request = self.youtube.search().list(
                part='id',
                channelId=channel_id,
                type='video',
                order='date',
                maxResults=max_results
            )
            response = self.make_api_request_with_retry(request)
            
            return response.get('items', [])
            
        except Exception as e:
            logger.error(f"Error getting channel videos for {channel_id}: {e}")
            return []
    
    def get_videos_info(self, video_ids):
        """영상 상세 정보 가져오기"""
        all_videos = []
        
        # 50개씩 배치로 처리
        for i in range(0, len(video_ids), 50):
            batch = video_ids[i:i+50]
            try:
                self.log_api_call('videos', f'영상 상세정보 배치: {len(batch)}개', 1)
                
                request = self.youtube.videos().list(
                    part='snippet,statistics',
                    id=','.join(batch)
                )
                response = self.make_api_request_with_retry(request)
                
                all_videos.extend(response.get('items', []))
                
            except Exception as e:
                logger.error(f"Error getting video info for batch: {e}")
                continue
        
        return all_videos
        
    def get_existing_video_ids(self):
        """DB에서 기존 영상 ID 목록 가져오기"""
        cursor = self.db.cursor()
        cursor.execute("SELECT link FROM recipes WHERE platform = 'youtube'")
        existing_links = cursor.fetchall()
        
        # YouTube URL에서 video ID 추출
        video_ids = set()
        for (link,) in existing_links:
            if 'youtube.com/watch?v=' in link:
                video_id = link.split('watch?v=')[-1].split('&')[0]
                video_ids.add(video_id)
                
        return video_ids
        
    def save_to_db(self, video_info):
        """단일 영상을 DB에 저장하고 성공/실패를 반환"""
        sql = '''
        INSERT IGNORE INTO recipes
        (title, link, content, used_ingredients, used_ingredients_block, block_reason, author, thumbnail, platform, hits, likes, comments, post_time, collected_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        '''
        
        try:
            # 재료 블록 추출 (update_used_ingredients_batch.py의 함수 사용)
            block, reason = extract_best_ingredient_block(video_info['description'])
            if not block or len(block.strip()) < 10:
                logger.info(f"Skipping video {video_info['link']} - no ingredients block found")
                return False
                
            # 재료 추출
            ingredients = extract_ingredients(block)
            
            # 추출된 재료가 너무 적으면 건너뛰기
            if len(ingredients) < 3:
                logger.info(f"Skipping video {video_info['link']} - too few ingredients ({len(ingredients)})")
                return False
            
            cursor = self.db.cursor()
            cursor.execute(sql, (
                video_info['title'],
                video_info['link'],
                video_info['description'],
                ",".join(ingredients),
                block,
                reason,
                video_info['author'],
                video_info['thumbnail'],
                'youtube(인플루언서)',
                video_info.get('hits', 0),
                video_info.get('likes', 0),
                video_info.get('comments', 0),
                video_info['post_time'],
                datetime.now()
            ))
            
            return True
            
        except Exception as e:
            logger.error(f"Error saving video {video_info['link']}: {e}")
            return False
            
    def process_influencer_list(self, csv_path='frontend/public/YouTube_Cooking_influencer.csv'):
        """인플루언서 목록을 처리하고 영상을 수집"""
        try:
            # 시작할 때 한 번만 DB에서 기존 영상 ID들을 가져옴
            existing_ids = self.get_existing_video_ids()
            print(f"기존 영상 수: {len(existing_ids)}")
            
            df = pd.read_csv(csv_path)
            total_influencers = len(df)
            processed_count = 0
            new_videos_count = 0
            
            logger.info(f"=== YouTube 크롤러 시작 ===")
            logger.info(f"총 인플루언서 수: {total_influencers}")
            logger.info(f"기존 영상 수: {len(existing_ids)}")
            logger.info(f"할당량 제한: {self.daily_quota_limit} units")
            
            for idx, row in df.iterrows():
                if self.quota_exceeded:
                    logger.warning(f"할당량 초과로 조기 종료 (처리된 인플루언서: {processed_count}/{total_influencers})")
                    break
                    
                channel_url = row['URL']
                print(f"\n[진행상황] {idx+1}/{total_influencers} 처리 중: {channel_url}")
                
                try:
                    channel_id = self.get_channel_id_from_url(channel_url)
                    if not channel_id:
                        print(f"채널 ID를 찾을 수 없음: {channel_url}")
                        continue
                        
                    # 영상 목록 가져오기
                    videos = self.get_channel_videos(channel_id)
                    if not videos:
                        print(f"새로운 영상이 없음: {channel_url}")
                        continue
                        
                    # 새로운 영상만 필터링
                    new_videos = []
                    for video in videos:
                        video_id = video['id']['videoId']
                        if video_id not in existing_ids:
                            new_videos.append(video)
                            
                    if not new_videos:
                        print(f"새로운 영상이 없음: {channel_url}")
                        continue
                        
                    # 영상 상세 정보 가져오기
                    video_ids = [video['id']['videoId'] for video in new_videos]
                    video_details = self.get_videos_info(video_ids)
                    
                    # DB에 저장
                    saved_count = 0
                    for video_detail in video_details:
                        video_info = {
                            'title': video_detail['snippet']['title'],
                            'link': f"https://www.youtube.com/watch?v={video_detail['id']}",
                            'description': video_detail['snippet']['description'],
                            'author': video_detail['snippet']['channelTitle'],
                            'thumbnail': video_detail['snippet']['thumbnails']['high']['url'],
                            'hits': int(video_detail['statistics'].get('viewCount', 0)),
                            'likes': int(video_detail['statistics'].get('likeCount', 0)),
                            'comments': int(video_detail['statistics'].get('commentCount', 0)),
                            'post_time': video_detail['snippet']['publishedAt']
                        }
                        
                        if self.save_to_db(video_info):
                            saved_count += 1
                            
                    new_videos_count += saved_count
                    processed_count += 1
                    print(f"새로 저장된 영상: {saved_count}개")
                    
                except Exception as e:
                    logger.error(f"Error processing channel {channel_url}: {e}")
                    continue
                    
            print("모든 인플루언서 처리 완료")
            
            # 할당량 사용량 요약 로깅
            logger.info(f"=== YouTube API 할당량 사용량 요약 ===")
            logger.info(f"처리된 인플루언서 수: {processed_count}/{total_influencers}")
            logger.info(f"새로 수집된 영상 수: {new_videos_count}")
            logger.info(f"Search API 호출 횟수: {self.search_api_calls}")
            logger.info(f"Videos API 호출 횟수: {self.videos_api_calls}")
            logger.info(f"예상 할당량 사용량: {self.quota_used}")
            logger.info(f"할당량 제한: {self.daily_quota_limit}")
            logger.info(f"예상 할당량 잔여량: {self.daily_quota_limit - self.quota_used}")
            
            if self.quota_exceeded:
                logger.warning("실제 할당량 초과로 조기 종료됨")
                logger.warning("할당량 리셋 시간: 매일 오후 4시 (한국 시간)")
            else:
                logger.info("할당량 내에서 정상 종료됨")
            
            logger.info(f"=== 할당량 사용량 요약 완료 ===")
            
            # 재료 추출 배치 처리
            logger.info("Running update_used_ingredients_batch.py...")
            subprocess.run([sys.executable, 'ingredient_management/update_used_ingredients_batch.py'])
            logger.info("update_used_ingredients_batch.py finished.")
            
        except Exception as e:
            logger.error(f"Error in process_influencer_list: {e}")
            
    def close(self):
        """DB 연결 종료"""
        if self.db:
            self.db.close()

    def check_quota_status(self):
        """할당량 상태 확인 - 간단한 API 호출로 테스트"""
        try:
            logger.info("할당량 상태 확인 중...")
            # 가장 가벼운 API 호출로 할당량 상태 확인
            request = self.youtube.search().list(
                part='id',
                q='test',
                type='video',
                maxResults=1
            )
            response = request.execute()
            logger.info("할당량 상태 확인 완료 - API 사용 가능")
            # 테스트 호출이 성공했으므로 할당량이 남아있음
            self.quota_exceeded = False
        except Exception as e:
            error_str = str(e)
            if 'quotaExceeded' in error_str or '403' in error_str and 'quota' in error_str.lower():
                logger.error("할당량 상태 확인 실패 - 할당량 초과")
                self.quota_exceeded = True
            else:
                logger.warning(f"할당량 상태 확인 중 오류 (할당량과 무관): {e}")
                # 다른 오류는 할당량과 무관하므로 계속 진행
                self.quota_exceeded = False

if __name__ == "__main__":
    crawler = YouTubeCrawler()
    try:
        crawler.process_influencer_list()
    finally:
        crawler.close() 