import requests
from bs4 import BeautifulSoup
import pandas as pd
import time
import random
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from datetime import datetime
import pymysql
import logging
import re
from selenium.common.exceptions import TimeoutException, StaleElementReferenceException
from urllib.parse import quote

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Database configuration
DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': 'sk784512!!',
    'db': 'refrigerator',
    'charset': 'utf8mb4'
}

class NaverInfluencerCrawler:
    def __init__(self):
        self._setup_driver()
        self._setup_database()
    
    def _setup_driver(self):
        """Setup Selenium WebDriver."""
        options = Options()
        # options.add_argument("--headless")  # headless 모드 비활성화
        options.add_argument("--disable-gpu")
        options.add_argument("--window-size=1920x1080")
        driver_path = "C:/Users/user/Desktop/RefrigeratorCode/chromedriver-win64/chromedriver.exe"
        service = Service(driver_path)
        self.driver = webdriver.Chrome(service=service, options=options)
        self.wait = WebDriverWait(self.driver, 10)
    
    def _setup_database(self):
        """Setup database connection."""
        self.db = pymysql.connect(**DB_CONFIG, cursorclass=pymysql.cursors.DictCursor)
        self.cursor = self.db.cursor()
    
    def _load_all_recipe_cards(self):
        """Click '더보기' button 20 times to load all recipe cards."""
        for i in range(20):
            try:
                more_button = self.wait.until(
                    EC.element_to_be_clickable((By.CSS_SELECTOR, "button.CollectionTopic__btn_more___dzWOi"))
                )
                more_button.click()
                time.sleep(2)
                logger.info(f"더보기 버튼 클릭 {i+1}/20")
            except Exception as e:
                logger.error(f"더보기 버튼 클릭 실패: {str(e)}")
                break
    
    def _process_blog_post(self, url):
        """Process a single blog post and return data."""
        try:
            logger.info(f"[BLOG] 블로그 포스트 접근: {url}")
            self.driver.get(url)
            time.sleep(2)
            
            # Check if it's a video post
            try:
                video_element = self.driver.find_element(By.CSS_SELECTOR, 'div.ControlArea-module__touch_wrap__XWNof')
                if video_element:
                    logger.info(f"[SKIP VIDEO] 영상 포스트이므로 건너뜀: {url}")
                    return None
            except:
                pass  # No video element found, continue processing
            
            # Switch to iframe if present
            try:
                iframe = self.wait.until(
                    EC.presence_of_element_located((By.ID, "mainFrame"))
                )
                self.driver.switch_to.frame(iframe)
                logger.info("[BLOG] iframe으로 전환 완료")
            except TimeoutException:
                logger.info("[SKIP] iframe이 없는 영상 형태의 컨텐츠이므로 건너뜀")
                return None
            
            # Get title
            title_element = self.wait.until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "div.se-title-text"))
            )
            title = title_element.text.strip()
            logger.info(f"[BLOG] 제목 추출: {title}")
            
            # Get likes count
            try:
                likes_elements = self.driver.find_elements(By.CSS_SELECTOR, "em.u_cnt._count")
                likes_text = ""
                for element in likes_elements:
                    text = element.text.strip()
                    if text:  # 비어있지 않은 첫 번째 값을 사용
                        likes_text = text
                        break
                likes = int(likes_text) if likes_text else 0
                logger.info(f"[BLOG] 좋아요 수: {likes}")
            except Exception as e:
                likes = 0
                logger.error(f"[BLOG] 좋아요 수를 찾을 수 없음: {str(e)}")
            
            # Get comments count
            try:
                comments_element = self.wait.until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, "em._commentCount"))
                )
                comments_text = comments_element.text.strip()
                comments = int(comments_text) if comments_text else 0
                logger.info(f"[BLOG] 댓글 수: {comments}")
            except Exception as e:
                comments = 0
                logger.error(f"[BLOG] 댓글 수를 찾을 수 없음: {str(e)}")
            
            # Extract data
            try:
                # 본문 내용 추출
                content_elements = self.driver.find_elements(By.CSS_SELECTOR, "div.se-module-text")
                content_texts = []
                for element in content_elements:
                    text = element.text.strip()
                    if text:  # 빈 텍스트가 아닌 경우만 추가
                        content_texts.append(text)
                content = "\n".join(content_texts)  # 각 텍스트를 줄바꿈으로 구분
                logger.info("[BLOG] 본문 내용 추출 완료")
            except Exception as e:
                content = ""
                logger.error(f"[BLOG] 본문 내용 추출 실패: {str(e)}")

            try:
                author = self.driver.find_element(By.CSS_SELECTOR, 'span.nick').text.strip()
            except:
                author = ''
            
            try:
                thumbnail = self.driver.find_element(By.CSS_SELECTOR, 'img.se-image-resource').get_attribute('src')
            except:
                thumbnail = ''
            
            try:
                post_time = self.driver.find_element(By.CSS_SELECTOR, 'span.se_publishDate').text.strip()
                post_time = self._convert_post_time(post_time)
            except:
                post_time = None
            
            logger.info(f"[BLOG] 작성자: {author}, 작성일: {post_time}")
            
            return {
                'title': title,
                'link': url,
                'content': content,
                'author': author,
                'thumbnail': thumbnail,
                'platform': 'naver(인플루언서핫토픽)',
                'likes': likes,
                'comments': comments,
                'post_time': post_time,
                'collected_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            }
        except Exception as e:
            logger.error(f"[BLOG] 블로그 포스트 처리 중 오류 발생: {str(e)}")
            return None
    
    def _convert_post_time(self, time_text):
        """Convert post time text to YYYY-MM-DD format."""
        try:
            time_text = re.sub(r'\s+\d+:\d+', '', time_text)
            now = datetime.now()
            
            if "시간 전" in time_text:
                hours = int(re.search(r"(\d+)", time_text).group(1))
                post_date = now - timedelta(hours=hours)
            elif "분 전" in time_text:
                minutes = int(re.search(r"(\d+)", time_text).group(1))
                post_date = now - timedelta(minutes=minutes)
            elif "일 전" in time_text:
                days = int(re.search(r"(\d+)", time_text).group(1))
                post_date = now - timedelta(days=days)
            else:
                post_date = datetime.strptime(time_text.strip(), "%Y. %m. %d.")
            
            return post_date.strftime("%Y-%m-%d")
        except Exception as e:
            logger.error(f"시간 변환 오류: {time_text} - {str(e)}")
            return None
    
    def _save_to_database(self, data):
        """Save collected data to database."""
        if not data:
            return
        
        try:
            sql = """
                INSERT INTO recipes 
                (title, link, content, author, thumbnail, platform, likes, comments, post_time, collected_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            values = (
                data['title'], data['link'], data['content'], data['author'],
                data['thumbnail'], data['platform'], data['likes'], data['comments'],
                data['post_time'], data['collected_at']
            )
            self.cursor.execute(sql, values)
            self.db.commit()
            logger.info(f"✅ 저장 완료: {data['title']}")
        except Exception as e:
            logger.error(f"데이터베이스 저장 중 오류 발생: {str(e)}")
            self.db.rollback()
    
    def get_blog_content(self, url):
        try:
            self.driver.get(url)
            time.sleep(3)
            
            # 더보기 버튼 클릭
            try:
                more_button = WebDriverWait(self.driver, 10).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, "a.link_more"))
                )
                more_button.click()
                time.sleep(2)
            except Exception as e:
                print(f"더보기 버튼 클릭 실패: {str(e)}")
            
            # 블로그 본문 내용 가져오기
            content = WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "div.se-main-container"))
            ).text
            
            # 작성자 정보 가져오기
            try:
                author = WebDriverWait(self.driver, 10).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, "span.nick a"))
                ).text
            except:
                author = "Unknown"
            
            return content, author
            
        except Exception as e:
            print(f"블로그 내용 가져오기 실패: {str(e)}")
            return None, None

    def crawl_naver_blog(self):
        try:
            # 검색어 설정
            search_query = "레시피"
            encoded_query = quote(search_query)
            url = f"https://search.naver.com/search.naver?where=view&query={encoded_query}&sm=tab_jum"
            
            print("[진행상황] 검색 페이지 접속 중...")
            self.driver.get(url)
            time.sleep(3)
            
            # 스크롤 다운
            print("[진행상황] 스크롤 다운 시작...")
            last_height = self.driver.execute_script("return document.body.scrollHeight")
            scroll_count = 0
            while True:
                self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                time.sleep(2)
                new_height = self.driver.execute_script("return document.body.scrollHeight")
                if new_height == last_height:
                    break
                last_height = new_height
                scroll_count += 1
                print(f"[진행상황] 스크롤 다운 {scroll_count}회 완료")
            
            # 블로그 포스트 링크 수집
            print("[진행상황] 블로그 링크 수집 중...")
            blog_links = []
            elements = self.driver.find_elements(By.CSS_SELECTOR, "a.total_tit")
            for element in elements:
                try:
                    link = element.get_attribute("href")
                    if link and "blog.naver.com" in link:
                        blog_links.append(link)
                except:
                    continue
            
            total_links = len(blog_links)
            print(f"[진행상황] 총 {total_links}개의 블로그 링크 발견")
            
            # 각 블로그 포스트 처리
            for idx, link in enumerate(blog_links, 1):
                try:
                    print(f"\n[진행상황] {idx}/{total_links} 번째 블로그 처리 중... ({(idx/total_links)*100:.1f}%)")
                    content, author = self.get_blog_content(link)
                    if not content:
                        print(f"[진행상황] {idx}번째 블로그 내용 추출 실패, 다음으로 진행")
                        continue
                    
                    # 재료 정보 추출
                    ingredients = self.extract_ingredients(content)
                    if not ingredients:
                        print(f"[진행상황] {idx}번째 블로그에서 재료 정보를 찾을 수 없음, 다음으로 진행")
                        continue
                    
                    # 제목 추출
                    title = self.driver.find_element(By.CSS_SELECTOR, "h3.se-text").text
                    
                    # 날짜 추출
                    try:
                        date = self.driver.find_element(By.CSS_SELECTOR, "span.se_publishDate").text
                    except:
                        date = "Unknown"
                    
                    # 이미지 URL 추출
                    try:
                        img_element = self.driver.find_element(By.CSS_SELECTOR, "img.se-image-resource")
                        img_url = img_element.get_attribute("src")
                    except:
                        img_url = None
                    
                    # 데이터 저장
                    blog_data = {
                        "title": title,
                        "content": content,
                        "author": author,
                        "date": date,
                        "url": link,
                        "img_url": img_url,
                        "used_ingredients": ingredients
                    }
                    
                    self.save_to_json(blog_data)
                    print(f"[진행상황] {idx}번째 블로그 포스트 저장 완료: {title}")
                    
                except Exception as e:
                    print(f"[진행상황] {idx}번째 블로그 포스트 처리 실패: {str(e)}")
                    continue
                
        except Exception as e:
            print(f"[오류] 크롤링 실패: {str(e)}")
        finally:
            self.driver.quit()

    def crawl(self):
        """Main crawling method."""
        try:
            # Start from the main page
            logger.info("[START] 크롤링 시작")
            self.driver.get("https://in.naver.com/discover/135968760155968")
            time.sleep(3)
            
            # Load all recipe cards
            logger.info("[MAIN] 더보기 버튼 클릭 시작")
            self._load_all_recipe_cards()
            
            # Get all recipe cards and extract hrefs only
            recipe_cards = self.wait.until(
                EC.presence_of_all_elements_located((By.CSS_SELECTOR, "a[href*='/topic/']"))
            )
            topic_urls = [card.get_attribute('href') for card in recipe_cards]
            logger.info(f"[MAIN] 총 {len(topic_urls)}개의 레시피 카드 발견")
            
            for topic_url in topic_urls:
                try:
                    logger.info(f"[TOPIC] 토픽 페이지 접근: {topic_url}")
                    self.driver.get(topic_url)
                    time.sleep(3)
                    
                    # Find only "블로그에서 더보기" buttons
                    blog_buttons = self.wait.until(
                        EC.presence_of_all_elements_located((
                            By.CSS_SELECTOR,
                            "a.TopicContent__link___HTKpK"
                        ))
                    )
                    
                    # Filter only blog buttons
                    blog_urls = []
                    for button in blog_buttons:
                        try:
                            button_text = button.text.strip()
                            if "블로그에서 더보기" in button_text:
                                blog_url = button.get_attribute('href')
                                blog_urls.append(blog_url)
                                logger.info(f"[TOPIC] 블로그 링크 발견: {blog_url}")
                        except Exception as e:
                            logger.error(f"[TOPIC] 버튼 처리 중 오류: {str(e)}")
                            continue
                    
                    logger.info(f"[TOPIC] 블로그에서 더보기 버튼 {len(blog_urls)}개 발견")
                    
                    for blog_url in blog_urls:
                        try:
                            # Process blog post
                            data = self._process_blog_post(blog_url)
                            if data:
                                self._save_to_database(data)
                            
                        except Exception as e:
                            logger.error(f"[TOPIC] 블로그 포스트 처리 중 오류 발생: {str(e)}")
                            continue
                    
                except Exception as e:
                    logger.error(f"[TOPIC] 토픽 처리 중 오류 발생: {str(e)}")
                    continue
            
        except Exception as e:
            logger.error(f"[ERROR] 크롤링 중 오류 발생: {str(e)}")
        finally:
            logger.info("[END] 크롤링 종료")
            self.driver.quit()
            self.db.close()

if __name__ == "__main__":
    crawler = NaverInfluencerCrawler()
    crawler.crawl() 