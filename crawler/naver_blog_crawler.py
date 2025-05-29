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
        driver_path = "C:/Users/user/Desktop/RefrigeratorCode/chromedriver-win64/chromedriver.exe"
        options = Options()
        # options.add_argument("--headless")  # 창이 뜨도록 headless 옵션 제거
        options.add_argument("--disable-gpu")
        options.add_argument("--window-size=1920x1080")
        service = Service(driver_path)
        self.driver = webdriver.Chrome(service=service, options=options)
    
    def _setup_database(self):
        """Setup database connection."""
        self.db = pymysql.connect(**DB_CONFIG, cursorclass=pymysql.cursors.DictCursor)
        self.cursor = self.db.cursor()
    
    def convert_post_time(self, time_text: str) -> str:
        """Convert post time text to datetime string."""
        now = datetime.now()
        try:
            time_text = re.sub(r'\s+\d+:\d+', '', time_text)
            
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
            print(f"시간 변환 오류: {time_text} - {str(e)}")
            return None
    
    def crawl(self):
        """Main crawling method."""
        total_posts = 0
        saved_posts = 0

        for page in range(1, 101):
            url = f"https://section.blog.naver.com/ThemePost.naver?directoryNo=20&activeDirectorySeq=2&currentPage={page}"
            self.driver.get(url)
            WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.CLASS_NAME, "info_post"))
            )
            soup = BeautifulSoup(self.driver.page_source, "html.parser")
            posts = soup.select("div.info_post")
            print(f"페이지 {page}에서 {len(posts)}개의 포스트 발견")
            total_posts += len(posts)
            for post in posts:
                link_tag = post.select_one("a.desc_inner")
                link = link_tag["href"] if link_tag else ""
                if not link:
                    continue
                print(f"블로그 원문 접근: {link}")
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
        print("\n✅ 크롤링 및 MySQL 저장 완료!")
        print(f"총 처리된 포스트: {total_posts}")
        print(f"총 저장된 포스트: {saved_posts}")
        self.driver.quit()
        self.db.close()
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
                                if self.db.save_post(post_data):
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
            time_selectors = [
                "span.se_publishDate",
                "span.date",
                "div.blog2_postdate span",
                "div.post_date"
            ]
            
            for selector in time_selectors:
                try:
                    time_element = self.driver.find_element(By.CSS_SELECTOR, selector)
                    time_text = time_element.text.strip()
                    if time_text:
                        post_time = self.convert_post_time(time_text)
                        if post_time:
                            return post_time
                except:
                    continue
        except Exception as e:
            print(f"작성일 가져오기 실패: {e}")
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
        (title, link, content, author, thumbnail, platform, likes, comments, post_time, collected_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        self.cursor.execute(insert_query, (
            recipe.title, recipe.link, recipe.content, recipe.author,
            recipe.thumbnail, recipe.platform, recipe.likes, recipe.comments,
            recipe.post_time, datetime.now()
        ))
        self.db.commit()
        print("✅ 저장 완료")
    
    def _run_ingredients_update(self):
        """Run the ingredients update batch script after crawling is complete."""
        try:
            print("\n🔄 재료 정보 업데이트 배치 실행 중...")
            batch_script = os.path.join(os.path.dirname(os.path.dirname(__file__)), 
                                      "ingredient-management", 
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

            # 작성일
            post_time = ""
            date_element = soup.select_one('p.blog_date')
            if date_element:
                post_time = date_element.get_text(strip=True)

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

if __name__ == "__main__":
    crawler = NaverBlogCrawler()
    crawler.crawl() 