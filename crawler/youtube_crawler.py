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
        self.api_key = 'AIzaSyAHp_0bod-XWi5yNItEhQu16VWKy-fBA2Q'
        if not self.api_key:
            raise ValueError("YouTube API key not found in environment variables")
        
        self.youtube = build('youtube', 'v3', developerKey=self.api_key)
        self.platform = 'youtube(인플루언서)'
        # API 할당량 추적을 위한 카운터
        self.api_quota_used = {
            'search_api_calls': 0,
            'videos_api_calls': 0,
            'total_quota_used': 0
        }
        
        # 할당량 제한 설정 (YouTube API 일일 할당량: 10,000 units)
        self.daily_quota_limit = 9500  # 안전 마진 500 units
        self.quota_exceeded = False
        
        # DB 연결
        self.conn = pymysql.connect(
            host='localhost',
            user='root',
            password='sk784512!!',
            db='refrigerator',
            charset='utf8mb4',
            cursorclass=pymysql.cursors.DictCursor
        )
        self.cursor = self.conn.cursor()
        
        # 채널 캐싱 테이블 생성
        self.create_channel_cache_table()
        
        self.ingredient_patterns = [
            r'재료\s*[:\s]*(.*?)(?=\n\n|\Z)',
            r'필요한\s*재료\s*[:\s]*(.*?)(?=\n\n|\Z)',
            r'준비물\s*[:\s]*(.*?)(?=\n\n|\Z)',
            r'재료\s*준비\s*[:\s]*(.*?)(?=\n\n|\Z)'
        ]

    def create_channel_cache_table(self):
        """채널 ID 캐싱을 위한 테이블 생성"""
        try:
            sql = """
            CREATE TABLE IF NOT EXISTS youtube_channel_cache (
                id INT AUTO_INCREMENT PRIMARY KEY,
                channel_url VARCHAR(255) UNIQUE NOT NULL,
                channel_id VARCHAR(100) NOT NULL,
                channel_title VARCHAR(255),
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_channel_url (channel_url),
                INDEX idx_channel_id (channel_id)
            )
            """
            self.cursor.execute(sql)
            self.conn.commit()
            logger.info("YouTube 채널 캐시 테이블 생성 완료")
        except Exception as e:
            logger.error(f"채널 캐시 테이블 생성 실패: {e}")

    def get_cached_channel_id(self, channel_url):
        """캐시에서 채널 ID 조회"""
        try:
            sql = "SELECT channel_id, channel_title FROM youtube_channel_cache WHERE channel_url = %s"
            self.cursor.execute(sql, (channel_url,))
            result = self.cursor.fetchone()
            if result:
                logger.info(f"캐시에서 채널 ID 조회: {channel_url} -> {result['channel_id']}")
                return result['channel_id'], result['channel_title']
        except Exception as e:
            logger.error(f"캐시 조회 실패: {e}")
        return None, None

    def cache_channel_id(self, channel_url, channel_id, channel_title=None):
        """채널 ID를 캐시에 저장"""
        try:
            sql = """
            INSERT INTO youtube_channel_cache (channel_url, channel_id, channel_title) 
            VALUES (%s, %s, %s) 
            ON DUPLICATE KEY UPDATE 
            channel_id = VALUES(channel_id), 
            channel_title = VALUES(channel_title),
            last_updated = CURRENT_TIMESTAMP
            """
            self.cursor.execute(sql, (channel_url, channel_id, channel_title))
            self.conn.commit()
            logger.info(f"캐시에 채널 ID 저장: {channel_url} -> {channel_id}")
        except Exception as e:
            logger.error(f"캐시 저장 실패: {e}")

    def check_quota_limit(self, required_quota=100):
        """할당량 제한 확인"""
        if self.quota_exceeded:
            return False
        
        if self.api_quota_used['total_quota_used'] + required_quota > self.daily_quota_limit:
            logger.warning(f"할당량 제한 도달: 현재 {self.api_quota_used['total_quota_used']}, 제한 {self.daily_quota_limit}")
            self.quota_exceeded = True
            return False
        return True

    def log_api_call(self, api_type, endpoint, quota_cost=1):
        """API 호출을 로깅하고 할당량 사용량을 추적"""
        if not self.check_quota_limit(quota_cost):
            raise Exception("할당량 제한에 도달했습니다")
        
        self.api_quota_used[f'{api_type}_api_calls'] += 1
        self.api_quota_used['total_quota_used'] += quota_cost
        
        logger.info(f"API 호출: {api_type} - {endpoint} (할당량 비용: {quota_cost}, 총 사용량: {self.api_quota_used['total_quota_used']})")

    def get_channel_id_from_url(self, url):
        # URL 디코딩 처리
        url = urllib.parse.unquote(url)
        
        # 1. 먼저 캐시에서 조회
        cached_channel_id, cached_title = self.get_cached_channel_id(url)
        if cached_channel_id:
            return cached_channel_id
        
        # 2. 직접 채널 ID인 경우
        match = re.search(r"youtube.com/channel/([\w\-]+)", url)
        if match:
            channel_id = match.group(1)
            self.cache_channel_id(url, channel_id)
            return channel_id
        
        # 3. @username 형태인 경우 API 호출
        match = re.search(r"youtube.com/@([\w\-_.%]+)", url)
        if match:
            username = match.group(1)
            try:
                self.log_api_call('search', f'채널 검색: @{username}', quota_cost=100)
                search_response = self.youtube.search().list(
                    part="snippet",
                    q=f"@{username}",
                    type="channel",
                    maxResults=1
                ).execute()
                if search_response['items']:
                    channel_id = search_response['items'][0]['snippet']['channelId']
                    channel_title = search_response['items'][0]['snippet']['title']
                    # 캐시에 저장
                    self.cache_channel_id(url, channel_id, channel_title)
                    return channel_id
            except Exception as e2:
                logger.error(f"Error finding channel ID for {url}: {e2}")
                return None
        
        return None

    def get_existing_video_ids(self):
        """DB에서 기존 영상 ID 목록을 가져옴"""
        try:
            sql = "SELECT link FROM recipes WHERE platform = %s"
            self.cursor.execute(sql, (self.platform,))
            existing_videos = self.cursor.fetchall()
            # URL에서 video_id 추출
            return [video['link'].split('v=')[-1] for video in existing_videos]
        except Exception as e:
            print(f"기존 영상 ID 조회 중 오류 발생: {str(e)}")
            return []

    def get_channel_videos(self, channel_id, max_results_per_page=50):
        """채널의 모든 동영상을 페이지네이션으로 가져옵니다."""
        all_video_ids = []
        next_page_token = None
        page_count = 0
        
        while True:
            try:
                page_count += 1
                self.log_api_call('search', f'채널 영상 목록: {channel_id} (페이지 {page_count})', quota_cost=100)
                
                request = self.youtube.search().list(
                    part="snippet",
                    channelId=channel_id,
                    maxResults=max_results_per_page,
                    order="date",
                    type="video",
                    pageToken=next_page_token
                )
                response = request.execute()
                video_ids = [item['id']['videoId'] for item in response['items']]
                all_video_ids.extend(video_ids)
                
                logger.info(f"채널 {channel_id}에서 {len(video_ids)}개 영상 발견 (총 {len(all_video_ids)}개)")
                
                next_page_token = response.get('nextPageToken')
                if not next_page_token:
                    break
                time.sleep(0.5)  # API 쿼터 보호
            except Exception as e:
                logger.error(f"Error getting channel videos: {str(e)}")
                break
        return all_video_ids

    def get_videos_info(self, video_ids):
        """여러 영상의 정보를 한 번에 가져옴"""
        videos_info = []
        batch_count = 0
        
        # 50개씩 묶어서 처리
        for i in range(0, len(video_ids), 50):
            batch = video_ids[i:i+50]
            batch_count += 1
            
            try:
                self.log_api_call('videos', f'영상 상세정보 배치 {batch_count} ({len(batch)}개)', quota_cost=1)
                
                request = self.youtube.videos().list(
                    part="snippet,statistics",
                    id=','.join(batch)
                )
                response = request.execute()
                
                for item in response['items']:
                    snippet = item['snippet']
                    stats = item['statistics']
                    
                    video_info = {
                        'video_id': item['id'],
                        'title': snippet['title'],
                        'description': snippet['description'],
                        'published_at': snippet['publishedAt'],
                        'channel_id': snippet['channelId'],
                        'channel_title': snippet['channelTitle'],
                        'view_count': int(stats.get('viewCount', 0)),
                        'like_count': int(stats.get('likeCount', 0)),
                        'comment_count': int(stats.get('commentCount', 0))
                    }
                    videos_info.append(video_info)
                
                logger.info(f"배치 {batch_count} 처리 완료: {len(response['items'])}개 영상 정보 수집")
                time.sleep(0.5)  # API 쿼터 보호
            except Exception as e:
                print(f"영상 정보 조회 중 오류 발생: {str(e)}")
                continue
                
        return videos_info

    def save_to_csv(self, videos_info, output_file='data/youtube_videos.csv'):
        try:
            df = pd.DataFrame(videos_info)
            os.makedirs(os.path.dirname(output_file), exist_ok=True)
            df.to_csv(output_file, index=False, encoding='utf-8-sig')
            logger.info(f"Saved {len(videos_info)} videos to {output_file}")
        except Exception as e:
            logger.error(f"Error saving to CSV: {str(e)}")

    def extract_ingredients_from_content(self, content):
        """영상 설명에서 재료 정보를 추출합니다."""
        for pattern in self.ingredient_patterns:
            match = re.search(pattern, content, re.DOTALL | re.IGNORECASE)
            if match:
                ingredients_block = match.group(1).strip()
                if len(ingredients_block) > 10:  # 최소 길이 체크
                    return ingredients_block
        return None

    def update_video_metadata(self, video_id):
        """특정 영상의 메타데이터(조회수, 좋아요, 댓글수)를 업데이트합니다."""
        try:
            request = self.youtube.videos().list(
                part="statistics",
                id=video_id
            )
            response = request.execute()
            if response['items']:
                stats = response['items'][0]['statistics']
                sql = """
                UPDATE recipes 
                SET hits = %s, likes = %s, comments = %s, collected_at = %s
                WHERE link LIKE %s
                """
                self.cursor.execute(sql, (
                    int(stats.get('viewCount', 0)),
                    int(stats.get('likeCount', 0)),
                    int(stats.get('commentCount', 0)),
                    datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                    f'%v={video_id}'
                ))
                self.conn.commit()
                return True
        except Exception as e:
            logger.error(f"Error updating metadata for video {video_id}: {e}")
        return False

    def update_recent_videos_metadata(self, days=3):
        """최근 3일간의 영상 메타데이터를 일괄 업데이트"""
        try:
            cutoff_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
            sql = """
            SELECT link FROM recipes 
            WHERE platform = %s AND post_time >= %s
            """
            self.cursor.execute(sql, (self.platform, cutoff_date))
            videos = self.cursor.fetchall()
            
            if not videos:
                print("업데이트할 영상이 없습니다.")
                return
                
            print(f"총 {len(videos)}개의 영상 메타데이터 업데이트 시작")
            
            # 50개씩 묶어서 처리
            video_ids = []
            for video in videos:
                video_id = video['link'].split('v=')[-1]
                video_ids.append(video_id)
                
                if len(video_ids) == 50:
                    self._update_batch_metadata(video_ids)
                    video_ids = []  # 초기화
            
            # 남은 영상들 처리
            if video_ids:
                self._update_batch_metadata(video_ids)
                
            print("메타데이터 업데이트 완료")
            
        except Exception as e:
            print(f"메타데이터 업데이트 중 오류 발생: {str(e)}")
            self.conn.rollback()

    def _update_batch_metadata(self, video_ids):
        """50개 단위로 메타데이터 업데이트"""
        try:
            request = self.youtube.videos().list(
                part="statistics",
                id=','.join(video_ids)
            )
            response = request.execute()
            
            for item in response['items']:
                stats = item['statistics']
                sql = """
                UPDATE recipes 
                SET hits = %s, likes = %s, comments = %s, collected_at = %s
                WHERE link LIKE %s
                """
                self.cursor.execute(sql, (
                    int(stats.get('viewCount', 0)),
                    int(stats.get('likeCount', 0)),
                    int(stats.get('commentCount', 0)),
                    datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                    f'%v={item["id"]}'
                ))
            
            self.conn.commit()
            time.sleep(0.5)  # API 쿼터 보호
            
        except Exception as e:
            print(f"배치 메타데이터 업데이트 중 오류 발생: {str(e)}")
            self.conn.rollback()

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
            
            # 추출된 재료 개수 체크 (3개 이하이면 저장하지 않음)
            if not ingredients or len(ingredients) <= 3:
                logger.info(f"Skipping video {video_info['link']} - extracted ingredients 3 or less: {ingredients}")
                return False
                
            self.cursor.execute(sql, (
                video_info['title'],
                video_info['link'],
                video_info['description'],
                ','.join(ingredients) if ingredients else '',
                block,
                reason,
                video_info['channel_title'],
                '',  # Assuming no thumbnail for now
                self.platform,
                video_info['view_count'],
                video_info['like_count'],
                video_info['comment_count'],
                video_info['published_at'][:10],
                datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            ))
            
            # INSERT IGNORE의 영향을 확인
            if self.cursor.rowcount > 0:
                logger.info(f"새 영상 저장 성공: {video_info['title']}")
                return True
            else:
                logger.info(f"이미 존재하는 영상: {video_info['title']}")
                return False
                
        except Exception as e:
            logger.error(f"DB insert error for video {video_info['link']}: {e}")
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
                    logger.warning("할당량 제한에 도달하여 크롤링을 중단합니다.")
                    break
                
                channel_url = row['URL']
                print(f"\n[진행상황] {idx+1}/{total_influencers} 처리 중: {channel_url}")
                
                try:
                    channel_id = self.get_channel_id_from_url(channel_url)
                    if not channel_id:
                        print(f"채널 ID를 찾을 수 없음: {channel_url}")
                        continue
                        
                    video_ids = self.get_channel_videos(channel_id)
                    # 기존에 없는 영상만 필터링
                    new_video_ids = [vid for vid in video_ids if vid not in existing_ids]
                    
                    if not new_video_ids:
                        print(f"새로운 영상이 없음: {channel_url}")
                        continue
                        
                    print(f"[진행상황] {len(new_video_ids)}개의 새로운 영상 발견")
                    videos_info = self.get_videos_info(new_video_ids)
                    
                    saved_count = 0
                    for video in videos_info:
                        if self.save_to_db(video):
                            existing_ids.add(video['video_id'])  # 새로 저장된 영상 ID 추가
                            saved_count += 1
                    
                    new_videos_count += saved_count
                    print(f"[진행상황] {saved_count}개 영상 저장 완료")
                    
                except Exception as e:
                    if "할당량 제한에 도달했습니다" in str(e):
                        logger.error(f"할당량 제한으로 인해 크롤링 중단: {channel_url}")
                        break
                    else:
                        print(f"인플루언서 처리 중 오류 발생: {str(e)}")
                        continue
                
                processed_count += 1
                    
            print("\n모든 인플루언서 처리 완료")
            
            # API 할당량 사용량 요약 출력
            logger.info("=== YouTube API 할당량 사용량 요약 ===")
            logger.info(f"처리된 인플루언서 수: {processed_count}/{total_influencers}")
            logger.info(f"새로 수집된 영상 수: {new_videos_count}")
            logger.info(f"Search API 호출 횟수: {self.api_quota_used['search_api_calls']}")
            logger.info(f"Videos API 호출 횟수: {self.api_quota_used['videos_api_calls']}")
            logger.info(f"총 할당량 사용량: {self.api_quota_used['total_quota_used']}")
            logger.info(f"할당량 제한: {self.daily_quota_limit}")
            logger.info(f"할당량 잔여량: {self.daily_quota_limit - self.api_quota_used['total_quota_used']}")
            if self.quota_exceeded:
                logger.warning("할당량 제한에 도달하여 일부 인플루언서가 처리되지 않았습니다.")
            logger.info("=== 할당량 사용량 요약 완료 ===")
            
            # 메타데이터 업데이트는 별도 함수로 분리하여 필요시에만 실행
            # self.update_recent_videos_metadata()  # 이 줄 제거
            
        except Exception as e:
            print(f"인플루언서 목록 처리 중 오류 발생: {str(e)}")

def main():
    try:
        crawler = YouTubeCrawler()
        crawler.process_influencer_list()
        # 메타데이터 업데이트는 별도로 실행하거나 주석 처리
        # crawler.update_recent_videos_metadata(days=3)  # 이 줄 제거
    except Exception as e:
        logger.error(f"Error in main: {str(e)}")
    # 크롤링이 끝나면 update_used_ingredients_batch.py 자동 실행
    try:
        logger.info("Running update_used_ingredients_batch.py...")
        subprocess.run(["python", "ingredient_management/update_used_ingredients_batch.py"], check=True)
        logger.info("update_used_ingredients_batch.py finished.")
    except Exception as e:
        logger.error(f"Failed to run update_used_ingredients_batch.py: {e}")

if __name__ == "__main__":
    main() 