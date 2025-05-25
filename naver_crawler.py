import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import StaleElementReferenceException, TimeoutException
import pandas as pd
import re
import json
import os
import sys

class NaverCrawler:
    def __init__(self):
        """크롤러 초기화"""
        print("[초기화] 크롤러 시작...")
        # Chrome 옵션 설정
        chrome_options = Options()
        chrome_options.add_argument('--headless')  # 헤드리스 모드
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        
        # WebDriver 초기화
        print("[초기화] Chrome 드라이버 시작...")
        self.driver = webdriver.Chrome(options=chrome_options)
        self.wait = WebDriverWait(self.driver, 10)
        
        # 데이터 저장 경로 설정
        self.data_dir = "data"
        if not os.path.exists(self.data_dir):
            os.makedirs(self.data_dir)
        print("[초기화] 완료!")

    def wait_for_element(self, by, value, timeout=10):
        """요소가 나타날 때까지 대기"""
        try:
            element = WebDriverWait(self.driver, timeout).until(
                EC.presence_of_element_located((by, value))
            )
            return element
        except TimeoutException:
            return None

    def crawl_naver_influencer_discover(self):
        """네이버 인플루언서 디스커버 섹션의 푸드 토픽을 크롤링"""
        try:
            print("\n[인플루언서] 디스커버 페이지 접속 중...")
            discover_url = "https://in.naver.com/discover/135968760155968"
            self.driver.get(discover_url)
            time.sleep(3)

            print("[인플루언서] 페이지 스크롤 중...")
            last_height = self.driver.execute_script("return document.body.scrollHeight")
            for i in range(8):
                print(f"[인플루언서] 스크롤 {i+1}/8 진행 중...")
                self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                time.sleep(2)
                new_height = self.driver.execute_script("return document.body.scrollHeight")
                if new_height == last_height:
                    break
                last_height = new_height

            print("[인플루언서] 토픽 카드 찾는 중...")
            topic_title = self.wait_for_element(By.XPATH, "//strong[contains(text(), '지금 핫한 푸드 토픽')]")
            if not topic_title:
                print("[인플루언서] 토픽 타이틀을 찾을 수 없습니다.")
                return

            topic_section = topic_title.find_element(By.XPATH, "../../..")
            card_area = topic_section.find_element(By.CSS_SELECTOR, "div.CollectionTopic__root___OXVxW")
            print("[인플루언서] 카드 링크 수집 중...")
            
            # 카드 링크 수집
            card_links = []
            topic_cards = card_area.find_elements(By.CSS_SELECTOR, "div.CollectionTopicCard__root___rv6dQ")
            for card in topic_cards:
                try:
                    link = card.find_element(By.CSS_SELECTOR, "a").get_attribute("href")
                    if link:
                        card_links.append(link)
                except:
                    continue

            print(f"[인플루언서] {len(card_links)}개의 카드 링크 수집 완료")
            
            # 각 카드 처리
            for i, link in enumerate(card_links):
                try:
                    print(f"\n[인플루언서] {i+1}번째 카드 처리 중...")
                    print(f"[인플루언서] {i+1}번째 카드 상세 페이지 접속 중...")
                    self.driver.get(link)
                    time.sleep(3)

                    # "블로그에서 더보기" 링크 찾기
                    blog_link = self.wait_for_element(By.CSS_SELECTOR, "a.TopicContent__link___HTKpK")
                    if not blog_link:
                        print(f"[인플루언서] {i+1}번째 카드에서 블로그 링크를 찾을 수 없습니다.")
                        continue

                    blog_url = blog_link.get_attribute("href")
                    if not blog_url:
                        print(f"[인플루언서] {i+1}번째 카드의 블로그 URL이 없습니다.")
                        continue

                    # 블로그 URL에서 blog_id와 log_no 추출
                    match = re.search(r'blog\.naver\.com/([^/]+)/(\d+)', blog_url)
                    if not match:
                        print(f"[인플루언서] {i+1}번째 카드의 블로그 URL 파싱 실패: {blog_url}")
                        continue

                    blog_id = match.group(1)
                    log_no = match.group(2)
                    print(f"[인플루언서] {i+1}번째 카드의 블로그 크롤링 시작 (ID: {blog_id}, LogNo: {log_no})")
                    self.crawl_naver_blog(blog_id, log_no, platform="naver(인플루언서핫토픽)")

                except Exception as e:
                    print(f"[인플루언서] {i+1}번째 카드 처리 실패: {e}")
                    continue

        except Exception as e:
            print(f"[인플루언서] 크롤링 중 오류 발생: {str(e)}")

    def crawl_naver_blog_search(self):
        """네이버 블로그 검색 결과에서 레시피 크롤링 (링크 파싱 안전성 보강)"""
        try:
            print("\n[블로그] 검색 페이지 접속 중...")
            url = "https://section.blog.naver.com/Search/Post.naver?pageNo=1&rangeType=ALL&orderBy=sim&keyword=%EC%9A%94%EB%A6%AC%20%EB%A0%88%EC%8B%9C%ED%94%BC"
            self.driver.get(url)
            time.sleep(3)

            print("[블로그] 검색 결과 로딩 중...")
            # 검색 결과가 로드될 때까지 대기
            posts = self.wait_for_element(By.CSS_SELECTOR, "a.link")
            if not posts:
                print("[블로그] 검색 결과를 찾을 수 없습니다.")
                return

            posts = self.driver.find_elements(By.CSS_SELECTOR, "a.link")
            num_posts = len(posts)
            print(f"[블로그] {num_posts}개의 포스트 발견")
            
            for i in range(num_posts):
                try:
                    print(f"\n[블로그] {i+1}번째 포스트 처리 중...")
                    # 매번 요소를 재조회하여 stale 상태 방지
                    posts = self.driver.find_elements(By.CSS_SELECTOR, "a.link")
                    if i >= len(posts):
                        break

                    post = posts[i]
                    href = post.get_attribute("href")
                    if not href or "blog.naver.com" not in href:
                        print(f"[블로그] {i+1}번째 포스트의 링크가 유효하지 않습니다.")
                        continue

                    # URL에서 blog_id와 log_no 추출
                    match = re.search(r'blog\.naver\.com/([^/]+)/(\d+)', href)
                    if not match:
                        print(f"[블로그] {i+1}번째 포스트의 링크 파싱 실패: {href}")
                        continue

                    blog_id = match.group(1)
                    log_no = match.group(2)
                    print(f"[블로그] {i+1}번째 포스트 크롤링 시작 (ID: {blog_id}, LogNo: {log_no})")
                    self.crawl_naver_blog(blog_id, log_no, platform="naver(주제별보기)")

                except StaleElementReferenceException:
                    print(f"[블로그] {i+1}번째 포스트가 stale 상태입니다. 다음 포스트로 진행합니다.")
                    continue
                except Exception as e:
                    print(f"[블로그] {i+1}번째 포스트 처리 실패: {e}")
                    continue

        except Exception as e:
            print(f"[블로그] 크롤링 중 오류 발생: {str(e)}")

    def crawl_naver_blog(self, blog_id, log_no, platform="naver(주제별보기)"):
        """네이버 블로그 포스트 크롤링 (iframe 유무 모두 대응)"""
        try:
            print(f"\n[블로그 글] {blog_id}/{log_no} 크롤링 시작...")
            url = f"https://blog.naver.com/{blog_id}/{log_no}"
            self.driver.get(url)
            time.sleep(3)

            title = None
            content = None

            # iframe(mainFrame) 존재 시 전환, 없으면 바로 시도
            try:
                print("[블로그 글] iframe 확인 중...")
                iframe = self.wait_for_element(By.ID, "mainFrame")
                if iframe:
                    print("[블로그 글] iframe으로 전환")
                    self.driver.switch_to.frame(iframe)
                    time.sleep(1)
            except Exception:
                print("[블로그 글] iframe 없음, 기본 프레임 사용")
                pass

            # 제목 및 본문 추출 (iframe 내부/외부 모두 대응)
            try:
                print("[블로그 글] 제목 추출 중...")
                title_element = self.wait_for_element(By.CSS_SELECTOR, "h3.se-text, h2.pcol1, .se-title-text")
                title = title_element.text if title_element else ""
                print(f"[블로그 글] 제목: {title}")
            except Exception:
                title = ""
                print("[블로그 글] 제목 추출 실패")

            try:
                print("[블로그 글] 본문 추출 중...")
                content_element = self.wait_for_element(By.CSS_SELECTOR, "div.se-main-container, #postViewArea, .se_component_wrap.sect_dsc__content")
                content = content_element.text if content_element else ""
                print("[블로그 글] 본문 추출 완료")
            except Exception:
                content = ""
                print("[블로그 글] 본문 추출 실패")

            recipe_data = {
                "title": title,
                "content": content,
                "url": url,
                "blog_id": blog_id,
                "log_no": log_no,
                "platform": platform,
                "crawled_at": pd.Timestamp.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            self.save_recipe_data(recipe_data)

        except Exception as e:
            print(f"[블로그 글] 크롤링 중 오류 발생: {str(e)}")

    def save_recipe_data(self, recipe_data):
        """레시피 데이터 저장"""
        try:
            # JSON 파일로 저장
            filename = f"recipe_{recipe_data['blog_id']}_{recipe_data['log_no']}.json"
            filepath = os.path.join(self.data_dir, filename)
            
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(recipe_data, f, ensure_ascii=False, indent=2)
                
            print(f"[저장] 레시피 데이터 저장 완료: {filename}")
            
        except Exception as e:
            print(f"[저장] 레시피 데이터 저장 실패: {str(e)}")

    def crawl_all_sources(self):
        """모든 소스에서 레시피 크롤링"""
        try:
            print("\n=== 크롤링 시작 ===")
            # 기존 소스 크롤링
            self.crawl_naver_blog_search()
            
            # 인플루언서 디스커버 섹션 크롤링 추가
            self.crawl_naver_influencer_discover()
            
            print("\n=== 크롤링 완료 ===")
        except Exception as e:
            print(f"[오류] 크롤링 중 오류 발생: {str(e)}")
        finally:
            print("\n[종료] 크롤러 종료")
            self.driver.quit()

if __name__ == "__main__":
    crawler = NaverCrawler()
    crawler.crawl_all_sources() 