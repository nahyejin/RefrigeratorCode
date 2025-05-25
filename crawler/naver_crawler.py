import time
import random
import logging
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException, WebDriverException
from database import Database
from utils import setup_logger

class NaverCrawler:
    def __init__(self):
        self.logger = setup_logger('naver_crawler')
        self.db = Database()
        self.driver = None
        self.is_running = False
        
    def setup_driver(self):
        """셀레니움 드라이버 설정"""
        try:
            options = webdriver.ChromeOptions()
            options.add_argument('--headless')
            options.add_argument('--no-sandbox')
            options.add_argument('--disable-dev-shm-usage')
            options.add_argument('--disable-gpu')
            options.add_argument('--window-size=1920,1080')
            options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
            self.driver = webdriver.Chrome(options=options)
            self.driver.implicitly_wait(20)
            self.logger.info("드라이버 설정 완료")
        except Exception as e:
            self.logger.error(f"드라이버 설정 실패: {str(e)}")
            raise

    def stop_crawling(self):
        """크롤링 중단"""
        self.is_running = False
        if self.driver:
            self.driver.quit()
        self.logger.info("크롤링이 중단되었습니다.")

    def handle_error(self, error, message):
        """오류 처리 및 크롤링 중단"""
        self.logger.error(f"{message}: {str(error)}")
        self.stop_crawling()
        raise error

    def wait_for_element(self, by, value, timeout=20):
        """요소 대기"""
        try:
            element = WebDriverWait(self.driver, timeout).until(
                EC.presence_of_element_located((by, value))
            )
            return element
        except TimeoutException:
            self.logger.error(f"요소를 찾을 수 없습니다: {value}")
            raise

    def crawl_discover_posts(self, max_pages=5):
        """네이버 디스커버 음식 섹션의 게시물 크롤링"""
        if self.is_running:
            self.logger.warning("이미 크롤링이 실행 중입니다.")
            return

        try:
            self.is_running = True
            self.setup_driver()
            self.logger.info("네이버 디스커버 크롤링 시작")
            
            # 네이버 모바일 검색 URL
            url = "https://m.search.naver.com/search.naver?where=m&sm=mtb_jum&query=음식"
            self.driver.get(url)
            time.sleep(5)  # 페이지 로딩 대기
            
            # 블로그 탭 클릭
            try:
                blog_tab = self.wait_for_element(By.CSS_SELECTOR, "a.tab[href*='blog']")
                blog_tab.click()
                time.sleep(3)  # 탭 전환 대기
            except TimeoutException as e:
                self.handle_error(e, "블로그 탭을 찾을 수 없습니다")

            page = 1
            while self.is_running and page <= max_pages:
                try:
                    # 게시물 목록 대기
                    posts = self.wait_for_element(By.CSS_SELECTOR, "ul.lst_total")
                    post_items = posts.find_elements(By.CSS_SELECTOR, "li.bx._svp_item")
                    
                    if not post_items:
                        self.logger.warning("게시물을 찾을 수 없습니다.")
                        break
                    
                    for post in post_items:
                        if not self.is_running:
                            break
                            
                        try:
                            # 게시물 링크 추출
                            link = post.find_element(By.CSS_SELECTOR, "a").get_attribute("href")
                            self.driver.execute_script("window.open(arguments[0]);", link)
                            self.driver.switch_to.window(self.driver.window_handles[-1])
                            time.sleep(2)
                            
                            # 상세 페이지에서 정보 추출
                            try:
                                title = self.driver.find_element(By.CSS_SELECTOR, "span.se-fs-").text
                            except Exception:
                                title = ""
                            try:
                                author = self.driver.find_element(By.CSS_SELECTOR, "div.blog_author strong.ell").text
                            except Exception:
                                author = ""
                            try:
                                post_time = self.driver.find_element(By.CSS_SELECTOR, "p.blog_date").text.split()[0].replace(".", "-")
                            except Exception:
                                post_time = ""
                            try:
                                thumbnail = self.driver.find_element(By.CSS_SELECTOR, "img.se-image-resource").get_attribute("src")
                            except Exception:
                                thumbnail = ""
                            try:
                                content = self.driver.find_element(By.CSS_SELECTOR, "div.se-main-container").text
                            except Exception:
                                content = ""
                            try:
                                likes = int(self.driver.find_element(By.CSS_SELECTOR, "div.u_likeit_list_module em.u_cnt._count").text.replace(",", ""))
                            except Exception:
                                likes = 0
                            try:
                                comments = int(self.driver.find_element(By.CSS_SELECTOR, "a.btn_reply em").text.replace(",", ""))
                            except Exception:
                                comments = 0
                            
                            from datetime import datetime
                            collected_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                            
                            # DB에 저장
                            self.db.save_recipe({
                                'title': title,
                                'link': link,
                                'content': content,
                                'used_ingredients': '',
                                'used_ingredients_block': '',
                                'block_reason': '',
                                'author': author,
                                'thumbnail': thumbnail,
                                'platform': 'naver_discover',
                                'likes': likes,
                                'comments': comments,
                                'post_time': post_time,
                                'collected_at': collected_at
                            })
                            self.logger.info(f"레시피 저장 완료: {title}")
                            self.driver.close()
                            self.driver.switch_to.window(self.driver.window_handles[0])
                            time.sleep(1)
                            
                        except NoSuchElementException as e:
                            self.logger.warning(f"게시물 정보 추출 실패: {str(e)}")
                            continue
                        except Exception as e:
                            self.handle_error(e, "게시물 처리 중 오류 발생")
                    
                    # 다음 페이지로 이동
                    try:
                        next_button = self.driver.find_element(By.CSS_SELECTOR, "a.btn_next")
                        next_button.click()
                        page += 1
                        time.sleep(random.uniform(3, 5))
                    except NoSuchElementException:
                        self.logger.info("마지막 페이지에 도달했습니다.")
                        break
                        
                except TimeoutException as e:
                    self.handle_error(e, "페이지 로딩 시간 초과")
                except Exception as e:
                    self.handle_error(e, "페이지 처리 중 오류 발생")
                    
        except Exception as e:
            self.handle_error(e, "크롤링 중 오류 발생")
        finally:
            if self.driver:
                self.driver.quit()
            self.is_running = False
            self.logger.info("크롤링 종료")

    def crawl_influencer_posts(self, max_pages=5):
        """네이버 인플루언서 음식 관련 게시물 크롤링"""
        if self.is_running:
            self.logger.warning("이미 크롤링이 실행 중입니다.")
            return

        try:
            self.is_running = True
            self.setup_driver()
            self.logger.info("네이버 인플루언서 크롤링 시작")
            
            # 네이버 모바일 검색 URL
            url = "https://m.search.naver.com/search.naver?where=m&sm=mtb_jum&query=음식+인플루언서"
            self.driver.get(url)
            time.sleep(5)  # 페이지 로딩 대기
            
            # 블로그 탭 클릭
            try:
                blog_tab = self.wait_for_element(By.CSS_SELECTOR, "a.tab[href*='blog']")
                blog_tab.click()
                time.sleep(3)  # 탭 전환 대기
            except TimeoutException as e:
                self.handle_error(e, "블로그 탭을 찾을 수 없습니다")

            page = 1
            while self.is_running and page <= max_pages:
                try:
                    # 게시물 목록 대기
                    posts = self.wait_for_element(By.CSS_SELECTOR, "ul.lst_total")
                    post_items = posts.find_elements(By.CSS_SELECTOR, "li.bx._svp_item")
                    
                    if not post_items:
                        self.logger.warning("게시물을 찾을 수 없습니다.")
                        break
                    
                    for post in post_items:
                        if not self.is_running:
                            break
                            
                        try:
                            # 게시물 링크 추출
                            link = post.find_element(By.CSS_SELECTOR, "a").get_attribute("href")
                            self.driver.execute_script("window.open(arguments[0]);", link)
                            self.driver.switch_to.window(self.driver.window_handles[-1])
                            time.sleep(2)
                            
                            # 상세 페이지에서 정보 추출
                            try:
                                title = self.driver.find_element(By.CSS_SELECTOR, "span.se-fs-").text
                            except Exception:
                                title = ""
                            try:
                                author = self.driver.find_element(By.CSS_SELECTOR, "div.blog_author strong.ell").text
                            except Exception:
                                author = ""
                            try:
                                post_time = self.driver.find_element(By.CSS_SELECTOR, "p.blog_date").text.split()[0].replace(".", "-")
                            except Exception:
                                post_time = ""
                            try:
                                thumbnail = self.driver.find_element(By.CSS_SELECTOR, "img.se-image-resource").get_attribute("src")
                            except Exception:
                                thumbnail = ""
                            try:
                                content = self.driver.find_element(By.CSS_SELECTOR, "div.se-main-container").text
                            except Exception:
                                content = ""
                            try:
                                likes = int(self.driver.find_element(By.CSS_SELECTOR, "div.u_likeit_list_module em.u_cnt._count").text.replace(",", ""))
                            except Exception:
                                likes = 0
                            try:
                                comments = int(self.driver.find_element(By.CSS_SELECTOR, "a.btn_reply em").text.replace(",", ""))
                            except Exception:
                                comments = 0
                            
                            from datetime import datetime
                            collected_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                            
                            # DB에 저장
                            self.db.save_recipe({
                                'title': title,
                                'link': link,
                                'content': content,
                                'used_ingredients': '',
                                'used_ingredients_block': '',
                                'block_reason': '',
                                'author': author,
                                'thumbnail': thumbnail,
                                'platform': 'naver_influencer',
                                'likes': likes,
                                'comments': comments,
                                'post_time': post_time,
                                'collected_at': collected_at
                            })
                            self.logger.info(f"레시피 저장 완료: {title}")
                            self.driver.close()
                            self.driver.switch_to.window(self.driver.window_handles[0])
                            time.sleep(1)
                            
                        except NoSuchElementException as e:
                            self.logger.warning(f"게시물 정보 추출 실패: {str(e)}")
                            continue
                        except Exception as e:
                            self.handle_error(e, "게시물 처리 중 오류 발생")
                    
                    # 다음 페이지로 이동
                    try:
                        next_button = self.driver.find_element(By.CSS_SELECTOR, "a.btn_next")
                        next_button.click()
                        page += 1
                        time.sleep(random.uniform(3, 5))
                    except NoSuchElementException:
                        self.logger.info("마지막 페이지에 도달했습니다.")
                        break
                        
                except TimeoutException as e:
                    self.handle_error(e, "페이지 로딩 시간 초과")
                except Exception as e:
                    self.handle_error(e, "페이지 처리 중 오류 발생")
                    
        except Exception as e:
            self.handle_error(e, "크롤링 중 오류 발생")
        finally:
            if self.driver:
                self.driver.quit()
            self.is_running = False
            self.logger.info("크롤링 종료") 