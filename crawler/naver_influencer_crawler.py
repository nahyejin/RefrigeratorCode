import requests
from bs4 import BeautifulSoup
import time
import random
import logging
from typing import List, Dict, Optional
from datetime import datetime
import json
import os
import socket
import dns.resolver
import re
from urllib.parse import urljoin
import pymysql
from tqdm import tqdm
import sys

# Add the parent directory to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from ingredient_management.update_used_ingredients_batch import extract_best_ingredient_block, extract_ingredients

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class NaverInfluencerCrawler:
    def __init__(self):
        self.base_url = "https://in.naver.com/discover/135968760155968"
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        })
        self.max_retries = 3
        self.retry_delay = 2
        self.timeout = 10

        # DNS 설정
        self._setup_dns()
        
        # DB 연결 설정
        self.db_config = {
            'host': 'localhost',
            'user': 'root',
            'password': 'sk784512!!',
            'db': 'refrigerator',
            'charset': 'utf8mb4',
            'cursorclass': pymysql.cursors.DictCursor
        }

    def _setup_dns(self):
        """DNS 설정"""
        try:
            # Google DNS 서버 사용
            resolver = dns.resolver.Resolver()
            resolver.nameservers = ['8.8.8.8', '8.8.4.4']
            dns.resolver.default_resolver = resolver
            logger.info("DNS resolver configured successfully")
        except Exception as e:
            logger.error(f"Failed to configure DNS resolver: {str(e)}")

    def _connect_db(self):
        """DB 연결"""
        try:
            return pymysql.connect(**self.db_config)
        except Exception as e:
            logger.error(f"Database connection failed: {str(e)}")
            return None

    def _save_to_db(self, data: Dict):
        """데이터를 DB에 저장 (필터 없이 모두 저장)"""
        if not data:
            return

        # 추출된 데이터 로그로 출력
        logger.info(f"Saving to DB: {json.dumps(data, ensure_ascii=False)}")

        conn = self._connect_db()
        if not conn:
            return

        try:
            with conn.cursor() as cursor:
                sql = """
                INSERT INTO recipes (
                    title, link, content, author, thumbnail, 
                    platform, likes, comments, post_time, collected_at
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
                """
                cursor.execute(sql, (
                    data['title'],
                    data['link'],
                    data['content'],
                    data['author'],
                    data['thumbnail'],
                    data['platform'],
                    data['likes'],
                    data['comments'],
                    data['post_time'],
                    data['collected_at']
                ))
            conn.commit()
            logger.info(f"Successfully saved recipe: {data['title']}")
        except Exception as e:
            logger.error(f"Error saving to database: {str(e)}")
        finally:
            conn.close()

    def _make_request(self, url: str) -> Optional[BeautifulSoup]:
        """요청을 보내고 BeautifulSoup 객체를 반환"""
        for attempt in range(self.max_retries):
            try:
                # IP 주소 직접 확인
                domain = url.split('//')[1].split('/')[0]
                try:
                    ip_address = socket.gethostbyname(domain)
                    logger.info(f"Resolved {domain} to {ip_address}")
                except socket.gaierror as e:
                    logger.error(f"Failed to resolve {domain}: {str(e)}")
                    continue

                response = self.session.get(url, timeout=self.timeout)
                response.raise_for_status()
                return BeautifulSoup(response.text, 'html.parser')
            except requests.RequestException as e:
                logger.error(f"Request failed (attempt {attempt + 1}/{self.max_retries}): {str(e)}")
                if attempt < self.max_retries - 1:
                    time.sleep(self.retry_delay * (attempt + 1))
                continue
        return None

    def _extract_recipe_cards(self, soup: BeautifulSoup) -> List[Dict]:
        """레시피 카드 정보 추출"""
        recipe_cards = []
        cards = soup.select('div.CollectionTopicCard__root___rv6dQ')
        
        for card in cards:
            try:
                link_element = card.select_one('a')
                if not link_element:
                    continue
                    
                link = link_element.get('href', '')
                if not link.startswith('http'):
                    link = f"https://in.naver.com{link}"
                
                title_element = card.select_one('a.CollectionTopicCard__title___uDcAM')
                title = title_element.get_text(strip=True) if title_element else ""
                
                author_element = card.select_one('div.CollectionTopicCard__name___yojnV')
                author = author_element.get_text(strip=True) if author_element else ""
                
                recipe_cards.append({
                    'title': title,
                    'link': link,
                    'author': author
                })
            except Exception as e:
                logger.error(f"Error extracting recipe card: {str(e)}")
                continue
                
        return recipe_cards

    def _extract_blog_links(self, soup: BeautifulSoup) -> List[str]:
        """블로그 더보기 링크만 추출"""
        blog_links = []
        links = soup.select('a.TopicContent__link___HTKpK')
        for link in links:
            text = link.get_text(strip=True)
            if "블로그에서 더보기" in text:
                href = link.get('href', '')
                if href:
                    full_url = urljoin("https://in.naver.com", href)
                    blog_links.append(full_url)
        return blog_links

    def _extract_blog_content(self, soup: BeautifulSoup, current_url: str = "") -> Dict:
        """블로그 레시피 페이지에서 데이터 추출 (실제 blog.naver.com 본문까지 진입)"""
        try:
            # 영상 포스트(동영상) 감지 시 건너뜀
            if soup.select_one('div.ControlArea-module__touch_wrap__XWNof'):
                logger.info(f"[SKIP VIDEO] 영상 포스트이므로 건너뜀: {current_url}")
                return {}
            # 1. in.naver.com/contents/internal/ 페이지라면 blog.naver.com 링크 추출
            blog_real_url = None
            # iframe 방식
            iframe = soup.select_one('iframe#mainFrame')
            if iframe and iframe.get('src'):
                blog_real_url = iframe.get('src')
                if blog_real_url.startswith('/'):
                    blog_real_url = 'https://blog.naver.com' + blog_real_url
            # meta refresh 방식
            if not blog_real_url:
                meta = soup.select_one('meta[http-equiv="refresh"]')
                if meta and 'url=' in meta.get('content', ''):
                    blog_real_url = meta.get('content').split('url=')[-1]
            # a 태그 직접 링크
            if not blog_real_url:
                a_tag = soup.find('a', href=True)
                if a_tag and 'blog.naver.com' in a_tag['href']:
                    blog_real_url = a_tag['href']
            # 만약 blog.naver.com 링크를 찾았다면, 해당 페이지를 다시 요청
            if blog_real_url and 'blog.naver.com' in blog_real_url:
                logger.info(f"[REAL BLOG] {blog_real_url}")
                blog_resp = self.session.get(blog_real_url, timeout=self.timeout)
                blog_resp.raise_for_status()
                soup = BeautifulSoup(blog_resp.text, 'html.parser')
            # 2. 실제 blog.naver.com 본문에서 selector로 데이터 추출
            # 제목
            title = ''
            try:
                title_element = soup.select_one('div.se-module.se-module-text.se-title-text')
                if title_element:
                    title_span = title_element.select_one('span')
                    title = title_span.get_text(strip=True) if title_span else title_element.get_text(strip=True)
                else:
                    logger.warning(f"[NO TITLE] {current_url}")
            except Exception as e:
                logger.error(f"[TITLE ERROR] {current_url} - {e}")
            # 작성자
            author = ''
            author_selectors = [
                'strong.ell',  # 신버전 에디터
                'span.nick a',  # 구버전 에디터
                'span.nick',    # 대체 선택자
                'div.blog2_post_title span',  # 추가 선택자
                'div.blog2_post_title a'      # 추가 선택자
            ]
            
            for selector in author_selectors:
                try:
                    author_element = soup.select_one(selector)
                    if author_element:
                        author = author_element.get_text(strip=True)
                        if author:  # 빈 문자열이 아닌 경우에만 사용
                            logger.info(f"[AUTHOR] 작성자 정보 발견: {author} (선택자: {selector})")
                            break
                except Exception as e:
                    logger.debug(f"선택자 {selector}로 작성자 찾기 실패: {e}")
                    continue
            
            if not author:
                logger.warning(f"[NO AUTHOR] {current_url}")
            # 썸네일 (본문 첫 번째 이미지)
            thumbnail = ''
            try:
                content_container = soup.select_one('div.se-main-container')
                if content_container:
                    img_element = content_container.select_one('img.se-image-resource')
                    if img_element:
                        thumbnail = img_element.get('src', '')
                    else:
                        logger.warning(f"[NO THUMBNAIL IMG] {current_url}")
                else:
                    logger.warning(f"[NO CONTENT CONTAINER FOR IMG] {current_url}")
            except Exception as e:
                logger.error(f"[THUMBNAIL ERROR] {current_url} - {e}")

            # 좋아요 수와 댓글 수 추출
            likes = 0
            comments = 0
            try:
                # 좋아요 수 추출
                sympathy_area = soup.select_one('div.area_sympathy')
                if sympathy_area:
                    em_tags = sympathy_area.select('em.u_cnt._count')
                    for em in em_tags:
                        likes_text = em.get_text(strip=True)
                        if likes_text:
                            likes = int(likes_text.replace(',', ''))
                            logger.info(f"[LIKES FOUND] {current_url} - {likes}")
                            break
                else:
                    logger.warning(f"[NO LIKES] {current_url}")

                # 댓글 수 추출
                comments_element = soup.select_one('div.area_comment em#commentCount._commentCount')
                if comments_element:
                    comments_text = comments_element.get_text(strip=True)
                    comments = int(comments_text.replace(',', '')) if comments_text.isdigit() else 0
                    logger.info(f"[COMMENTS FOUND] {current_url} - {comments}")
                else:
                    logger.warning(f"[NO COMMENTS] {current_url}")
            except Exception as e:
                logger.error(f"[LIKES/COMMENTS ERROR] {current_url} - {e}")

            # 작성일
            post_time = None
            try:
                date_element = soup.select_one('p.blog_date')
                if date_element:
                    date_text = date_element.get_text(strip=True)
                    date_formats = [
                        '%Y. %m. %d. %H:%M',
                        '%Y.%m.%d. %H:%M',
                        '%Y-%m-%d %H:%M',
                        '%Y.%m.%d',
                        '%Y. %m. %d.'
                    ]
                    for date_format in date_formats:
                        try:
                            post_time = datetime.strptime(date_text, date_format).strftime('%Y-%m-%d')
                            break
                        except Exception:
                            continue
                    if not post_time:
                        post_time = datetime.now().strftime('%Y-%m-%d')
                else:
                    logger.warning(f"[NO POST TIME] {current_url}")
                    post_time = datetime.now().strftime('%Y-%m-%d')
            except Exception as e:
                logger.error(f"[POST TIME ERROR] {current_url} - {e}")
                post_time = datetime.now().strftime('%Y-%m-%d')
            # 본문
            content = ''
            try:
                if content_container:
                    content = content_container.get_text(separator='\n', strip=True)
                else:
                    logger.warning(f"[NO CONTENT CONTAINER FOR CONTENT] {current_url}")
            except Exception as e:
                logger.error(f"[CONTENT ERROR] {current_url} - {e}")

            # --- 재료 정보 필터링 추가 ---
            used_ingredients_block, block_reason = extract_best_ingredient_block(content)
            if not used_ingredients_block or len(used_ingredients_block.strip()) < 10:
                logger.info(f"[SKIP NO INGREDIENTS] 재료 정보가 없는 포스트: {current_url}")
                return {}
            used_ingredients = extract_ingredients(used_ingredients_block)
            # ---

            return {
                'title': title,
                'author': author,
                'thumbnail': thumbnail,
                'likes': likes,
                'comments': comments,
                'post_time': post_time,
                'content': content,
                'platform': 'naver(인플루언서핫토픽)',
                'collected_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'used_ingredients': used_ingredients,
                'used_ingredients_block': used_ingredients_block,
                'block_reason': block_reason
            }
        except Exception as e:
            import traceback
            logger.error(f"[FATAL ERROR] {current_url} - {e}\n{traceback.format_exc()}")
            return {}

    def crawl(self) -> List[Dict]:
        """크롤링 실행"""
        all_recipes = []
        
        # 초기 페이지 접근
        soup = self._make_request(self.base_url)
        if not soup:
            logger.error("Failed to fetch initial page")
            return all_recipes
            
        # 레시피 카드 수집
        recipe_cards = self._extract_recipe_cards(soup)
        total_cards = len(recipe_cards)
        logger.info(f"Found {total_cards} recipe cards")
        
        # 진행률 표시를 위한 tqdm 설정
        with tqdm(total=total_cards, desc="Crawling Progress") as pbar:
            # 각 레시피 카드 처리
            for card in recipe_cards:
                try:
                    # 상세 페이지 접근
                    detail_soup = self._make_request(card['link'])
                    if not detail_soup:
                        continue
                        
                    # 블로그 링크 수집
                    blog_links = self._extract_blog_links(detail_soup)
                    logger.info(f"Found {len(blog_links)} blog links for recipe: {card['title']}")
                    
                    # 각 블로그 페이지 처리
                    for blog_link in blog_links:
                        blog_soup = self._make_request(blog_link)
                        if not blog_soup:
                            continue
                            
                        recipe_data = self._extract_blog_content(blog_soup, current_url=blog_link)
                        if recipe_data:
                            recipe_data['link'] = blog_link
                            all_recipes.append(recipe_data)
                            # DB에 저장
                            self._save_to_db(recipe_data)
                            
                        time.sleep(random.uniform(1, 2))
                        
                except Exception as e:
                    logger.error(f"Error processing recipe card: {str(e)}")
                    continue
                    
                time.sleep(random.uniform(1, 2))
                pbar.update(1)
                pbar.set_postfix({'Current': f"{card['title'][:20]}..."})
            
        return all_recipes

    def save_to_json(self, data: List[Dict], filename: str = "naver_influencer_topics.json"):
        """데이터를 JSON 파일로 저장"""
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            logger.info(f"Data saved to {filename}")
        except Exception as e:
            logger.error(f"Error saving data to file: {str(e)}")

def main():
    crawler = NaverInfluencerCrawler()
    recipes = crawler.crawl()
    crawler.save_to_json(recipes)
    logger.info(f"Total recipes collected: {len(recipes)}")

if __name__ == "__main__":
    main() 