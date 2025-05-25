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

from common.base_crawler import BaseCrawler
from common.data_models import Recipe
from common.constants import DB_CONFIG, NAVER_TARGETS, PLATFORM_NAVER

class NaverCrawler(BaseCrawler):
    def __init__(self):
        super().__init__()
        self.platform = PLATFORM_NAVER
        self._setup_driver()
        self._setup_database()
    
    def _setup_driver(self):
        """Setup Selenium WebDriver."""
        driver_path = "C:/Users/user/Desktop/RefrigeratorCode/chromedriver-win64/chromedriver.exe"
        options = Options()
        options.add_argument("--headless")
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
        
        # Crawl both blog and influencer content
        for target_name, target_info in NAVER_TARGETS.items():
            print(f"\nCrawling {target_name} content...")
            if target_name == 'blog':
                total, saved = self._crawl_blog_posts(target_info)
            else:
                total, saved = self._crawl_influencer_posts(target_info)
            
            total_posts += total
            saved_posts += saved
        
        print("\n✅ 크롤링 및 MySQL 저장 완료!")
        print(f"총 처리된 포스트: {total_posts}")
        print(f"총 저장된 포스트: {saved_posts}")
        
        # Cleanup
        self.driver.quit()
        self.db.close()
        
        # Run ingredients update batch
        self._run_ingredients_update()
    
    def _crawl_blog_posts(self, target_info: dict) -> tuple[int, int]:
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
                    recipe = self._process_blog_post(post)
                    if recipe:
                        self.save_to_database(recipe)
                        saved_posts += 1
                except Exception as e:
                    print(f"Error processing post: {e}")
                    continue
        
        return total_posts, saved_posts
    
    def _crawl_influencer_posts(self, target_info: dict) -> tuple[int, int]:
        """Crawl influencer posts."""
        # TODO: Implement influencer post crawling
        return 0, 0
    
    def _process_blog_post(self, post) -> Recipe:
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
            platform=self.platform,
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

if __name__ == "__main__":
    crawler = NaverCrawler()
    crawler.crawl() 