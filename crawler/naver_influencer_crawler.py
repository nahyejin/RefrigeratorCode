import time
from selenium.webdriver.common.by import By
from datetime import datetime
from selenium import webdriver
from .database import Database
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, NoSuchElementException, WebDriverException
import random

class NaverDiscoverCrawler:
    def __init__(self):
        self.options = Options()
        # 기본 옵션
        self.options.add_argument('--disable-blink-features=AutomationControlled')
        self.options.add_argument('--disable-infobars')
        self.options.add_argument('--disable-dev-shm-usage')
        self.options.add_argument('--no-sandbox')
        self.options.add_argument('--disable-gpu')
        self.options.add_argument('--window-size=1920,1080')
        
        # 추가 옵션
        self.options.add_argument('--disable-notifications')
        self.options.add_argument('--disable-popup-blocking')
        self.options.add_argument('--disable-extensions')
        self.options.add_argument('--disable-web-security')
        self.options.add_argument('--ignore-certificate-errors')
        self.options.add_argument('--allow-running-insecure-content')
        
        # User-Agent 설정
        self.options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36')
        
        # 페이지 로드 전략
        self.options.page_load_strategy = 'eager'
        
        try:
            self.driver = webdriver.Chrome(options=self.options)
            self.driver.set_page_load_timeout(30)  # 페이지 로드 타임아웃 30초
            self.wait = WebDriverWait(self.driver, 30)
            self.db = Database()
        except Exception as e:
            print(f"브라우저 초기화 실패: {e}")
            raise

    def safe_find_element(self, by, value, timeout=10):
        try:
            element = WebDriverWait(self.driver, timeout).until(
                EC.presence_of_element_located((by, value))
            )
            return element
        except (TimeoutException, NoSuchElementException):
            return None

    def safe_find_elements(self, by, value, timeout=10):
        try:
            elements = WebDriverWait(self.driver, timeout).until(
                EC.presence_of_all_elements_located((by, value))
            )
            return elements
        except (TimeoutException, NoSuchElementException):
            return []

    def scroll_to_load_all_topics(self, max_attempts=20):
        """더보기 버튼을 클릭하여 모든 토픽 카드를 로드"""
        print("토픽 카드 로드 시작...")
        attempt = 0
        
        while attempt < max_attempts:
            try:
                # 더보기 버튼 찾기
                more_button = WebDriverWait(self.driver, 5).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, "button.CollectionTopic__btn_more___dzWOi"))
                )
                
                # 버튼이 보이도록 스크롤
                self.driver.execute_script("arguments[0].scrollIntoView(true);", more_button)
                time.sleep(1)  # 스크롤 애니메이션 대기
                
                # 버튼 클릭
                more_button.click()
                print(f"더보기 버튼 클릭 {attempt + 1}/{max_attempts}")
                time.sleep(2)  # 새로운 카드 로드 대기
                
                attempt += 1
                
            except TimeoutException:
                print("더보기 버튼을 찾을 수 없습니다. 모든 카드가 로드되었거나 페이지 구조가 변경되었습니다.")
                break
            except Exception as e:
                print(f"더보기 버튼 클릭 중 오류 발생: {str(e)}")
                break
        
        # 최종적으로 로드된 토픽 카드 링크 수집
        topic_links = self.driver.find_elements(By.CSS_SELECTOR, "a.TopicCard__link___HTKpK")
        print(f"총 {len(topic_links)}개의 토픽 카드 링크 발견")
        return [link.get_attribute('href') for link in topic_links]

    def crawl_influencer_posts(self, url):
        try:
            print("크롤러 시작")
            self.driver.get(url)
            time.sleep(5)

            # 1. 무한 스크롤로 모든 토픽 카드 로드
            topic_links = self.scroll_to_load_all_topics()

            # 2. '지금 핫한 푸드 토픽' 영역의 카드 링크 추출
            topic_links = []
            try:
                topic_cards = self.driver.find_elements(By.CSS_SELECTOR, '#TOPIC .CollectionTopicCard__root___rv6dQ a')
                for card in topic_cards:
                    href = card.get_attribute('href')
                    if href and '/topic/' in href:
                        topic_links.append(href)
                topic_links = list(set(topic_links))  # 중복 제거
                print(f"총 {len(topic_links)}개의 토픽 카드 링크 발견")
            except Exception as e:
                print(f"토픽 카드 링크 수집 실패: {e}")
                return

            # 3. 각 토픽 카드 상세 페이지 진입
            for topic_url in topic_links:
                try:
                    print(f"토픽 페이지 진입: {topic_url}")
                    self.driver.get(topic_url)
                    time.sleep(random.uniform(2, 3))

                    # 4. '블로그에서 더보기' 버튼 클릭
                    print(f"현재 URL: {self.driver.current_url}")
                    print("블로그에서 더보기 버튼 찾는 중...")
                    
                    # 버튼 찾기 시도
                    blog_btn = None
                    try:
                        # 정확한 클래스와 텍스트로 찾기
                        buttons = self.driver.find_elements(By.CSS_SELECTOR, 'a.TopicContent__link___HTKpK')
                        for btn in buttons:
                            if '블로그' in btn.text and '더보기' in btn.text:
                                blog_btn = btn
                                break
                    except Exception as e:
                        print(f"버튼 찾기 실패: {e}")

                    if blog_btn:
                        try:
                            print("블로그에서 더보기 버튼 발견, 클릭 시도...")
                            # JavaScript로 클릭 시도
                            self.driver.execute_script("arguments[0].click();", blog_btn)
                            time.sleep(random.uniform(3, 4))
                            
                            # 클릭 후 URL 변경 확인
                            current_url = self.driver.current_url
                            if 'blog.naver.com' in current_url:
                                print(f"블로그 페이지로 이동 성공: {current_url}")
                                
                                # 페이지 로딩을 위한 충분한 대기 시간
                                time.sleep(5)
                                
                                # 블로그 글 수집 시작 (기존 네이버 블로그 방식 적용)
                                try:
                                    # iframe 전환 시도
                                    try:
                                        iframe = self.safe_find_element(By.ID, "mainFrame", timeout=10)
                                        if iframe:
                                            self.driver.switch_to.frame(iframe)
                                            print("iframe 전환 성공")
                                        else:
                                            print("iframe(mainFrame) 없음, 기본 프레임에서 시도")
                                    except Exception as e:
                                        print(f"iframe 전환 실패: {e}")

                                    # 제목
                                    title = ''
                                    try:
                                        for selector in ["h3.se-title-text", "h2.se-title-text", "strong.title_post"]:
                                            element = self.safe_find_element(By.CSS_SELECTOR, selector)
                                            if element:
                                                title = element.text.strip()
                                                break
                                        if not title:
                                            title = self.driver.title
                                    except Exception as e:
                                        print(f"제목 수집 실패: {e}")
                                    print(f"제목 수집 완료: {title}")

                                    # 본문
                                    content = ''
                                    try:
                                        # 신에디터
                                        post_view = self.safe_find_element(By.CLASS_NAME, "se-main-container", timeout=5)
                                        if post_view:
                                            paragraphs = post_view.find_elements(By.CLASS_NAME, "se-text-paragraph")
                                            content = "\n".join([p.text for p in paragraphs if p.text.strip()])
                                        # 구에디터
                                        if not content:
                                            post_view = self.safe_find_element(By.CLASS_NAME, "post-view", timeout=3)
                                            if post_view:
                                                paragraphs = post_view.find_elements(By.TAG_NAME, "p")
                                                content = "\n".join([p.text for p in paragraphs if p.text.strip()])
                                    except Exception as e:
                                        print(f"본문 수집 실패: {e}")
                                    print(f"본문 내용 수집 완료 (길이: {len(content)})")

                                    # 작성자
                                    author = ''
                                    try:
                                        author_tag = self.safe_find_element(By.CSS_SELECTOR, "span.nick a", timeout=3)
                                        if author_tag:
                                            author = author_tag.text
                                    except Exception as e:
                                        print(f"작성자 수집 실패: {e}")
                                    print(f"작성자 수집 완료: {author}")

                                    # 썸네일
                                    thumbnail = ''
                                    try:
                                        img_tags = self.driver.find_elements(By.CSS_SELECTOR, ".se-image-resource")
                                        if img_tags:
                                            thumbnail = img_tags[0].get_attribute("src")
                                        if not thumbnail:
                                            img_tags = self.driver.find_elements(By.CSS_SELECTOR, ".post-view img")
                                            if img_tags:
                                                thumbnail = img_tags[0].get_attribute("src")
                                    except Exception as e:
                                        print(f"썸네일 수집 실패: {e}")
                                    print(f"썸네일 수집 완료: {thumbnail}")

                                    # 좋아요
                                    likes = 0
                                    try:
                                        sympathy_area = self.safe_find_element(By.CLASS_NAME, "area_sympathy", timeout=3)
                                        if sympathy_area:
                                            em_tags = sympathy_area.find_elements(By.TAG_NAME, "em")
                                            for em in em_tags:
                                                if em.get_attribute("class") == "u_cnt _count":
                                                    likes_text = em.text.strip()
                                                    if likes_text:
                                                        likes = int(likes_text.replace(",", ""))
                                                        break
                                    except Exception as e:
                                        print(f"좋아요 수 수집 실패: {e}")
                                    print(f"좋아요 수집 완료: {likes}")

                                    # 댓글
                                    comments = 0
                                    try:
                                        comment_element = self.safe_find_element(By.ID, "commentCount", timeout=3)
                                        if comment_element:
                                            comments_text = comment_element.text.strip()
                                            if comments_text:
                                                comments = int(comments_text.replace(",", ""))
                                    except Exception as e:
                                        print(f"댓글 수 수집 실패: {e}")
                                    print(f"댓글 수집 완료: {comments}")

                                    # 작성일
                                    post_time = None
                                    try:
                                        time_selectors = [
                                            "span.se_publishDate",
                                            "span.date",
                                            "div.blog2_postdate span",
                                            "div.post_date"
                                        ]
                                        for selector in time_selectors:
                                            element = self.safe_find_element(By.CSS_SELECTOR, selector, timeout=2)
                                            if element:
                                                date_text = element.text.strip()
                                                if date_text:
                                                    # 날짜 변환 (기존 convert_post_time 참고)
                                                    import re
                                                    from datetime import timedelta
                                                    now = datetime.now()
                                                    try:
                                                        date_text_simple = re.sub(r'\s+\d+:\d+', '', date_text)
                                                        if "시간 전" in date_text_simple:
                                                            hours = int(re.search(r"(\d+)", date_text_simple).group(1))
                                                            post_date = now - timedelta(hours=hours)
                                                        elif "분 전" in date_text_simple:
                                                            minutes = int(re.search(r"(\d+)", date_text_simple).group(1))
                                                            post_date = now - timedelta(minutes=minutes)
                                                        elif "일 전" in date_text_simple:
                                                            days = int(re.search(r"(\d+)", date_text_simple).group(1))
                                                            post_date = now - timedelta(days=days)
                                                        else:
                                                            post_date = datetime.strptime(date_text_simple.strip(), "%Y. %m. %d.")
                                                        post_time = post_date.strftime("%Y-%m-%d")
                                                    except Exception as e:
                                                        print(f"작성일 변환 실패: {e}")
                                                        post_time = date_text
                                                    break
                                    except Exception as e:
                                        print(f"작성일 수집 실패: {e}")
                                    print(f"작성일 수집 완료: {post_time}")

                                    # 프레임 복귀
                                    try:
                                        self.driver.switch_to.default_content()
                                    except:
                                        pass

                                    # 데이터 저장
                                    recipe_data = {
                                        'title': title,
                                        'link': self.driver.current_url,
                                        'content': content,
                                        'used_ingredients': '',
                                        'used_ingredients_block': '',
                                        'block_reason': '',
                                        'author': author,
                                        'thumbnail': thumbnail,
                                        'platform': 'naver(인플루언서핫토픽)',
                                        'likes': likes,
                                        'comments': comments,
                                        'post_time': post_time,
                                        'collected_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                                    }
                                    print("\n=== 수집된 데이터 확인 ===")
                                    for k, v in recipe_data.items():
                                        print(f"{k}: {v}")
                                    print("=======================\n")
                                    try:
                                        self.db.save_recipe(recipe_data)
                                        print(f"블로그 글 저장 완료: {self.driver.current_url}")
                                    except Exception as e:
                                        print(f"데이터베이스 저장 실패: {e}")
                                        print("저장하려던 데이터:")
                                        print(recipe_data)
                                        continue
                                except Exception as e:
                                    print(f"블로그 글 수집 실패: {e}")
                                    continue
                            else:
                                print(f"블로그 페이지로 이동 실패. 현재 URL: {current_url}")
                        except Exception as e:
                            print(f"버튼 클릭 실패: {e}")
                    else:
                        print(f"블로그에서 더보기 버튼을 찾을 수 없거나 유튜브 링크입니다: {topic_url}")
                        continue

                except Exception as e:
                    print(f"토픽 카드 진입 실패: {e}")
                    continue

        except Exception as e:
            print(f"크롤링 중 오류 발생: {e}")
        finally:
            try:
                self.driver.quit()
            except:
                pass

if __name__ == "__main__":
    crawler = NaverDiscoverCrawler()
    crawler.crawl_influencer_posts("https://in.naver.com/discover/135968760155968") 