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
        db_host = (
            os.getenv('DB_HOST')
            or os.getenv('MYSQLHOST')
            or os.getenv('MYSQL_HOST')
        )
        db_user = (
            os.getenv('DB_USER')
            or os.getenv('MYSQLUSER')
            or os.getenv('MYSQL_USER')
        )
        db_password = (
            os.getenv('DB_PASSWORD')
            or os.getenv('MYSQLPASSWORD')
            or os.getenv('MYSQL_PASSWORD')
        )
        db_name = (
            os.getenv('DB_NAME')
            or os.getenv('MYSQLDATABASE')
            or os.getenv('MYSQL_DATABASE')
            or 'railway'
        )
        db_port = int(
            os.getenv('DB_PORT')
            or os.getenv('MYSQLPORT')
            or os.getenv('MYSQL_PORT')
            or 3306
        )

        self.db = pymysql.connect(
            host=db_host,
            user=db_user,
            password=db_password,
            db=db_name,
            port=db_port,
            charset='utf8mb4',
            cursorclass=pymysql.cursors.DictCursor
        )
        
        # 캐시 초기화
        self.cache = {}
        
        # 할당량 추적 - 실제 API 응답 기반으로 관리
        self.daily_quota_limit = 9500
        self.quota_used = 0
        self.quota_exceeded = False
        
        # API 호출 카운터
        self.search_api_calls = 0
        self.videos_api_calls = 0

        # 엔드포인트별 예상 할당량 비용(YouTube Data API 기준 추정)
        # 참고: search.list ≈ 100, channels.list ≈ 1, playlistItems.list ≈ 1, videos.list ≈ 1
        self.quota_cost_map = {
            'search': 100,
            'channels': 1,
            'playlistItems': 1,
            'videos': 1,
        }

        # 채널별 사용량 집계
        # key: channel_url 또는 channel_id
        # value: { 'search_calls': int, 'videos_calls': int, 'estimated_cost': int }
        self.per_channel_usage = {}
        
        # 채널 ID 캐시 테이블 생성
        self.create_channel_cache_table()
        # 채널 메타 테이블 생성(uploads 플레이리스트 캐시)
        self.create_channel_meta_table()
        
        # 에러 재시도 설정
        self.max_retries = 3
        self.retry_delay = 1  # 초
        
        # 할당량 상태 확인(기본 비활성화)
        # 환경변수 YT_SKIP_QUOTA_CHECK != '1' 인 경우에만 호출
        if os.getenv('YT_SKIP_QUOTA_CHECK', '1') != '1':
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

    def create_channel_meta_table(self):
        """채널 메타(uploads playlist) 캐시 테이블 생성"""
        cursor = self.db.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS youtube_channel_meta (
                channel_id VARCHAR(50) PRIMARY KEY,
                uploads_playlist_id VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        self.db.commit()
        logger.info("채널 메타 테이블 확인/생성 완료")
    
    def get_cached_channel_id(self, key):
        """캐시 또는 DB에서 채널 ID 가져오기"""
        # 1) 메모리 캐시
        cached = self.cache.get(key)
        if cached:
            return cached
        # 2) DB 캐시
        try:
            cursor = self.db.cursor()
            cursor.execute("SELECT channel_id FROM youtube_channel_cache WHERE channel_url=%s", (key,))
            row = cursor.fetchone()
            if row and row.get('channel_id'):
                channel_id = row['channel_id']
                self.cache[key] = channel_id
                return channel_id
        except Exception:
            pass
        return None

    def save_channel_id_to_cache(self, key, channel_id):
        """채널 ID를 캐시와 DB에 저장"""
        self.cache[key] = channel_id
        try:
            cursor = self.db.cursor()
            cursor.execute(
                """
                INSERT INTO youtube_channel_cache (channel_url, channel_id)
                VALUES (%s, %s)
                ON DUPLICATE KEY UPDATE channel_id = VALUES(channel_id)
                """,
                (key, channel_id)
            )
            self.db.commit()
        except Exception:
            self.db.rollback()

    def get_cached_videos(self, channel_id):
        """캐시에서 영상 목록 가져오기"""
        return self.cache.get(f"recipes_{channel_id}")

    def save_videos_to_cache(self, channel_id, videos):
        """영상 목록을 캐시에 저장"""
        self.cache[f"recipes_{channel_id}"] = videos

    def get_cached_uploads_playlist_id(self, channel_id: str):
        """채널의 업로드 플레이리스트 ID 캐시 조회"""
        key = f"uploads_{channel_id}"
        if key in self.cache:
            return self.cache[key]
        try:
            cursor = self.db.cursor()
            cursor.execute("SELECT uploads_playlist_id FROM youtube_channel_meta WHERE channel_id=%s", (channel_id,))
            row = cursor.fetchone()
            if row and row.get('uploads_playlist_id'):
                self.cache[key] = row['uploads_playlist_id']
                return row['uploads_playlist_id']
        except Exception:
            pass
        return None

    def save_uploads_playlist_id(self, channel_id: str, uploads_playlist_id: str):
        """업로드 플레이리스트 ID 캐시 저장"""
        key = f"uploads_{channel_id}"
        self.cache[key] = uploads_playlist_id
        try:
            cursor = self.db.cursor()
            cursor.execute(
                """
                INSERT INTO youtube_channel_meta (channel_id, uploads_playlist_id)
                VALUES (%s, %s)
                ON DUPLICATE KEY UPDATE uploads_playlist_id = VALUES(uploads_playlist_id)
                """,
                (channel_id, uploads_playlist_id)
            )
            self.db.commit()
        except Exception:
            self.db.rollback()
    
    def log_api_call(self, api_type, description, cost, channel_key=None):
        """API 호출 로깅"""
        self.quota_used += cost
        if api_type == 'search':
            self.search_api_calls += 1
        elif api_type == 'videos':
            self.videos_api_calls += 1
            
        # 채널별 집계
        if channel_key:
            usage = self.per_channel_usage.setdefault(channel_key, {
                'search_calls': 0,
                'videos_calls': 0,
                'estimated_cost': 0,
            })
            if api_type == 'search':
                usage['search_calls'] += 1
            elif api_type == 'videos':
                usage['videos_calls'] += 1
            usage['estimated_cost'] += cost

        logger.info(
            f"API 호출: {api_type} - {description} (비용: {cost}, 누적: {self.quota_used})"
            + (f" [channel={channel_key}]" if channel_key else "")
        )
        
        # 할당량 체크 - 실제 API 응답을 기반으로 하므로 여기서는 로깅만
        if self.quota_used >= self.daily_quota_limit:
            logger.warning(f"예상 할당량 초과! (사용량: {self.quota_used}/{self.daily_quota_limit})")
    
    # [중복 정의 제거됨] 아래의 통합 래퍼를 사용합니다.
    
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
        logger.info(f"채널 ID 추출 시작: {url}")
        # URL 정규화: 쓸모없는 서픽스 제거(/videos, /streams, /featured 등)
        try:
            parsed = urllib.parse.urlparse(url)
            path = parsed.path.rstrip('/')
            # '/@handle/...' 형태면 '/@handle'까지만 유지
            if '/@' in path:
                at_index = path.find('/@')
                after = path[at_index:]
                # '/@handle' 다음 슬래시 이후는 제거
                parts = after.split('/')
                handle_segment = parts[0]
                path = handle_segment
                url = f"{parsed.scheme}://{parsed.netloc}{path}"
        except Exception:
            pass
        # 먼저 캐시에서 확인
        cached_id = self.get_cached_channel_id(url)
        if cached_id:
            logger.info(f"캐시에서 채널 ID 찾음: {cached_id}")
            return cached_id
        
        # URL 패턴에 따른 처리
        if '/channel/' in url:
            channel_id = url.split('/channel/')[-1].split('/')[0]
            self.save_channel_id_to_cache(url, channel_id)
            logger.info(f"채널 ID 추출 완료: {channel_id}")
            return channel_id
        elif '/c/' in url or '/user/' in url or '/@' in url:
            # Custom URL or username
            # '/@handle' 이후 서픽스 제거가 위에서 끝났으므로 말미는 핸들일 가능성 높음
            custom_name = url.split('/')[-1]
            # URL 말미가 이미 '@username' 형태면 그대로 사용
            query = custom_name if custom_name.startswith('@') else f"@{custom_name}"
            logger.info(f"커스텀 이름으로 검색: {query}")
            # API 호출을 줄이기 위해 캐시를 먼저 확인
            cached_id = self.get_cached_channel_id(query)
            if cached_id:
                logger.info(f"캐시에서 커스텀 이름으로 채널 ID 찾음: {cached_id}")
                return cached_id
            # API 호출
            logger.info(f"[예상 비용] search.list 채널 검색 1회 → ~{self.quota_cost_map['search']} units")
            response = self.make_api_request_with_retry('search', {'q': query, 'type': 'channel', 'part': 'snippet'}, context={'channel': url, 'desc': f'채널 검색: {query}'})
            if response and 'items' in response:
                for item in response['items']:
                    if 'channelId' in item['id']:
                        channel_id = item['id']['channelId']
                        # 핸들과 원래 URL 둘 다 키로 캐싱
                        self.save_channel_id_to_cache(query, channel_id)
                        self.save_channel_id_to_cache(url, channel_id)
                        logger.info(f"API 호출 후 채널 ID 추출 완료: {channel_id}")
                        return channel_id
        logger.warning(f"채널 ID를 찾을 수 없음: {url}")
        return None

    def get_channel_videos(self, channel_id):
        """채널의 영상 목록 가져오기"""
        logger.info(f"채널 영상 목록 가져오기 시작: {channel_id}")
        # 캐시에서 영상 목록 확인
        cached_videos = self.get_cached_videos(channel_id)
        if cached_videos:
            # 캐시 히트 → search.list 1회 비용 절약 추정
            saved = self.quota_cost_map['search']
            logger.info(f"캐시 히트: 영상목록 {len(cached_videos)}개 (절약 추정 비용: {saved}) [channel={channel_id}]")
            return cached_videos
        
        # 로컬 데이터베이스에서 이미 수집된 영상 ID 확인
        existing_video_ids = self.get_existing_video_ids_from_db()
        logger.info(f"로컬 DB에서 기존 영상 수: {len(existing_video_ids)}개")
        
        # API 호출로 새로운 영상 목록 가져오기 (playlistItems 기반으로 비용 절감)
        # 1) uploads playlist id 확보
        uploads_id = self.get_cached_uploads_playlist_id(channel_id)
        if not uploads_id:
            logger.info(f"[예상 비용] channels.list(contentDetails) 1회 → ~{self.quota_cost_map['channels']} units [channel={channel_id}]")
            ch_resp = self.make_api_request_with_retry('channels', {
                'part': 'contentDetails',
                'id': channel_id
            }, context={'channel': channel_id, 'desc': '채널 contentDetails 조회'})
            try:
                uploads_id = ch_resp['items'][0]['contentDetails']['relatedPlaylists']['uploads'] if ch_resp and ch_resp.get('items') else None
                if uploads_id:
                    self.save_uploads_playlist_id(channel_id, uploads_id)
            except Exception as e:
                logger.error(f"uploads playlist id 파싱 실패: {e}")
                uploads_id = None

        new_videos = []
        if uploads_id:
            logger.info(f"[예상 비용] playlistItems.list(contentDetails) 1회 → ~{self.quota_cost_map['playlistItems']} units [channel={channel_id}]")
            pl_resp = self.make_api_request_with_retry('playlistItems', {
                'part': 'contentDetails',
                'playlistId': uploads_id,
                'maxResults': 50
            }, context={'channel': channel_id, 'desc': '업로드 플레이리스트 최신 영상'})
            if pl_resp and 'items' in pl_resp:
                for item in pl_resp['items']:
                    vid = item.get('contentDetails', {}).get('videoId')
                    if vid and vid not in existing_video_ids:
                        new_videos.append(vid)
                self.save_videos_to_cache(channel_id, new_videos)
                logger.info(f"playlistItems 기반 새로운 영상 추출: {len(new_videos)}개")
            else:
                logger.warning(f"업로드 플레이리스트에서 항목을 찾지 못함: {channel_id}")
        else:
            logger.warning(f"uploads playlist id 미확보로 영상 목록 조회 스킵: {channel_id}")
        return new_videos

    def get_existing_video_ids_from_db(self):
        """로컬 데이터베이스에서 이미 수집된 YouTube 영상 ID 집합을 반환"""
        cursor = self.db.cursor()
        cursor.execute("SELECT link FROM recipes WHERE platform = 'youtube(인플루언서)'")
        rows = cursor.fetchall()
        existing_ids: set[str] = set()
        for row in rows:
            link = row.get('link') if isinstance(row, dict) else row[0]
            if not link:
                continue
            if 'youtube.com/watch?v=' in link:
                vid = link.split('watch?v=')[-1].split('&')[0]
                existing_ids.add(vid)
        return existing_ids
        
    def get_videos_info(self, video_ids, channel_key=None):
        """영상 상세 정보 가져오기"""
        all_videos = []
        
        # 50개씩 배치로 처리
        for i in range(0, len(video_ids), 50):
            batch = video_ids[i:i+50]
            try:
                logger.info(f"[예상 비용] videos.list(배치 {len(batch)}개) 1회 → ~{self.quota_cost_map['videos']} units"
                            + (f" [channel={channel_key}]" if channel_key else ""))
                response = self.make_api_request_with_retry('videos', {
                    'part': 'snippet,statistics',
                    'id': ','.join(batch)
                }, context={'channel': channel_key, 'desc': f'영상 상세정보 배치({len(batch)}개)'})
                
                all_videos.extend(response.get('items', []))
                
            except Exception as e:
                logger.error(f"Error getting video info for batch: {e}")
                continue
        
        return all_videos
        
    def get_existing_video_ids(self):
        """DB에서 기존 영상 ID 목록 가져오기"""
        cursor = self.db.cursor()
        cursor.execute("SELECT link FROM recipes WHERE platform = 'youtube(인플루언서)'")
        existing_links = cursor.fetchall()
        
        # YouTube URL에서 video ID 추출
        video_ids = set()
        for row in existing_links:
            link = row.get('link') if isinstance(row, dict) else row[0]
            if link and 'youtube.com/watch?v=' in link:
                video_id = link.split('watch?v=')[-1].split('&')[0]
                video_ids.add(video_id)
                
        return video_ids
        
    def save_to_db(self, video_data):
        """영상 데이터를 데이터베이스에 저장"""
        logger.info(f"데이터베이스에 저장 시작: {video_data['title']}")
        try:
            sql = """
            INSERT INTO recipes (
                title, link, content, used_ingredients, used_ingredients_block, block_reason,
                author, thumbnail, platform, hits, likes, comments, post_time, collected_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
            """
            # post_time은 DATE 컬럼이므로 YYYY-MM-DD 형태로 저장
            post_date = str(video_data['post_time'])[:10]
            self.db.cursor().execute(sql, (
                video_data['title'],
                video_data['link'],
                video_data['description'] or '',
                video_data.get('used_ingredients'),
                video_data.get('used_ingredients_block'),
                video_data.get('block_reason'),
                video_data['author'],
                video_data['thumbnail'],
                'youtube(인플루언서)',
                video_data['hits'],
                video_data['likes'],
                video_data['comments'],
                post_date
            ))
            self.db.commit()
            logger.info(f"데이터베이스에 저장 완료: {video_data['title']}")
            return True
        except Exception as e:
            logger.error(f"데이터베이스 저장 오류: {e}")
            return False
            
    def process_influencer_list(self, csv_path='frontend/public/YouTube_Cooking_influencer.csv'):
        """인플루언서 목록을 처리하고 영상을 수집"""
        try:
            # 시작할 때 한 번만 DB에서 기존 영상 ID들을 가져옴
            existing_ids = self.get_existing_video_ids()
            logger.info(f"기존 영상 수: {len(existing_ids)}")  # 추가된 로그
            
            df = pd.read_csv(r'C:\Users\user\Desktop\RefrigeratorCode\frontend\public\YouTube_Cooking_influencer.csv')
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
                logger.info(f"[진행상황] {idx+1}/{total_influencers} 처리 중: {channel_url}")  # 추가된 로그
                
                try:
                    channel_id = self.get_channel_id_from_url(channel_url)
                    if not channel_id:
                        logger.warning(f"채널 ID를 찾을 수 없음: {channel_url}")  # 추가된 로그
                        continue
                    
                    # 영상 목록 가져오기
                    video_id_list = self.get_channel_videos(channel_id)
                    if not video_id_list:
                        logger.info(f"새로운 영상이 없음: {channel_url}")  # 추가된 로그
                        continue
                    
                    # 혹시 모를 중복 제거
                    new_video_ids = [vid for vid in video_id_list if vid not in existing_ids]
                    if not new_video_ids:
                        logger.info(f"새로운 영상이 없음: {channel_url}")
                        continue

                    # 영상 상세 정보 가져오기
                    video_details = self.get_videos_info(new_video_ids, channel_key=channel_id)
                    
                    # DB에 저장
                    saved_count = 0
                    for video_detail in video_details:
                        video_info = {
                            'title': video_detail['snippet']['title'],
                            'link': f"https://www.youtube.com/watch?v={video_detail['id']}",
                            'description': video_detail['snippet'].get('description', ''),
                            'author': video_detail['snippet'].get('channelTitle', ''),
                            'thumbnail': video_detail['snippet']['thumbnails']['high']['url'] if video_detail['snippet'].get('thumbnails') else '',
                            'hits': int(video_detail.get('statistics', {}).get('viewCount', 0)),
                            'likes': int(video_detail.get('statistics', {}).get('likeCount', 0)),
                            'comments': int(video_detail.get('statistics', {}).get('commentCount', 0)),
                            'post_time': video_detail['snippet'].get('publishedAt', '')
                        }

                        # --- 재료 정보 필터링 (네이버와 동일 정책) ---
                        desc_text = video_info['description'] or ''
                        used_block, block_reason = extract_best_ingredient_block(desc_text)
                        if not used_block or len(used_block.strip()) < 10:
                            logger.info(f"[SKIP NO INGREDIENTS] 재료 정보가 없어 저장하지 않음: {video_info['link']}")
                            continue
                        used_ings = extract_ingredients(used_block)
                        if not used_ings or len(used_ings) <= 3:
                            logger.info(f"[SKIP FEW INGREDIENTS] 추출된 재료가 3개 이하여서 저장하지 않음: {video_info['link']} (재료: {used_ings})")
                            continue
                        video_info['used_ingredients'] = ','.join(used_ings)
                        video_info['used_ingredients_block'] = used_block
                        video_info['block_reason'] = block_reason
                        # ---

                        if self.save_to_db(video_info):
                            saved_count += 1
                    
                    new_videos_count += saved_count
                    processed_count += 1
                    logger.info(f"새로 저장된 영상: {saved_count}개")  # 추가된 로그
                    
                except Exception as e:
                    logger.error(f"Error processing channel {channel_url}: {e}")
                    continue
                
            logger.info("모든 인플루언서 처리 완료")  # 추가된 로그
            
            # 할당량 사용량 요약 로깅
            logger.info(f"=== YouTube API 할당량 사용량 요약 ===")
            logger.info(f"처리된 인플루언서 수: {processed_count}/{total_influencers}")
            logger.info(f"새로 수집된 영상 수: {new_videos_count}")
            logger.info(f"Search API 호출 횟수: {self.search_api_calls}")
            logger.info(f"Videos API 호출 횟수: {self.videos_api_calls}")
            logger.info(f"예상 할당량 사용량: {self.quota_used}")
            logger.info(f"할당량 제한: {self.daily_quota_limit}")
            logger.info(f"예상 할당량 잔여량: {self.daily_quota_limit - self.quota_used}")

            # 채널별 상위 소비 TOP5
            try:
                top_channels = sorted(self.per_channel_usage.items(), key=lambda kv: kv[1]['estimated_cost'], reverse=True)[:5]
                logger.info("--- 채널별 예상 할당량 TOP5 ---")
                for ch, usage in top_channels:
                    logger.info(f"channel={ch} | search_calls={usage['search_calls']} | videos_calls={usage['videos_calls']} | est_cost={usage['estimated_cost']}")
            except Exception:
                pass
            
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
            
    def delete_low_ingredient_entries(self):
        connection = pymysql.connect(
            host='caboose.proxy.rlwy.net',
            user='root',
            password='HkqYFCoKPPPxgryxiEbUYxcYynQXxeRF',
            db='railway',
            port=47779,
            charset='utf8mb4',
            cursorclass=pymysql.cursors.DictCursor
        )

        try:
            with connection.cursor() as cursor:
                today = datetime.now().strftime('%Y-%m-%d')
                delete_query = """
                DELETE FROM recipes
                WHERE DATE(collected_at) = %s
                AND (LENGTH(used_ingredients) - LENGTH(REPLACE(used_ingredients, ',', '')) + 1) <= 3
                """
                cursor.execute(delete_query, (today,))
                connection.commit()
                print(f"Deleted entries with 3 or fewer ingredients collected on {today}.")
        finally:
            connection.close()

    def close(self):
        """DB 연결 종료"""
        if self.db:
            self.db.close()

    def check_quota_status(self):
        """할당량 상태 확인 - 간단한 API 호출로 테스트"""
        try:
            logger.info("할당량 상태 확인 중...")
            # 가장 가벼운 API 호출로 할당량 상태 확인
            request = self.youtube.search().list(part='id', q='test', type='video', maxResults=1)
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

    def make_api_request_with_retry(self, endpoint_or_request, params=None, context=None):
        """search/videos 양쪽을 모두 지원하는 재시도 래퍼"""
        for attempt in range(self.max_retries):
            try:
                if params is None and hasattr(endpoint_or_request, 'execute'):
                    request = endpoint_or_request
                else:
                    if isinstance(endpoint_or_request, str):
                        if endpoint_or_request == 'search':
                            request = self.youtube.search().list(**params)
                        elif endpoint_or_request == 'channels':
                            request = self.youtube.channels().list(**params)
                        elif endpoint_or_request == 'playlistItems':
                            request = self.youtube.playlistItems().list(**params)
                        elif endpoint_or_request == 'videos':
                            request = self.youtube.videos().list(**params)
                        else:
                            raise ValueError(f"Unsupported endpoint: {endpoint_or_request}")
                    else:
                        # 잘못된 인자 형태
                        raise ValueError("Invalid arguments for make_api_request_with_retry")
                response = request.execute()
                # 성공 시 할당량 로깅(엔드포인트별 비용 추정)
                if isinstance(endpoint_or_request, str):
                    cost = self.quota_cost_map.get(endpoint_or_request, 0)
                    desc = context.get('desc') if isinstance(context, dict) else None
                    ch = context.get('channel') if isinstance(context, dict) else None
                    self.log_api_call(endpoint_or_request, desc or f"{endpoint_or_request}.list", cost, channel_key=ch)
                return response
            except Exception as e:
                logger.error(f"API 요청 중 예외 발생 (재시도 {attempt+1}/{self.max_retries}): {e}")
                # quotaExceeded 감지 시 플래그 설정 및 즉시 중단
                err = str(e)
                if 'quotaExceeded' in err:
                    self.quota_exceeded = True
                    logger.warning("quotaExceeded 감지 → 추가 API 호출 중단")
                    break
                time.sleep(self.retry_delay)
        logger.error(f"API 요청 실패: endpoint={endpoint_or_request}, params={params}")
        return None

if __name__ == "__main__":
    crawler = YouTubeCrawler()
    try:
        crawler.process_influencer_list()
    finally:
        crawler.delete_low_ingredient_entries()
        crawler.close() 