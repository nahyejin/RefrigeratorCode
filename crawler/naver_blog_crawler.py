"""
Naver crawler implementation for both blog and influencer content.
"""
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from bs4 import BeautifulSoup
from datetime import datetime, timedelta
import pymysql
import time
import re
import sys
import os
import logging
from typing import Tuple
import traceback

from crawler.common.base_crawler import BaseCrawler
from crawler.common.data_models import Recipe
from crawler.common.constants import DB_CONFIG, NAVER_TARGETS, PLATFORM_NAVER
from ingredient_management.update_used_ingredients_batch import extract_best_ingredient_block, extract_ingredients

class NaverBlogCrawler(BaseCrawler):
    def __init__(self):
        super().__init__()
        self.platform = PLATFORM_NAVER
        self.logger = logging.getLogger(__name__)
        self._setup_driver()
        self._setup_database()
    
    def _setup_driver(self):
        """Setup Selenium WebDriver."""
        driver_path = 'C:/Users/user/Desktop/RefrigeratorCode/chromedriver-win64/chromedriver.exe'
        options = Options()
        options.add_argument("--headless")  # headless 모드 활성화
        options.add_argument("--disable-gpu")
        options.add_argument("--window-size=1920x1080")
        service = Service(driver_path)
        self.driver = webdriver.Chrome(service=service, options=options)
    
    def _setup_database(self):
        """Setup database connection."""
        conn = pymysql.connect(
            host=os.getenv('DB_HOST') or os.getenv('MYSQLHOST') or os.getenv('MYSQL_HOST'),
            user=os.getenv('DB_USER') or os.getenv('MYSQLUSER') or os.getenv('MYSQL_USER'),
            password=os.getenv('DB_PASSWORD') or os.getenv('MYSQLPASSWORD') or os.getenv('MYSQL_PASSWORD'),
            db=os.getenv('DB_NAME') or os.getenv('MYSQLDATABASE') or os.getenv('MYSQL_DATABASE') or 'railway',
            port=int(os.getenv('DB_PORT') or os.getenv('MYSQLPORT') or os.getenv('MYSQL_PORT') or 3306),
            charset='utf8mb4',
            cursorclass=pymysql.cursors.DictCursor
        )
        self.cursor = conn.cursor()
    
    def convert_post_time(self, time_text: str) -> str:
        """Convert post time text to datetime string."""
        if not time_text or not time_text.strip():
            return None
            
        now = datetime.now()
        try:
            time_text = time_text.strip()
            print(f"시간 변환 시도: '{time_text}'")
            
            # 시간/분/일 전 형식 처리
            if "시간 전" in time_text:
                match = re.search(r"(\d+)시간", time_text)
                if match:
                    hours = int(match.group(1))
                    post_date = now - timedelta(hours=hours)
                    result = post_date.strftime("%Y-%m-%d")
                    print(f"시간 전 변환: {time_text} -> {result}")
                    return result
            elif "분 전" in time_text:
                match = re.search(r"(\d+)분", time_text)
                if match:
                    minutes = int(match.group(1))
                    post_date = now - timedelta(minutes=minutes)
                    result = post_date.strftime("%Y-%m-%d")
                    print(f"분 전 변환: {time_text} -> {result}")
                    return result
            elif "일 전" in time_text:
                match = re.search(r"(\d+)일", time_text)
                if match:
                    days = int(match.group(1))
                    post_date = now - timedelta(days=days)
                    result = post_date.strftime("%Y-%m-%d")
                    print(f"일 전 변환: {time_text} -> {result}")
                    return result
            else:
                # yyyy. mm. dd. 형식 처리
                # 시간 부분 제거 (예: "2024. 1. 15. 14:30" -> "2024. 1. 15.")
                time_text = re.sub(r'\s+\d{1,2}:\d{2}', '', time_text)
                
                # 다양한 날짜 형식 시도
                date_formats = [
                    "%Y. %m. %d.",
                    "%Y.%m.%d.",
                    "%Y. %m. %d",
                    "%Y.%m.%d",
                    "%Y-%m-%d",
                    "%Y/%m/%d"
                ]
                
                for date_format in date_formats:
                    try:
                        post_date = datetime.strptime(time_text, date_format)
                        result = post_date.strftime("%Y-%m-%d")
                        print(f"날짜 형식 변환: {time_text} -> {result}")
                        return result
                    except ValueError:
                        continue
                        
            print(f"❌ 시간 변환 실패: 지원하지 않는 형식 '{time_text}'")
            return None
            
        except Exception as e:
            print(f"❌ 시간 변환 오류: {time_text} - {str(e)}")
            return None
    
    def crawl(self):
        """Main crawling method."""
        total_posts = 0
        saved_posts = 0
        total_pages = 100

        for page in range(1, total_pages + 1):
            progress = (page / total_pages) * 100
            print(f"\n[진행상황] {page}/{total_pages} 페이지 수집 중... ({progress:.1f}% 완료)")
            url = f"https://section.blog.naver.com/ThemePost.naver?directoryNo=20&activeDirectorySeq=2&currentPage={page}"
            self.driver.get(url)
            WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.CLASS_NAME, "info_post"))
            )
            soup = BeautifulSoup(self.driver.page_source, "html.parser")
            posts = soup.select("div.info_post")
            print(f"[진행상황] 페이지 {page}에서 {len(posts)}개의 포스트 발견")
            total_posts += len(posts)
            
            for idx, post in enumerate(posts, 1):
                post_progress = (idx / len(posts)) * 100
                link_tag = post.select_one("a.desc_inner")
                link = link_tag["href"] if link_tag else ""
                if not link:
                    continue
                print(f"[진행상황] {page}페이지의 {idx}/{len(posts)} 번째 포스트 처리 중... ({post_progress:.1f}% 완료)")
                print(f"[진행상황] 블로그 원문 접근: {link}")
                self.driver.get(link)
                time.sleep(2)
                try:
                    recipe = self._process_blog_post_from_blog_page(link)
                    if recipe:
                        self.save_to_database(recipe)
                        saved_posts += 1
                except Exception as e:
                    print(f"Error processing blog post: {e}")
                    print(traceback.format_exc())
                    continue

        total_progress = (saved_posts / total_posts) * 100 if total_posts > 0 else 0
        print("\n✅ 크롤링 및 MySQL 저장 완료!")
        print(f"[결과] 총 처리된 포스트: {total_posts}")
        print(f"[결과] 총 저장된 포스트: {saved_posts} ({total_progress:.1f}% 성공률)")
        self.driver.quit()
        self.cursor.close()
        print("\n🔄 재료 정보 업데이트 배치 실행 시작...")
        self._run_ingredients_update()
    
    def _crawl_blog_posts(self, target_info: dict, platform: str) -> tuple[int, int]:
        """Crawl blog posts."""
        total_posts = 0
        saved_posts = 0
        
        for page in range(1, 101):
            print(f"\n{page} / 100 페이지 수집 중... {round(page / 100 * 100)}% 완료")
            url = f"{target_info['url']}?{target_info['params']}&currentPage={page}"
            self.driver.get(url)
            time.sleep(2)
            
            soup = BeautifulSoup(self.driver.page_source, "html.parser")
            posts = soup.select("div.info_post")
            
            print(f"페이지 {page}에서 {len(posts)}개의 포스트 발견")
            total_posts += len(posts)
            
            for post in posts:
                try:
                    recipe = self._process_blog_post(post, platform)
                    if recipe:
                        self.save_to_database(recipe)
                        saved_posts += 1
                except Exception as e:
                    print(f"Error processing post: {e}")
                    continue
        
        return total_posts, saved_posts
    
    def _crawl_influencer_posts(self) -> Tuple[int, int]:
        """인플루언서 포스트 크롤링"""
        total_posts = 0
        saved_posts = 0
        
        try:
            # 네이버 디스커버 푸드 섹션으로 이동
            self.driver.get("https://in.naver.com/discover/135968760155968")
            time.sleep(3)  # 페이지 로딩 대기
            
            # "지금 핫한 푸드 토픽" 섹션 찾기
            topic_section = WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.XPATH, "//h2[contains(text(), '지금 핫한 푸드 토픽')]"))
            )
            self.logger.info("지금 핫한 푸드 토픽 섹션을 찾았습니다.")
            
            # 토픽 카드들 찾기
            topic_cards = WebDriverWait(self.driver, 10).until(
                EC.presence_of_all_elements_located((By.CSS_SELECTOR, "a[href*='/topic/']"))
            )
            self.logger.info(f"총 {len(topic_cards)}개의 토픽 카드를 찾았습니다.")
            
            # 각 토픽 카드 처리
            for card in topic_cards:
                try:
                    # 매번 새로운 요소 참조 가져오기
                    card = WebDriverWait(self.driver, 10).until(
                        EC.element_to_be_clickable((By.CSS_SELECTOR, "a[href*='/topic/']"))
                    )
                    
                    topic_url = card.get_attribute('href')
                    self.logger.info(f"토픽 처리 중: {topic_url}")
                    
                    # 새 탭에서 토픽 페이지 열기
                    self.driver.execute_script("window.open('');")
                    self.driver.switch_to.window(self.driver.window_handles[-1])
                    self.driver.get(topic_url)
                    time.sleep(3)
                    
                    # 포스트 카드들 찾기
                    post_cards = WebDriverWait(self.driver, 10).until(
                        EC.presence_of_all_elements_located((By.CSS_SELECTOR, "a[href*='/blog/']"))
                    )
                    
                    for post_card in post_cards:
                        try:
                            # 매번 새로운 요소 참조 가져오기
                            post_card = WebDriverWait(self.driver, 10).until(
                                EC.element_to_be_clickable((By.CSS_SELECTOR, "a[href*='/blog/']"))
                            )
                            
                            post_url = post_card.get_attribute('href')
                            self.logger.info(f"블로그 포스트 처리 중: {post_url}")
                            
                            # 새 탭에서 포스트 열기
                            self.driver.execute_script("window.open('');")
                            self.driver.switch_to.window(self.driver.window_handles[-1])
                            self.driver.get(post_url)
                            time.sleep(3)
                            
                            # 포스트 데이터 추출
                            post_data = self._extract_post_data()
                            if post_data:
                                post_data['platform'] = 'naver(인플루언서핫토픽)'  # 플랫폼 값 설정
                                total_posts += 1
                                
                                # 데이터베이스에 저장
                                if self.cursor.execute("""
                                    INSERT IGNORE INTO recipes
                                    (title, link, content, author, thumbnail, platform, likes, comments, post_time, collected_at)
                                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                                """, (
                                    post_data['title'], post_data['link'], post_data['content'], post_data['author'],
                                    post_data['thumbnail'], post_data['platform'], post_data['likes'], post_data['comments'],
                                    post_data['post_time'], datetime.now()
                                )):
                                    saved_posts += 1
                                    self.logger.info("✅ 저장 완료")
                            
                            # 포스트 탭 닫기
                            self.driver.close()
                            self.driver.switch_to.window(self.driver.window_handles[-2])
                            
                        except Exception as e:
                            self.logger.error(f"블로그 포스트 처리 중 오류 발생: {str(e)}")
                            continue
                    
                    # 토픽 탭 닫기
                    self.driver.close()
                    self.driver.switch_to.window(self.driver.window_handles[0])
                    
                except Exception as e:
                    self.logger.error(f"토픽 카드 처리 중 오류 발생: {str(e)}")
                    continue
            
        except Exception as e:
            self.logger.error(f"인플루언서 크롤링 중 오류 발생: {str(e)}")
        
        return total_posts, saved_posts
    
    def _process_blog_post(self, post, platform: str) -> Recipe:
        """Process a single blog post and return Recipe object."""
        title_tag = post.select_one("strong.title_post")
        if not title_tag:
            print("제목 태그를 찾을 수 없음")
            return None
        
        title = title_tag.get_text(strip=True)
        if not self.filter_by_keywords(title):
            print(f"키워드 불일치: {title}")
            return None
        
        link_tag = post.select_one("a.desc_inner")
        link = link_tag["href"] if link_tag else ""
        if not link:
            print("링크를 찾을 수 없음")
            return None
        
        print(f"\n포스트 처리 중: {title}")
        print(f"링크: {link}")
        
        # Get post content
        self.driver.get(link)
        time.sleep(2)
        
        # Switch to iframe
        try:
            iframe = WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.ID, "mainFrame"))
            )
            self.driver.switch_to.frame(iframe)
        except Exception as e:
            print(f"iframe 전환 실패: {e}")
            return None
        
        # Get content
        content = self._get_post_content()
        
        # Get metadata
        author = self._get_author()
        thumbnail = self._get_thumbnail()
        likes = self._get_likes()
        comments = self._get_comments()
        post_time = self._get_post_time()
        
        # Switch back to default content
        self.driver.switch_to.default_content()
        
        # Create Recipe object
        return Recipe(
            title=title,
            content=content,
            author=author,
            thumbnail=thumbnail,
            likes=likes,
            comments=comments,
            post_time=post_time,
            platform=platform,
            used_ingredients=self.extract_ingredients(content),
            link=link
        )
    
    def _get_post_content(self) -> str:
        """Get post content."""
        content = ""
        try:
            # Try new editor format
            post_view = WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.CLASS_NAME, "se-main-container"))
            )
            paragraphs = post_view.find_elements(By.CLASS_NAME, "se-text-paragraph")
            content = "\n".join([p.text for p in paragraphs if p.text.strip()])
            
            # Try old editor format
            if not content:
                post_view = self.driver.find_element(By.CLASS_NAME, "post-view")
                paragraphs = post_view.find_elements(By.TAG_NAME, "p")
                content = "\n".join([p.text for p in paragraphs if p.text.strip()])
        except Exception as e:
            print(f"본문 가져오기 실패: {e}")
        return content
    
    def _get_author(self) -> str:
        """Get post author."""
        try:
            author_tag = self.driver.find_element(By.CSS_SELECTOR, "span.nick a")
            return author_tag.text
        except:
            return ""
    
    def _get_thumbnail(self) -> str:
        """Get post thumbnail."""
        try:
            # Try new editor format
            img_tags = self.driver.find_elements(By.CSS_SELECTOR, ".se-image-resource")
            if img_tags:
                return img_tags[0].get_attribute("src")
            
            # Try old editor format
            img_tags = self.driver.find_elements(By.CSS_SELECTOR, ".post-view img")
            if img_tags:
                return img_tags[0].get_attribute("src")
        except Exception as e:
            print(f"썸네일 가져오기 실패: {e}")
        return ""
    
    def _get_likes(self) -> int:
        """Get post likes count."""
        try:
            sympathy_area = self.driver.find_element(By.CLASS_NAME, "area_sympathy")
            em_tags = sympathy_area.find_elements(By.TAG_NAME, "em")
            for em in em_tags:
                if em.get_attribute("class") == "u_cnt _count":
                    likes_text = em.text.strip()
                    if likes_text:
                        return int(likes_text.replace(",", ""))
        except Exception as e:
            print(f"공감수 가져오기 실패: {e}")
        return 0
    
    def _get_comments(self) -> int:
        """Get post comments count."""
        try:
            comment_element = self.driver.find_element(By.ID, "commentCount")
            comments_text = comment_element.text.strip()
            if comments_text:
                return int(comments_text.replace(",", ""))
        except Exception as e:
            print(f"댓글수 가져오기 실패: {e}")
        return 0
    
    def _get_post_time(self) -> str:
        """Get post time."""
        try:
            # 우선순위 1: span.se_publishDate (실제 게시 시간)
            try:
                time_element = self.driver.find_element(By.CSS_SELECTOR, "span.se_publishDate")
                time_text = time_element.text.strip()
                if time_text:
                    post_time = self.convert_post_time(time_text)
                    if post_time:
                        print(f"게시일 찾음 (se_publishDate): {time_text} -> {post_time}")
                        return post_time
            except:
                pass
            
            # 우선순위 2: span.date 중에서 yyyy. mm. dd. 형식인 것
            try:
                date_elements = self.driver.find_elements(By.CSS_SELECTOR, "span.date")
                for element in date_elements:
                    time_text = element.text.strip()
                    # yyyy. mm. dd. 형식인지 확인
                    if re.match(r'\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\.', time_text):
                        post_time = self.convert_post_time(time_text)
                        if post_time:
                            print(f"게시일 찾음 (date): {time_text} -> {post_time}")
                            return post_time
            except:
                pass
                
            # 우선순위 3: 기타 셀렉터들
            fallback_selectors = [
                "div.blog2_postdate span",
                "div.post_date"
            ]
            
            for selector in fallback_selectors:
                try:
                    time_element = self.driver.find_element(By.CSS_SELECTOR, selector)
                    time_text = time_element.text.strip()
                    if time_text:
                        post_time = self.convert_post_time(time_text)
                        if post_time:
                            print(f"게시일 찾음 ({selector}): {time_text} -> {post_time}")
                            return post_time
                except:
                    continue
                    
        except Exception as e:
            print(f"❌ 작성일 가져오기 실패: {e}")
        
        print("❌ 작성일을 찾을 수 없음")
        return None
    
    def _get_title(self) -> str:
        """Get post title."""
        try:
            title_element = self.driver.find_element(By.CSS_SELECTOR, "h3.se-title-text")
            return title_element.text.strip()
        except:
            try:
                title_element = self.driver.find_element(By.CSS_SELECTOR, "h2.se-title-text")
                return title_element.text.strip()
            except:
                return ""
    
    def save_to_database(self, recipe: Recipe):
        """Save recipe to database."""
        if not recipe.title or not recipe.link:
            print("❌ 저장 실패: 필수 데이터 누락")
            return
        
        insert_query = """
        INSERT IGNORE INTO recipes
        (title, link, content, used_ingredients, used_ingredients_block, block_reason, 
         author, thumbnail, platform, likes, comments, post_time, collected_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        # used_ingredients가 리스트인 경우 콤마로 구분된 문자열로 변환
        used_ingredients_str = None
        if recipe.used_ingredients:
            if isinstance(recipe.used_ingredients, list):
                used_ingredients_str = ','.join(recipe.used_ingredients)
            else:
                used_ingredients_str = recipe.used_ingredients
        
        # post_time이 None이면 현재 날짜로 설정
        post_time_to_save = recipe.post_time if recipe.post_time else datetime.now().strftime("%Y-%m-%d")
        
        self.cursor.execute(insert_query, (
            recipe.title, recipe.link, recipe.content, 
            used_ingredients_str, recipe.used_ingredients_block, recipe.block_reason,
            recipe.author, recipe.thumbnail, recipe.platform, 
            recipe.likes, recipe.comments, post_time_to_save, datetime.now()
        ))
        
        if recipe.post_time:
            print(f"✅ 저장 완료 - 게시일: {recipe.post_time}")
        else:
            print(f"⚠️ 저장 완료 - 게시일 없음 (현재 날짜로 대체: {post_time_to_save})")
        self.cursor.connection.commit()
    
    def _run_ingredients_update(self):
        """Run the ingredients update batch script after crawling is complete."""
        try:
            print("\n🔄 재료 정보 업데이트 배치 실행 중...")
            batch_script = os.path.join(os.path.dirname(os.path.dirname(__file__)), 
                                      "ingredient_management", 
                                      "update_used_ingredients_batch.py")
            
            if os.path.exists(batch_script):
                os.system(f"python {batch_script}")
                print("✅ 재료 정보 업데이트 완료!")
            else:
                print(f"❌ 배치 스크립트를 찾을 수 없습니다: {batch_script}")
        except Exception as e:
            print(f"❌ 재료 정보 업데이트 중 오류 발생: {str(e)}")

    def _process_blog_post_from_blog_page(self, link):
        try:
            # 네이버 블로그는 종종 iframe(mainFrame) 안에 본문이 있음
            try:
                iframe = WebDriverWait(self.driver, 10).until(
                    EC.presence_of_element_located((By.ID, "mainFrame"))
                )
                self.driver.switch_to.frame(iframe)
            except Exception as e:
                print(f"iframe 전환 실패: {e}")
                return None

            soup = BeautifulSoup(self.driver.page_source, "html.parser")

            # 제목
            title = ""
            title_element = soup.select_one('div.se-module.se-module-text.se-title-text')
            if title_element:
                title_span = title_element.select_one('span')
                title = title_span.get_text(strip=True) if title_span else title_element.get_text(strip=True)

            # 작성자 - 수정된 부분
            author = ""
            author_element = soup.select_one('span.nick a')
            if not author_element:
                author_element = soup.select_one('strong.ell')
            if author_element:
                author = author_element.get_text(strip=True)

            # 본문
            content = ""
            content_container = soup.select_one('div.se-main-container')
            if content_container:
                content = content_container.get_text(separator='\n', strip=True)

            # --- 재료 정보 필터링 추가 ---
            used_ingredients_block, block_reason = extract_best_ingredient_block(content)
            if not used_ingredients_block or len(used_ingredients_block.strip()) < 10:
                print(f"❌ 재료 정보가 없어 저장하지 않음: {link}")
                self.driver.switch_to.default_content()
                return None
            used_ingredients = extract_ingredients(used_ingredients_block)
            
            # 추출된 재료 개수 체크 (3개 이하이면 저장하지 않음)
            if not used_ingredients or len(used_ingredients) <= 3:
                print(f"❌ 추출된 재료가 3개 이하여서 저장하지 않음: {link} (재료: {used_ingredients})")
                self.driver.switch_to.default_content()
                return None
            # ---

            # 썸네일
            thumbnail = ""
            if content_container:
                img_element = content_container.select_one('img.se-image-resource')
                if img_element:
                    thumbnail = img_element.get('src', '')

            # 좋아요
            likes = 0
            sympathy_area = soup.select_one('div.area_sympathy')
            if sympathy_area:
                em_tags = sympathy_area.select('em.u_cnt._count')
                for em in em_tags:
                    likes_text = em.get_text(strip=True)
                    if likes_text:
                        likes = int(likes_text.replace(',', ''))
                        break

            # 댓글
            comments = 0
            comments_element = soup.select_one('div.area_comment em#commentCount._commentCount')
            if comments_element:
                comments_text = comments_element.get_text(strip=True)
                comments = int(comments_text.replace(',', '')) if comments_text.isdigit() else 0

            # 작성일 - 수정된 셀렉터 사용
            post_time = ""
            # 우선순위 1: span.se_publishDate (실제 게시 시간)
            date_element = soup.select_one('span.se_publishDate')
            if date_element and date_element.get_text(strip=True):
                post_time_text = date_element.get_text(strip=True)
                post_time = self.convert_post_time(post_time_text)
                print(f"게시일 찾음 (se_publishDate): {post_time_text} -> {post_time}")
            
            # 우선순위 2: span.date 중에서 yyyy. mm. dd. 형식인 것
            if not post_time:
                date_elements = soup.select('span.date')
                for element in date_elements:
                    date_text = element.get_text(strip=True)
                    # yyyy. mm. dd. 형식인지 확인
                    if re.match(r'\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\.', date_text):
                        post_time = self.convert_post_time(date_text)
                        print(f"게시일 찾음 (date): {date_text} -> {post_time}")
                        break

            self.driver.switch_to.default_content()

            return Recipe(
                title=title,
                content=content,
                author=author,
                thumbnail=thumbnail,
                likes=likes,
                comments=comments,
                post_time=post_time,
                platform="naver(주제별보기)",
                link=link,
                used_ingredients=used_ingredients,
                used_ingredients_block=used_ingredients_block,
                block_reason=block_reason
            )
        except Exception as e:
            print(f"블로그글 데이터 추출 실패: {e}")
            return None

def delete_low_ingredient_entries(self):
    connection = pymysql.connect(
        host=os.getenv('DB_HOST') or os.getenv('MYSQLHOST') or os.getenv('MYSQL_HOST'),
        user=os.getenv('DB_USER') or os.getenv('MYSQLUSER') or os.getenv('MYSQL_USER'),
        password=os.getenv('DB_PASSWORD') or os.getenv('MYSQLPASSWORD') or os.getenv('MYSQL_PASSWORD'),
        db=os.getenv('DB_NAME') or os.getenv('MYSQLDATABASE') or os.getenv('MYSQL_DATABASE') or 'railway',
        port=int(os.getenv('DB_PORT') or os.getenv('MYSQLPORT') or os.getenv('MYSQL_PORT') or 3306),
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

if __name__ == "__main__":
    crawler = NaverBlogCrawler()
    crawler.crawl()
    crawler.delete_low_ingredient_entries() 