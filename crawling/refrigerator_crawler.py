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

# 셀레니움 드라이버 설정
driver_path = "C:/Users/user/Desktop/RefrigeratorCode/chromedriver-win64/chromedriver.exe"
options = Options()
options.add_argument("--headless")
options.add_argument("--disable-gpu")
options.add_argument("--window-size=1920x1080")
service = Service(driver_path)
driver = webdriver.Chrome(service=service, options=options)

# pymysql로 MySQL 연결 설정
db = pymysql.connect(
    host='localhost',
    user='root',
    password='sk784512!!',
    db='refrigerator',
    charset='utf8mb4',
    cursorclass=pymysql.cursors.DictCursor
)
cursor = db.cursor()

insert_query = """
INSERT IGNORE INTO recipes
(title, link, content, author, thumbnail, platform, likes, comments, post_time, collected_at)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
"""

# 키워드 필터
KEYWORDS = ["레시피", "만드는", "만들기", "요리", "끓이", "하는법"]

def contains_keyword(title):
    return any(kw in title for kw in KEYWORDS)

# 시간 텍스트 변환 함수
def convert_post_time(time_text):
    now = datetime.now()
    try:
        # 시간 정보 제거 (예: "2025. 5. 23. 18:11" -> "2025. 5. 23.")
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

# 본문 수집
total_posts = 0
saved_posts = 0

for page in range(1, 101):
    print(f"\n{page} / 100 페이지 수집 중... {round(page / 100 * 100)}% 완료")
    url = f"https://section.blog.naver.com/ThemePost.naver?directoryNo=20&activeDirectorySeq=2&currentPage={page}"
    driver.get(url)
    time.sleep(2)
    soup = BeautifulSoup(driver.page_source, "html.parser")
    posts = soup.select("div.info_post")
    
    print(f"페이지 {page}에서 {len(posts)}개의 포스트 발견")
    total_posts += len(posts)

    for post in posts:
        try:
            title_tag = post.select_one("strong.title_post")
            if not title_tag:
                print("제목 태그를 찾을 수 없음")
                continue
            title = title_tag.get_text(strip=True)
            if not contains_keyword(title):
                print(f"키워드 불일치: {title}")
                continue

            link_tag = post.select_one("a.desc_inner")
            link = link_tag["href"] if link_tag else ""
            if not link:
                print("링크를 찾을 수 없음")
                continue

            print(f"\n포스트 처리 중: {title}")
            print(f"링크: {link}")

            # 블로그 본문으로 이동
            driver.get(link)
            time.sleep(2)

            # iframe으로 전환
            try:
                iframe = WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located((By.ID, "mainFrame"))
                )
                driver.switch_to.frame(iframe)
            except Exception as e:
                print(f"iframe 전환 실패: {e}")
                continue

            # 본문 가져오기
            content = ""
            try:
                # 새로운 에디터 형식 (se-main-container)
                post_view = WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located((By.CLASS_NAME, "se-main-container"))
                )
                paragraphs = post_view.find_elements(By.CLASS_NAME, "se-text-paragraph")
                content = "\n".join([p.text for p in paragraphs if p.text.strip()])
                
                # 이전 에디터 형식 (post-view)
                if not content:
                    post_view = driver.find_element(By.CLASS_NAME, "post-view")
                    paragraphs = post_view.find_elements(By.TAG_NAME, "p")
                    content = "\n".join([p.text for p in paragraphs if p.text.strip()])
            except Exception as e:
                print(f"본문 가져오기 실패: {e}")
            print(f"본문 길이: {len(content)} 글자")

            # 작성자 가져오기
            author = ""
            try:
                author_tag = driver.find_element(By.CSS_SELECTOR, "span.nick a")
                author = author_tag.text
            except:
                pass
            print(f"작성자: {author}")

            # 썸네일 가져오기
            thumbnail = ""
            try:
                # 새로운 에디터 형식의 이미지
                img_tags = driver.find_elements(By.CSS_SELECTOR, ".se-image-resource")
                if img_tags:
                    thumbnail = img_tags[0].get_attribute("src")
                else:
                    # 이전 에디터 형식의 이미지
                    img_tags = driver.find_elements(By.CSS_SELECTOR, ".post-view img")
                    if img_tags:
                        thumbnail = img_tags[0].get_attribute("src")
            except Exception as e:
                print(f"썸네일 가져오기 실패: {e}")
            print(f"썸네일: {thumbnail[:50]}..." if thumbnail else "썸네일 없음")

            # 공감수 가져오기
            likes = 0
            try:
                # 공감 버튼 영역 찾기
                sympathy_area = driver.find_element(By.CLASS_NAME, "area_sympathy")
                # 공감 버튼 내의 모든 em 태그 찾기
                em_tags = sympathy_area.find_elements(By.TAG_NAME, "em")
                for em in em_tags:
                    if em.get_attribute("class") == "u_cnt _count":
                        likes_text = em.text.strip()
                        if likes_text:
                            likes = int(likes_text.replace(",", ""))
                            break
            except Exception as e:
                print(f"공감수 가져오기 실패: {e}")
            print(f"공감수: {likes}")

            # 댓글수 가져오기
            comments = 0
            try:
                comment_element = driver.find_element(By.ID, "commentCount")
                comments_text = comment_element.text.strip()
                if comments_text:
                    comments = int(comments_text.replace(",", ""))
            except Exception as e:
                print(f"댓글수 가져오기 실패: {e}")
            print(f"댓글수: {comments}")

            # 작성일 가져오기
            post_time = None
            try:
                time_selectors = [
                    "span.se_publishDate",
                    "span.date",
                    "div.blog2_postdate span",
                    "div.post_date"
                ]
                
                for selector in time_selectors:
                    try:
                        time_element = driver.find_element(By.CSS_SELECTOR, selector)
                        time_text = time_element.text.strip()
                        if time_text:
                            post_time = convert_post_time(time_text)
                            if post_time:
                                break
                    except:
                        continue
            except Exception as e:
                print(f"작성일 가져오기 실패: {e}")
            print(f"작성일: {post_time}")

            # 기본 프레임으로 돌아가기
            driver.switch_to.default_content()

            # MySQL에 저장
            if title and link:  # 제목과 링크만 있으면 저장
                cursor.execute(insert_query, (
                    title, link, content, author, thumbnail, "naver",
                    likes, comments, post_time, datetime.now()
                ))
                db.commit()
                saved_posts += 1
                print("✅ 저장 완료")
            else:
                print("❌ 저장 실패: 필수 데이터 누락")

        except Exception as e:
            print(f"Error processing post: {e}")
            continue

    print(f"\n현재까지 처리된 포스트: {total_posts}")
    print(f"저장된 포스트: {saved_posts}")

print("\n✅ 크롤링 및 MySQL 저장 완료!")
print(f"총 처리된 포스트: {total_posts}")
print(f"총 저장된 포스트: {saved_posts}")

# 연결 종료
driver.quit()
db.close() 