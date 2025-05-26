import os
import json
import pandas as pd
from datetime import datetime
from googleapiclient.discovery import build
from dotenv import load_dotenv
import logging
from pathlib import Path
import time
import re
import pymysql
import urllib.parse
import subprocess

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
        self.api_key = os.getenv('YOUTUBE_API_KEY')
        if not self.api_key:
            raise ValueError("YouTube API key not found in environment variables")
        
        self.youtube = build('youtube', 'v3', developerKey=self.api_key)
        self.platform = '유튜브(인플루언서)'
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
        sql = "SELECT link FROM recipes WHERE platform=%s"
        self.cursor.execute(sql, (self.platform,))
        rows = self.cursor.fetchall()
        # 유튜브 영상 ID만 추출
        return set([row['link'].split('v=')[-1] for row in rows if 'v=' in row['link']])

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
        videos_info = []
        for i in range(0, len(video_ids), 50):
            batch = video_ids[i:i+50]
            try:
                request = self.youtube.videos().list(
                    part="snippet,statistics",
                    id=','.join(batch)
                )
                response = request.execute()
                for item in response['items']:
                    try:
                        video_info = {
                            'title': item['snippet']['title'],
                            'link': f"https://www.youtube.com/watch?v={item['id']}",
                            'content': item['snippet']['description'],
                            'author': item['snippet']['channelTitle'],
                            'thumbnail': item['snippet']['thumbnails']['high']['url'],
                            'platform': self.platform,
                            'hits': int(item['statistics'].get('viewCount', 0)),
                            'likes': int(item['statistics'].get('likeCount', 0)),
                            'comments': int(item['statistics'].get('commentCount', 0)),
                            'post_time': item['snippet']['publishedAt'][:10],
                            'collected_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                        }
                        videos_info.append(video_info)
                    except Exception as e:
                        logger.error(f"Error processing video {item['id']}: {str(e)}")
                        continue
            except Exception as e:
                logger.error(f"Error getting videos info: {str(e)}")
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

    def save_to_db(self, videos_info):
        sql = '''
        INSERT IGNORE INTO recipes
        (title, link, content, used_ingredients, used_ingredients_block, block_reason, author, thumbnail, platform, hits, likes, comments, post_time, collected_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        '''
        count = 0
        for v in videos_info:
            try:
                self.cursor.execute(sql, (
                    v['title'],
                    v['link'],
                    v['content'],
                    '', '', '',  # used_ingredients, used_ingredients_block, block_reason
                    v['author'],
                    v['thumbnail'],
                    v['platform'],
                    v['hits'],
                    v['likes'],
                    v['comments'],
                    v['post_time'],
                    v['collected_at']
                ))
                count += 1
            except Exception as e:
                logger.error(f"DB insert error for video {v['link']}: {e}")
        self.conn.commit()
        logger.info(f"Inserted {count} videos into DB.")

    def process_influencer_list(self, csv_path='frontend/public/YouTube_Cooking_influencer.csv'):
        try:
            df = pd.read_csv(csv_path)
            existing_video_ids = self.get_existing_video_ids()
            for _, row in df.iterrows():
                url = str(row['URL']).strip()
                channel_name = str(row['채널명']).strip()
                logger.info(f"Processing channel: {channel_name} ({url})")
                channel_id = self.get_channel_id_from_url(url)
                if not channel_id:
                    logger.error(f"Could not find channel ID for {url}")
                    continue
                video_ids = self.get_channel_videos(channel_id)
                # 중복 제거
                new_video_ids = [vid for vid in video_ids if vid not in existing_video_ids]
                if not new_video_ids:
                    logger.info(f"No new videos to collect for channel: {channel_name}")
                    continue
                # 영상 정보를 50개씩 나눠서 바로 DB에 저장
                for i in range(0, len(new_video_ids), 50):
                    batch = new_video_ids[i:i+50]
                    try:
                        request = self.youtube.videos().list(
                            part="snippet,statistics",
                            id=','.join(batch)
                        )
                        response = request.execute()
                        videos_info = []
                        for item in response['items']:
                            try:
                                # 'id'가 없거나 비정상 구조면 건너뜀
                                if 'id' not in item or 'snippet' not in item:
                                    continue
                                content = item['snippet']['description']
                                if len(content) < 30:
                                    continue  # 30자 미만은 저장하지 않음
                                video_info = {
                                    'title': item['snippet']['title'],
                                    'link': f"https://www.youtube.com/watch?v={item['id']}",
                                    'content': content,
                                    'author': item['snippet']['channelTitle'],
                                    'thumbnail': item['snippet']['thumbnails']['high']['url'],
                                    'platform': self.platform,
                                    'hits': int(item['statistics'].get('viewCount', 0)),
                                    'likes': int(item['statistics'].get('likeCount', 0)),
                                    'comments': int(item['statistics'].get('commentCount', 0)),
                                    'post_time': item['snippet']['publishedAt'][:10],
                                    'collected_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                                }
                                videos_info.append(video_info)
                            except Exception as e:
                                logger.error(f"Error processing video {item.get('id', 'unknown')}: {str(e)}")
                                continue
                        if videos_info:
                            self.save_to_db(videos_info)
                    except Exception as e:
                        logger.error(f"Error getting videos info: {str(e)}")
                        continue
                    time.sleep(1)
        except Exception as e:
            logger.error(f"Error processing influencer list: {str(e)}")

def main():
    try:
        crawler = YouTubeCrawler()
        crawler.process_influencer_list()
    except Exception as e:
        logger.error(f"Error in main: {str(e)}")
    # 크롤링이 끝나면 update_used_ingredients_batch.py 자동 실행
    try:
        logger.info("Running update_used_ingredients_batch.py...")
        subprocess.run(["python", "update_used_ingredients_batch.py"], check=True)
        logger.info("update_used_ingredients_batch.py finished.")
    except Exception as e:
        logger.error(f"Failed to run update_used_ingredients_batch.py: {e}")

if __name__ == "__main__":
    main() 