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
        self.ingredient_patterns = [
            r'재료\s*[:\s]*(.*?)(?=\n\n|\Z)',
            r'필요한\s*재료\s*[:\s]*(.*?)(?=\n\n|\Z)',
            r'준비물\s*[:\s]*(.*?)(?=\n\n|\Z)',
            r'재료\s*준비\s*[:\s]*(.*?)(?=\n\n|\Z)'
        ]

    def get_channel_id_from_url(self, url):
        # URL 디코딩 처리
        url = urllib.parse.unquote(url)
        match = re.search(r"youtube.com/@([\w\-_.%]+)", url)
        if match:
            username = match.group(1)
            try:
                search_response = self.youtube.search().list(
                    part="snippet",
                    q=f"@{username}",
                    type="channel",
                    maxResults=1
                ).execute()
                if search_response['items']:
                    return search_response['items'][0]['snippet']['channelId']
            except Exception as e2:
                logger.error(f"Error finding channel ID for {url}: {e2}")
                return None
        match = re.search(r"youtube.com/channel/([\w\-]+)", url)
        if match:
            return match.group(1)
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
        while True:
            try:
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
        # 50개씩 묶어서 처리
        for i in range(0, len(video_ids), 50):
            batch = video_ids[i:i+50]
            try:
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

    def save_to_db(self, videos_info):
        sql = '''
        INSERT IGNORE INTO recipes
        (title, link, content, used_ingredients, used_ingredients_block, block_reason, author, thumbnail, platform, hits, likes, comments, post_time, collected_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        '''
        count = 0
        for v in videos_info:
            try:
                # 재료 블록 추출 (update_used_ingredients_batch.py의 함수 사용)
                block, reason = extract_best_ingredient_block(v['description'])
                if not block or len(block.strip()) < 10:
                    logger.info(f"Skipping video {v['link']} - no ingredients block found")
                    continue
                # 재료 추출
                ingredients = extract_ingredients(block)
                self.cursor.execute(sql, (
                    v['title'],
                    v['link'],
                    v['description'],
                    ','.join(ingredients) if ingredients else '',
                    block,
                    reason,
                    v['channel_title'],
                    '',  # Assuming no thumbnail for now
                    self.platform,
                    v['view_count'],
                    v['like_count'],
                    v['comment_count'],
                    v['published_at'][:10],
                    datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                ))
                count += 1
            except Exception as e:
                logger.error(f"DB insert error for video {v['link']}: {e}")
        self.conn.commit()
        logger.info(f"Inserted {count} videos into DB.")

    def process_influencer_list(self, csv_path='frontend/public/YouTube_Cooking_influencer.csv'):
        """인플루언서 목록을 처리하고 영상을 수집"""
        try:
            # 시작할 때 한 번만 DB에서 기존 영상 ID들을 가져옴
            existing_ids = self.get_existing_video_ids()
            print(f"기존 영상 수: {len(existing_ids)}")
            
            df = pd.read_csv(csv_path)
            total_influencers = len(df)
            
            for idx, row in df.iterrows():
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
                    
                    for video in videos_info:
                        self.save_to_db(video)
                        existing_ids.add(video['video_id'])  # 새로 저장된 영상 ID 추가
                    
                    print(f"[진행상황] {len(videos_info)}개 영상 저장 완료")
                    
                except Exception as e:
                    print(f"인플루언서 처리 중 오류 발생: {str(e)}")
                    continue
                    
            print("\n모든 인플루언서 처리 완료")
            
            # 최근 3일간의 영상 메타데이터 업데이트
            print("\n최근 영상 메타데이터 업데이트 시작...")
            self.update_recent_videos_metadata()
            
        except Exception as e:
            print(f"인플루언서 목록 처리 중 오류 발생: {str(e)}")

def main():
    try:
        crawler = YouTubeCrawler()
        crawler.process_influencer_list()
        # 최근 3일 내 영상들의 메타데이터 업데이트
        crawler.update_recent_videos_metadata(days=3)
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