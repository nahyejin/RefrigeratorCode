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
import logging
from crawling.common.constants import RECIPE_KEYWORDS

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

class NaverDiscoverCrawler:
    def __init__(self):
        logger.info("크롤러 초기화 시작")
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
            logger.info("크롤러 초기화 완료")
        except Exception as e:
            logger.error(f"브라우저 초기화 실패: {e}")
            raise

    def safe_find_element(self, by, value, timeout=10):
        try:
            element = WebDriverWait(self.driver, timeout).until(
                EC.presence_of_element_located((by, value))
            )
            return element
        except (TimeoutException, NoSuchElementException) as e:
            logger.warning(f"요소를 찾을 수 없음: {by}={value}, 오류: {str(e)}")
            return None

    def safe_find_elements(self, by, value, timeout=10):
        try:
            elements = WebDriverWait(self.driver, timeout).until(
                EC.presence_of_all_elements_located((by, value))
            )
            return elements
        except (TimeoutException, NoSuchElementException) as e:
            logger.warning(f"요소들을 찾을 수 없음: {by}={value}, 오류: {str(e)}")
            return []

    def scroll_to_load_all_topics(self, max_attempts=20):
        """더보기 버튼을 클릭하여 모든 토픽 카드를 로드"""
        logger.info("토픽 카드 로드 시작...")
        attempt = 0
        
        while attempt < max_attempts:
            try:
                more_button = WebDriverWait(self.driver, 5).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, "button.CollectionTopic__btn_more___dzWOi"))
                )
                
                self.driver.execute_script("arguments[0].scrollIntoView(true);", more_button)
                time.sleep(1)
                
                more_button.click()
                logger.info(f"더보기 버튼 클릭 {attempt + 1}/{max_attempts}")
                time.sleep(2)
                
                attempt += 1
                
            except TimeoutException:
                logger.info("더보기 버튼을 찾을 수 없습니다. 모든 카드가 로드되었거나 페이지 구조가 변경되었습니다.")
                break
            except Exception as e:
                logger.error(f"더보기 버튼 클릭 중 오류 발생: {str(e)}")
                break
        
        topic_links = self.driver.find_elements(By.CSS_SELECTOR, "a.TopicCard__link___HTKpK")
        logger.info(f"총 {len(topic_links)}개의 토픽 카드 링크 발견")
        return [link.get_attribute('href') for link in topic_links]

    def crawl_influencer_posts(self, url):
        try:
            logger.info(f"크롤러 시작: {url}")
            self.driver.get(url)
            time.sleep(5)

            # 1. 무한 스크롤로 모든 토픽 카드 로드
            topic_links = self.scroll_to_load_all_topics()
            logger.info(f"스크롤 완료 후 발견된 토픽 링크 수: {len(topic_links)}")

            # 2. '지금 핫한 푸드 토픽' 영역의 카드 링크 추출
            topic_links = []
            try:
                topic_cards = self.driver.find_elements(By.CSS_SELECTOR, '#TOPIC .CollectionTopicCard__root___rv6dQ a')
                for card in topic_cards:
                    href = card.get_attribute('href')
                    if href and '/topic/' in href:
                        topic_links.append(href)
                topic_links = list(set(topic_links))
                logger.info(f"푸드 토픽 카드 링크 수: {len(topic_links)}")
            except Exception as e:
                logger.error(f"토픽 카드 링크 수집 실패: {e}")
                return

            # 3. 각 토픽 카드 상세 페이지 진입
            for idx, topic_url in enumerate(topic_links, 1):
                try:
                    logger.info(f"[{idx}/{len(topic_links)}] 토픽 페이지 진입: {topic_url}")
                    self.driver.get(topic_url)
                    time.sleep(random.uniform(2, 3))

                    # 4. '블로그에서 더보기' 버튼 모두 찾기
                    logger.info(f"현재 URL: {self.driver.current_url}")
                    logger.info("블로그에서 더보기 버튼들 모두 찾는 중...")
                    blog_btns = []
                    try:
                        buttons = self.driver.find_elements(By.CSS_SELECTOR, 'a.TopicContent__link___HTKpK')
                        for btn in buttons:
                            if '블로그' in btn.text and '더보기' in btn.text:
                                blog_btns.append(btn)
                        logger.info(f"블로그에서 더보기 버튼 {len(blog_btns)}개 발견")
                        if not blog_btns:
                            logger.warning("블로그에서 더보기 버튼을 찾을 수 없음")
                    except Exception as e:
                        logger.error(f"버튼 찾기 실패: {e}")

                    # 각 블로그에서 더보기 버튼을 모두 클릭하여 원문 수집
                    for btn_idx, blog_btn in enumerate(blog_btns, 1):
                        try:
                            logger.info(f"[{btn_idx}/{len(blog_btns)}] 블로그에서 더보기 버튼 클릭 시도...")
                            # 새 창/탭이 열리도록 shift+click (혹은 JS window.open)
                            self.driver.execute_script("window.open(arguments[0].href, '_blank');", blog_btn)
                            time.sleep(2)
                            # 새 창으로 전환
                            self.driver.switch_to.window(self.driver.window_handles[-1])
                            time.sleep(3)
                            current_url = self.driver.current_url
                            if 'blog.naver.com' in current_url:
                                logger.info(f"블로그 페이지로 이동 성공: {current_url}")
                                time.sleep(3)
                                try:
                                    # iframe 전환 시도
                                    try:
                                        iframe = self.safe_find_element(By.ID, "mainFrame", timeout=10)
                                        if iframe:
                                            self.driver.switch_to.frame(iframe)
                                            logger.info("iframe 전환 성공")
                                        else:
                                            logger.warning("iframe(mainFrame) 없음, 기본 프레임에서 시도")
                                    except Exception as e:
                                        logger.error(f"iframe 전환 실패: {e}")

                                    # 제목 수집
                                    title = ''
                                    try:
                                        for selector in ["h3.se-title-text", "h2.se-title-text", "strong.title_post"]:
                                            element = self.safe_find_element(By.CSS_SELECTOR, selector)
                                            if element:
                                                title = element.text.strip()
                                                break
                                        if not title:
                                            title = self.driver.title
                                        logger.info(f"제목 수집 완료: {title}")
                                    except Exception as e:
                                        logger.error(f"제목 수집 실패: {e}")

                                    # 필터 키워드 적용 (제목)
                                    if not any(k in title for k in RECIPE_KEYWORDS):
                                        logger.info(f"필터 키워드 미포함으로 저장하지 않음: {title}")
                                        self.driver.close()
                                        self.driver.switch_to.window(self.driver.window_handles[0])
                                        continue

                                    # 본문 수집
                                    content = ''
                                    try:
                                        post_view = self.safe_find_element(By.CLASS_NAME, "se-main-container", timeout=5)
                                        if post_view:
                                            paragraphs = post_view.find_elements(By.CLASS_NAME, "se-text-paragraph")
                                            content = "\n".join([p.text for p in paragraphs if p.text.strip()])
                                        if not content:
                                            post_view = self.safe_find_element(By.CLASS_NAME, "post-view", timeout=3)
                                            if post_view:
                                                paragraphs = post_view.find_elements(By.TAG_NAME, "p")
                                                content = "\n".join([p.text for p in paragraphs if p.text.strip()])
                                        logger.info(f"본문 내용 수집 완료 (길이: {len(content)})")
                                    except Exception as e:
                                        logger.error(f"본문 수집 실패: {e}")

                                    # 작성자 수집
                                    author = ''
                                    try:
                                        author_tag = self.safe_find_element(By.CSS_SELECTOR, "span.nick a", timeout=3)
                                        if author_tag:
                                            author = author_tag.text
                                        logger.info(f"작성자 수집 완료: {author}")
                                    except Exception as e:
                                        logger.error(f"작성자 수집 실패: {e}")

                                    # 썸네일 수집
                                    thumbnail = ''
                                    try:
                                        img_tags = self.driver.find_elements(By.CSS_SELECTOR, ".se-image-resource")
                                        if img_tags:
                                            thumbnail = img_tags[0].get_attribute("src")
                                        if not thumbnail:
                                            img_tags = self.driver.find_elements(By.CSS_SELECTOR, ".post-view img")
                                            if img_tags:
                                                thumbnail = img_tags[0].get_attribute("src")
                                        logger.info(f"썸네일 수집 완료: {thumbnail}")
                                    except Exception as e:
                                        logger.error(f"썸네일 수집 실패: {e}")

                                    # 좋아요 수집
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
                                        logger.info(f"좋아요 수집 완료: {likes}")
                                    except Exception as e:
                                        logger.error(f"좋아요 수 수집 실패: {e}")

                                    # 댓글 수집
                                    comments = 0
                                    try:
                                        comment_element = self.safe_find_element(By.ID, "commentCount", timeout=3)
                                        if comment_element:
                                            comments_text = comment_element.text.strip()
                                            if comments_text:
                                                comments = int(comments_text.replace(",", ""))
                                        logger.info(f"댓글 수집 완료: {comments}")
                                    except Exception as e:
                                        logger.error(f"댓글 수 수집 실패: {e}")

                                    # 필수값 체크
                                    if not content or not author or not thumbnail:
                                        logger.warning(f"필수값 누락으로 저장하지 않음: title={title}, author={author}, thumbnail={thumbnail}, content_length={len(content)}")
                                        self.driver.close()
                                        self.driver.switch_to.window(self.driver.window_handles[0])
                                        continue

                                    # 데이터베이스 저장
                                    try:
                                        recipe_data = {
                                            'title': title,
                                            'content': content,
                                            'author': author,
                                            'thumbnail': thumbnail,
                                            'likes': likes,
                                            'comments': comments,
                                            'post_time': datetime.now(),
                                            'platform': 'naver(인플루언서핫토픽)',
                                            'link': current_url,
                                            'collected_at': datetime.now(),
                                            'used_ingredients': '',
                                            'used_ingredients_block': '',
                                            'block_reason': ''
                                        }
                                        self.db.save_recipe(recipe_data)
                                        logger.info(f"레시피 데이터 저장 완료: {title}")
                                    except Exception as e:
                                        logger.error(f"데이터베이스 저장 실패: {e}")

                                except Exception as e:
                                    logger.error(f"블로그 글 수집 중 오류 발생: {e}")
                            # 창 닫고 원래 창으로 복귀
                            self.driver.close()
                            self.driver.switch_to.window(self.driver.window_handles[0])
                        except Exception as e:
                            logger.error(f"블로그에서 더보기 버튼 클릭/수집 실패: {e}")
                except Exception as e:
                    logger.error(f"토픽 페이지 처리 중 오류 발생: {e}")
                    continue

        except Exception as e:
            logger.error(f"크롤링 중 오류 발생: {e}")
        finally:
            logger.info("크롤링 종료")
            self.driver.quit()

if __name__ == "__main__":
    crawler = NaverDiscoverCrawler()
    crawler.crawl_influencer_posts("https://in.naver.com/discover/135968760155968") 