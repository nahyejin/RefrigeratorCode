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
import subprocess
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By
from webdriver_manager.chrome import ChromeDriverManager

# Windows에서 Chrome 창을 숨기기 위한 모듈
try:
    import ctypes
    from ctypes import wintypes
    WINDOWS = True
except ImportError:
    WINDOWS = False

def hide_chrome_windows(driver=None):
    """Windows에서 Selenium으로 생성된 Chrome 창만 숨기는 함수"""
    if not WINDOWS:
        return 0
    
    try:
        # Windows API 상수
        SW_HIDE = 0
        
        # Windows API 함수 로드
        user32 = ctypes.windll.user32
        
        # Selenium Chrome 창의 특정 속성들
        selenium_indicators = [
            'data:,',  # Selenium이 자주 사용하는 data: URL
            'chrome driver',  # ChromeDriver 관련
            'automation',  # 자동화 관련
            '--test-type',  # 테스트 모드
            '--disable-blink-features=automationcontrolled',  # 자동화 제어
        ]
        
        def enum_windows_callback(hwnd, windows):
            """창 열거 콜백 함수"""
            if user32.IsWindowVisible(hwnd):
                window_text = ctypes.create_unicode_buffer(512)
                user32.GetWindowTextW(hwnd, window_text, 512)
                class_name = ctypes.create_unicode_buffer(256)
                user32.GetClassNameW(hwnd, class_name, 256)
                
                text = window_text.value.lower()
                class_name_str = class_name.value.lower()
                
                # Chrome 창인지 확인
                is_chrome = class_name_str.startswith('chrome') or 'chrome' in class_name_str
                
                if not is_chrome:
                    return True  # Chrome 창이 아니면 건너뛰기
                
                # 제외할 창들 (CMD, PowerShell, 일반 Chrome 등)
                exclude_keywords = ['cmd', 'powershell', 'command', 'terminal', 'console', 'python']
                is_excluded = any(exclude in text or exclude in class_name_str for exclude in exclude_keywords)
                
                if is_excluded:
                    return True  # 제외 목록에 있으면 건너뛰기
                
                # Selenium으로 생성된 Chrome 창인지 확인 (더 엄격한 조건)
                # 일반 Chrome은 보통 탭 제목이나 URL을 가지고 있지만, Selenium Chrome은 특정 패턴을 가짐
                is_selenium_chrome = any(indicator in text for indicator in selenium_indicators)
                
                # 또는 창 제목이 비어있거나 특정 패턴을 가지는 경우 (Selenium Chrome의 특징)
                if not text.strip() or len(text.strip()) < 3:
                    # 제목이 거의 없는 경우는 Selenium Chrome일 가능성이 높음
                    is_selenium_chrome = True
                
                # ChromeDriver 관련 클래스명
                if 'chromedriver' in class_name_str or 'automation' in class_name_str:
                    is_selenium_chrome = True
                
                if is_selenium_chrome:
                    # Selenium Chrome 창만 숨기기
                    user32.ShowWindow(hwnd, SW_HIDE)
                    windows.append(hwnd)
            return True
        
        # 콜백 함수 타입 정의
        EnumWindowsProc = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.POINTER(ctypes.c_int), 
                                            ctypes.POINTER(ctypes.c_int))
        
        windows_list = []
        callback = EnumWindowsProc(lambda hwnd, lParam: enum_windows_callback(hwnd, windows_list))
        user32.EnumWindows(callback, 0)
        
        return len(windows_list)
    except Exception as e:
        logger.warning(f"⚠️ Chrome 창 숨기기 실패: {e}")
        return 0

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
        self._hide_window_thread = None
        self._driver = None

        # DNS 설정
        self._setup_dns()
        
        # DB 연결 설정 (환경변수 우선)
        self.db_config = {
            'host': os.getenv('DB_HOST') or os.getenv('MYSQLHOST') or os.getenv('MYSQL_HOST') or 'caboose.proxy.rlwy.net',
            'user': os.getenv('DB_USER') or os.getenv('MYSQLUSER') or os.getenv('MYSQL_USER') or 'root',
            'password': os.getenv('DB_PASSWORD') or os.getenv('MYSQLPASSWORD') or os.getenv('MYSQL_PASSWORD') or 'HkqYFCoKPPPxgryxiEbUYxcYynQXxeRF',
            'db': os.getenv('DB_NAME') or os.getenv('MYSQLDATABASE') or os.getenv('MYSQL_DATABASE') or 'railway',
            'port': int(os.getenv('DB_PORT') or os.getenv('MYSQLPORT') or os.getenv('MYSQL_PORT') or 47779),
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
        # 중복 체크 추가
        conn = self._connect_db()
        if not conn:
            return
        
        try:
            with conn.cursor() as cursor:
                # 먼저 중복 확인
                check_query = "SELECT id FROM recipes WHERE link = %s LIMIT 1"
                cursor.execute(check_query, (data['link'],))
                existing = cursor.fetchone()
                
                if existing:
                    logger.info(f"⏭️ 중복 데이터 건너뛰기: {data['link']}")
                    return
        if not data:
            return

        # 추출된 데이터 로그로 출력
        logger.info(f"Saving to DB: {json.dumps(data, ensure_ascii=False)}")

        conn = self._connect_db()
        if not conn:
            return

                sql = """
                INSERT INTO recipes (
                    title, link, content, used_ingredients, used_ingredients_block, block_reason,
                    author, thumbnail, platform, likes, comments, post_time, collected_at
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
                """
                cursor.execute(sql, (
                    data['title'],
                    data['link'],
                    data['content'],
                    data.get('used_ingredients'),
                    data.get('used_ingredients_block'),
                    data.get('block_reason'),
                    data['author'],
                    data['thumbnail'],
                    data['platform'],
                    data['likes'],
                    data['comments'],
                    data['post_time'],
                    data['collected_at']
                ))
            conn.commit()
            logger.info(f"✅ 저장 완료: {data['title']}")
        except pymysql.err.OperationalError as e:
            error_msg = str(e).lower()
            if "table 'recipes' is full" in error_msg:
                logger.warning(f"⚠️ 테이블 용량 부족 - 저장 건너뛰기: {data['link']}")
            elif "duplicate entry" in error_msg or "1062" in str(e):
                logger.info(f"⏭️ 중복 데이터 건너뛰기 (DB 제약조건): {data['link']}")
            else:
                logger.error(f"⚠️ 데이터베이스 오류 (계속 진행): {e}")
        except Exception as e:
            logger.error(f"❌ 저장 실패: {str(e)}")
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
                
                # "더보기" 버튼 클릭 로직 추가
                import shutil
                import subprocess
                import re
                max_retries = 3
                driver = None
                
                # Chrome 버전 확인 (타임아웃 증가 및 에러 무시)
                chrome_version = None
                chrome_full_version = None
                try:
                    chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
                    if os.path.exists(chrome_path):
                        # 방법 1: wmic을 사용하여 파일 버전 정보 가져오기 (Chrome이 실행 중이어도 작동)
                        try:
                            result = subprocess.run(
                                ['wmic', 'datafile', 'where', f'name="{chrome_path.replace(chr(92), chr(92)+chr(92))}"', 'get', 'Version'],
                                capture_output=True,
                                text=True,
                                timeout=10,
                                shell=False
                            )
                            if result.returncode == 0 and result.stdout:
                                version_match = re.search(r'(\d+)\.(\d+)\.(\d+)\.(\d+)', result.stdout)
                                if version_match:
                                    chrome_full_version = version_match.group(0)
                                    chrome_version = version_match.group(1)
                                    logger.info(f"🔍 Chrome 버전 감지 (wmic): {chrome_full_version} (메이저: {chrome_version})")
                        except Exception as wmic_error:
                            logger.debug(f"wmic 방법 실패: {wmic_error}")
                        
                        # 방법 2: --version 명령어 시도 (Chrome이 실행 중이 아닐 때만 작동)
                        if not chrome_version:
                            try:
                                result = subprocess.run(
                                    [chrome_path, "--version"],
                                    capture_output=True,
                                    text=True,
                                    timeout=5,
                                    shell=False
                                )
                                output = result.stdout if result.stdout else result.stderr
                                if output and "기존 브라우저 세션" not in output:
                                    version_match = re.search(r'(\d+)\.(\d+)\.(\d+)\.(\d+)', output)
                                    if version_match:
                                        chrome_version = version_match.group(1)
                                        chrome_full_version = version_match.group(0)
                                        logger.info(f"🔍 Chrome 버전 감지 (--version): {chrome_full_version} (메이저: {chrome_version})")
                            except Exception as version_error:
                                logger.debug(f"--version 방법 실패: {version_error}")
                        
                        # 방법 3: Chrome 버전 파일에서 읽기
                        if not chrome_version:
                            try:
                                version_file = os.path.join(os.path.dirname(chrome_path), "..", "Last Version")
                                if os.path.exists(version_file):
                                    with open(version_file, 'r') as f:
                                        version_text = f.read().strip()
                                        version_match = re.search(r'(\d+)\.(\d+)\.(\d+)\.(\d+)', version_text)
                                        if version_match:
                                            chrome_full_version = version_match.group(0)
                                            chrome_version = version_match.group(1)
                                            logger.info(f"🔍 Chrome 버전 감지 (파일): {chrome_full_version} (메이저: {chrome_version})")
                            except Exception as file_error:
                                logger.debug(f"파일 읽기 방법 실패: {file_error}")
                except Exception as e:
                    logger.warning(f"⚠️ Chrome 버전 확인 실패: {e}")
                    # 버전 확인 실패해도 계속 진행
                
                for attempt in range(max_retries):
                    try:
                        # webdriver_manager 최신 버전 사용
                        # webdriver-manager 4.0+ 버전은 자동으로 Chrome 버전을 감지하고 맞는 ChromeDriver를 다운로드합니다
                        logger.info(f"🔍 Chrome 버전 정보: 메이저={chrome_version}, 전체={chrome_full_version}")
                        if chrome_version and int(chrome_version) >= 115:
                            logger.info(f"🔧 Chrome {chrome_version} 감지 - ChromeDriverManager가 자동으로 맞는 버전을 다운로드합니다")
                        else:
                            logger.warning(f"⚠️ Chrome 버전 감지 실패 또는 구버전 - 기본 ChromeDriverManager 사용")
                        # webdriver-manager가 자동으로 Chrome 버전을 감지하고 맞는 ChromeDriver를 다운로드
                        driver_manager = ChromeDriverManager()
                        
                        # 캐시 삭제 후 재시도 (첫 번째 시도가 아닌 경우)
                        if attempt > 0:
                            cache_dir = os.path.join(os.path.expanduser("~"), ".wdm")
                            if os.path.exists(cache_dir):
                                try:
                                    shutil.rmtree(cache_dir)
                                    logger.info("ChromeDriver 캐시 삭제 후 재시도...")
                                    time.sleep(2)  # 잠시 대기
                                except:
                                    pass
                        
                        # headless 옵션 추가 (Windows에서 강제 headless - 창이 절대 뜨지 않도록)
                        chrome_options = webdriver.ChromeOptions()
                        # 최신 Chrome에서는 --headless=new가 더 안정적
                        # headless 옵션 설정 (창이 절대 뜨지 않도록 강제)
                        chrome_options.add_argument('--headless')
                        chrome_options.add_argument('--disable-gpu')
                        # remote-debugging-port를 명시적으로 설정 (고정 포트 사용)
                        chrome_options.add_argument('--remote-debugging-port=9223')
                        chrome_options.add_argument('--disable-background-timer-throttling')
                        chrome_options.add_argument('--disable-backgrounding-occluded-windows')
                        chrome_options.add_argument('--disable-renderer-backgrounding')
                        
                        chrome_options.add_argument('--no-sandbox')
                        chrome_options.add_argument('--disable-dev-shm-usage')
                        chrome_options.add_argument('--disable-gpu')
                        chrome_options.add_argument('--disable-software-rasterizer')
                        chrome_options.add_argument('--window-size=1920x1080')
                        chrome_options.add_argument('--disable-extensions')
                        chrome_options.add_argument('--disable-plugins')
                        chrome_options.add_argument('--disable-logging')
                        chrome_options.add_argument('--log-level=3')
                        chrome_options.add_argument('--disable-infobars')
                        chrome_options.add_argument('--disable-notifications')
                        chrome_options.add_argument('--disable-blink-features=AutomationControlled')
                        chrome_options.add_argument('--disable-background-timer-throttling')
                        chrome_options.add_argument('--disable-backgrounding-occluded-windows')
                        chrome_options.add_argument('--disable-renderer-backgrounding')
                        # Windows에서 창이 뜨지 않도록 추가 옵션
                        chrome_options.add_argument('--disable-setuid-sandbox')
                        chrome_options.add_argument('--no-first-run')
                        chrome_options.add_argument('--no-default-browser-check')
                        chrome_options.add_argument('--disable-default-apps')
                        # 백그라운드 실행 강제
                        if sys.platform == 'win32':
                            chrome_options.add_argument('--disable-background-networking')
                            chrome_options.add_argument('--disable-sync')
                        # 최소한의 옵션만 사용하여 안정성 향상
                        # 디버깅 포트는 제거 (0으로 설정하면 문제 발생 가능)
                        chrome_options.add_experimental_option('excludeSwitches', ['enable-logging', 'enable-automation'])
                        chrome_options.add_experimental_option('useAutomationExtension', False)
                        chrome_options.add_experimental_option("detach", False)
                        
                        # Chrome 실행 파일 경로 명시 (Windows)
                        chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
                        if os.path.exists(chrome_path):
                            chrome_options.binary_location = chrome_path
                        
                        # 환경 변수 설정
                        os.environ['CHROME_NO_SANDBOX'] = '1'
                        os.environ['CHROME_HEADLESS'] = '1'
                        
                        # Windows에서 CREATE_NO_WINDOW 플래그를 사용하기 위해 커스텀 Service 클래스 사용
                        if sys.platform == 'win32':
                            from selenium.webdriver.chrome.service import Service as ChromeService
                            
                            class NoWindowService(ChromeService):
                                def __init__(self, executable_path, **kwargs):
                                    super().__init__(executable_path, **kwargs)
                                    # Windows에서 창이 뜨지 않도록 설정
                                    if sys.platform == 'win32':
                                        self.service_args = []
                                
                                def start(self):
                                    """Windows에서 CREATE_NO_WINDOW 플래그로 subprocess 시작"""
                                    import subprocess
                                    if sys.platform == 'win32' and hasattr(subprocess, 'CREATE_NO_WINDOW'):
                                        # 원본 start 메서드의 subprocess.Popen 호출을 가로채기
                                        original_popen = subprocess.Popen
                                        def patched_popen(*args, **kwargs):
                                            if 'creationflags' not in kwargs:
                                                kwargs['creationflags'] = subprocess.CREATE_NO_WINDOW
                                            return original_popen(*args, **kwargs)
                                        
                                        # start 메서드 실행 중에만 패치 적용
                                        subprocess.Popen = patched_popen
                                        try:
                                            os.environ['CHROME_HEADLESS'] = '1'
                                            super().start()
                                        finally:
                                            # 패치 복원
                                            subprocess.Popen = original_popen
                                    else:
                                        super().start()
                            
                            service = NoWindowService(
                                driver_manager.install(),
                                log_output=os.devnull
                            )
                        else:
                            service = Service(
                                driver_manager.install(),
                                log_output=os.devnull
                            )
                        
                        logger.info("🔄 ChromeDriver 초기화 중...")
                        try:
                            driver = webdriver.Chrome(service=service, options=chrome_options)  # Chrome 드라이버 초기화
                            self._driver = driver  # 인스턴스 변수에 저장
                            
                            # Windows에서 드라이버 생성 직후 즉시 모든 Chrome 창 숨기기
                            if sys.platform == 'win32':
                                time.sleep(0.1)
                                for _ in range(10):  # 10번 반복하여 확실히 숨기기
                                    hide_chrome_windows(driver)
                                    time.sleep(0.05)
                            
                            logger.info("✅ ChromeDriver 인스턴스 생성 완료")
                        except Exception as init_error:
                            logger.error(f"❌ ChromeDriver 초기화 실패: {init_error}")
                            raise
                        
                        # Chrome이 완전히 시작될 때까지 대기 (타임아웃 설정)
                        logger.info("⏳ Chrome 시작 대기 중...")
                        try:
                            # 간단한 명령으로 Chrome이 응답하는지 확인 (타임아웃 5초)
                            driver.set_page_load_timeout(5)
                            driver.implicitly_wait(2)
                            # capabilities 확인 (빠른 확인)
                            capabilities = driver.capabilities
                            if capabilities:
                                logger.info(f"✅ Chrome 세션 확인 완료 (버전: {capabilities.get('browserVersion', 'unknown')})")
                            else:
                                logger.warning("⚠️ Chrome capabilities 확인 실패 (계속 진행)")
                        except Exception as test_error:
                            logger.warning(f"⚠️ Chrome 세션 확인 실패 (계속 진행): {test_error}")
                            # 확인 실패해도 계속 진행
                        
                        # Windows에서 Selenium Chrome 창만 숨기기 (강화)
                        if WINDOWS:
                            # 즉시 여러 번 실행 (창이 뜨는 것을 방지)
                            for _ in range(20):  # 20번 반복하여 확실히 숨기기
                                time.sleep(0.02)  # 창이 생성될 시간 대기
                                hidden_count = hide_chrome_windows(driver)
                                if hidden_count > 0:
                                    logger.info(f"✅ {hidden_count}개의 Selenium Chrome 창을 숨겼습니다")
                            
                            # 주기적으로 Selenium Chrome 창만 숨기는 스레드 시작 (더 빠르게)
                            import threading
                            def periodic_hide():
                                while hasattr(self, '_driver') and self._driver:
                                    try:
                                        hide_chrome_windows(self._driver)
                                        time.sleep(0.02)  # 0.02초마다 체크 (더 빠르게)
                                    except:
                                        break
                            
                            self._hide_window_thread = threading.Thread(target=periodic_hide, daemon=True)
                            self._hide_window_thread.start()
                        
                        logger.info("✅ ChromeDriver 초기화 성공 (headless 모드)")
                        break
                    except Exception as e:
                        error_msg = str(e)
                        logger.warning(f"⚠️ ChromeDriver 초기화 실패 (시도 {attempt + 1}/{max_retries}): {error_msg}")
                        
                        if "version" in error_msg.lower() or "supports Chrome version" in error_msg:
                            cache_dir = os.path.join(os.path.expanduser("~"), ".wdm")
                            if os.path.exists(cache_dir) and attempt < max_retries - 1:
                                try:
                                    shutil.rmtree(cache_dir)
                                    logger.info("ChromeDriver 캐시 삭제 후 재시도...")
                                    time.sleep(2)  # 잠시 대기
                                except:
                                    pass
                                continue
                        if attempt == max_retries - 1:
                            logger.error(f"ChromeDriver 초기화 실패: {e}")
                            logger.error("💡 해결 방법:")
                            logger.error("   1. webdriver-manager를 최신 버전으로 업데이트: pip install --upgrade webdriver-manager")
                            logger.error("   2. Chrome이 너무 최신 버전(142)일 수 있습니다. Chrome을 재시작하거나")
                            logger.error("   3. 수동으로 ChromeDriver를 다운로드하여 설치하세요")
                            raise
                
                if driver is None:
                    raise Exception("ChromeDriver 초기화 실패")
                try:
                    driver.get(blog_real_url)
                    time.sleep(3)  # 페이지 로드 대기
                    
                    # "더보기" 버튼 최대 20번 클릭
                    for _ in range(20):
                        try:
                            more_button = WebDriverWait(driver, 2).until(
                                EC.presence_of_element_located((By.CSS_SELECTOR, "a.btn_more"))
                            )
                            if more_button and more_button.is_displayed():
                                more_button.click()
                                time.sleep(0.5)
                            else:
                                break
                        except:
                            break
                    
                    # 확장된 본문 가져오기
                    soup = BeautifulSoup(driver.page_source, 'html.parser')
                finally:
                    driver.quit()
            
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
                # 좋아요 수 추출 - 수정된 부분
                sympathy_area = soup.select_one('div.area_sympathy')
                if sympathy_area:
                    like_count = sympathy_area.select_one('em.u_cnt._count')
                    if like_count:
                        likes_text = like_count.get_text(strip=True)
                        likes = int(likes_text.replace(',', '')) if likes_text.isdigit() else 0
                        logger.info(f"[LIKES FOUND] {current_url} - {likes}")
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
            
            # 추출된 재료 개수 체크 (3개 이하이면 저장하지 않음)
            if not used_ingredients or len(used_ingredients) <= 3:
                logger.info(f"[SKIP FEW INGREDIENTS] 추출된 재료가 3개 이하인 포스트: {current_url} (재료: {used_ingredients})")
                return {}
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

    def _click_more_button(self, driver):
        """더보기 버튼을 20번 클릭"""
        for i in range(20):
            try:
                # 더보기 버튼 찾기
                more_button = WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, "button.CollectionTopic__btn_more___dzWOi"))
                )
                # 버튼 클릭
                more_button.click()
                logger.info(f"Clicked '더보기' button {i+1}/20 times")
                # 로딩 대기
                time.sleep(2)
            except Exception as e:
                logger.error(f"Error clicking '더보기' button: {str(e)}")
                break

    def crawl(self) -> List[Dict]:
        """크롤링 실행"""
        all_recipes = []
        
        # Selenium 웹드라이버 초기화 (headless 모드)
        import os
        options = webdriver.ChromeOptions()
        
        # Windows에서 headless 모드 강제 적용 (창이 절대 뜨지 않도록)
        # --headless=new 대신 일반 --headless 사용 (호환성 문제 해결)
        options.add_argument('--headless')
        # remote-debugging-port를 명시적으로 설정 (고정 포트 사용)
        options.add_argument('--remote-debugging-port=9222')
        
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--disable-gpu')
        options.add_argument('--disable-software-rasterizer')
        options.add_argument('--window-size=1920x1080')
        options.add_argument('--disable-extensions')
        options.add_argument('--disable-plugins')
        options.add_argument('--disable-logging')
        options.add_argument('--log-level=3')
        options.add_argument('--disable-infobars')
        options.add_argument('--disable-notifications')
        options.add_argument('--disable-blink-features=AutomationControlled')
        options.add_argument('--disable-background-timer-throttling')
        options.add_argument('--disable-backgrounding-occluded-windows')
        options.add_argument('--disable-renderer-backgrounding')
        # Windows에서 창이 뜨지 않도록 추가 옵션
        options.add_argument('--disable-setuid-sandbox')
        options.add_argument('--no-first-run')
        options.add_argument('--no-default-browser-check')
        options.add_argument('--disable-default-apps')
        # 백그라운드 실행 강제
        if sys.platform == 'win32':
            options.add_argument('--disable-background-networking')
            options.add_argument('--disable-sync')
        # 최소한의 옵션만 사용하여 안정성 향상
        # 디버깅 포트는 제거 (0으로 설정하면 문제 발생 가능)
        options.add_experimental_option('excludeSwitches', ['enable-logging', 'enable-automation'])
        options.add_experimental_option('useAutomationExtension', False)
        options.add_experimental_option("detach", False)
        
        # Chrome 실행 파일 경로 명시 (Windows)
        chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
        if os.path.exists(chrome_path):
            options.binary_location = chrome_path
        
        # 환경 변수로 headless 강제
        os.environ['CHROME_NO_SANDBOX'] = '1'
        os.environ['CHROME_HEADLESS'] = '1'
        
        # ChromeDriver 자동 다운로드 및 초기화 (재시도 로직 포함)
        import shutil
        import subprocess
        import re
        max_retries = 3
        driver = None
        
        # Chrome 버전 확인 (타임아웃 증가 및 에러 무시)
        chrome_version = None
        chrome_full_version = None
        try:
            chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
            if os.path.exists(chrome_path):
                # 방법 1: wmic을 사용하여 파일 버전 정보 가져오기 (Chrome이 실행 중이어도 작동)
                try:
                    result = subprocess.run(
                        ['wmic', 'datafile', 'where', f'name="{chrome_path.replace(chr(92), chr(92)+chr(92))}"', 'get', 'Version'],
                        capture_output=True,
                        text=True,
                        timeout=10,
                        shell=False
                    )
                    if result.returncode == 0 and result.stdout:
                        version_match = re.search(r'(\d+)\.(\d+)\.(\d+)\.(\d+)', result.stdout)
                        if version_match:
                            chrome_full_version = version_match.group(0)
                            chrome_version = version_match.group(1)
                            logger.info(f"🔍 Chrome 버전 감지 (wmic): {chrome_full_version} (메이저: {chrome_version})")
                except Exception as wmic_error:
                    logger.debug(f"wmic 방법 실패: {wmic_error}")
                
                # 방법 2: --version 명령어 시도 (Chrome이 실행 중이 아닐 때만 작동)
                if not chrome_version:
                    try:
                        result = subprocess.run(
                            [chrome_path, "--version"],
                            capture_output=True,
                            text=True,
                            timeout=5,
                            shell=False
                        )
                        output = result.stdout if result.stdout else result.stderr
                        if output and "기존 브라우저 세션" not in output:
                            version_match = re.search(r'(\d+)\.(\d+)\.(\d+)\.(\d+)', output)
                            if version_match:
                                chrome_version = version_match.group(1)
                                chrome_full_version = version_match.group(0)
                                logger.info(f"🔍 Chrome 버전 감지 (--version): {chrome_full_version} (메이저: {chrome_version})")
                    except Exception as version_error:
                        logger.debug(f"--version 방법 실패: {version_error}")
                
                # 방법 3: Chrome 버전 파일에서 읽기
                if not chrome_version:
                    try:
                        version_file = os.path.join(os.path.dirname(chrome_path), "..", "Last Version")
                        if os.path.exists(version_file):
                            with open(version_file, 'r') as f:
                                version_text = f.read().strip()
                                version_match = re.search(r'(\d+)\.(\d+)\.(\d+)\.(\d+)', version_text)
                                if version_match:
                                    chrome_full_version = version_match.group(0)
                                    chrome_version = version_match.group(1)
                                    logger.info(f"🔍 Chrome 버전 감지 (파일): {chrome_full_version} (메이저: {chrome_version})")
                    except Exception as file_error:
                        logger.debug(f"파일 읽기 방법 실패: {file_error}")
        except Exception as e:
            logger.warning(f"⚠️ Chrome 버전 확인 실패: {e}")
            # 버전 확인 실패해도 계속 진행
        
        for attempt in range(max_retries):
            try:
                # webdriver_manager 최신 버전 사용
                # webdriver-manager 4.0+ 버전은 자동으로 Chrome 버전을 감지하고 맞는 ChromeDriver를 다운로드합니다
                logger.info(f"🔍 Chrome 버전 정보: 메이저={chrome_version}, 전체={chrome_full_version}")
                if chrome_version and int(chrome_version) >= 115:
                    logger.info(f"🔧 Chrome {chrome_version} 감지 - ChromeDriverManager가 자동으로 맞는 버전을 다운로드합니다")
                else:
                    logger.warning(f"⚠️ Chrome 버전 감지 실패 또는 구버전 - 기본 ChromeDriverManager 사용")
                # webdriver-manager가 자동으로 Chrome 버전을 감지하고 맞는 ChromeDriver를 다운로드
                driver_manager = ChromeDriverManager()
                
                # 캐시 삭제 후 재시도 (첫 번째 시도가 아닌 경우)
                if attempt > 0:
                    cache_dir = os.path.join(os.path.expanduser("~"), ".wdm")
                    if os.path.exists(cache_dir):
                        try:
                            shutil.rmtree(cache_dir)
                            logger.info("✅ ChromeDriver 캐시 삭제 완료")
                        except Exception as cache_error:
                            logger.warning(f"⚠️ 캐시 삭제 실패: {cache_error}")
                
                # Windows에서 CREATE_NO_WINDOW 플래그를 사용하기 위해 커스텀 Service 클래스 사용
                if sys.platform == 'win32':
                    from selenium.webdriver.chrome.service import Service as ChromeService
                    
                    class NoWindowService(ChromeService):
                        def __init__(self, executable_path, **kwargs):
                            super().__init__(executable_path, **kwargs)
                            # Windows에서 창이 뜨지 않도록 설정
                            if sys.platform == 'win32':
                                self.service_args = []
                        
                        def start(self):
                            """Windows에서 CREATE_NO_WINDOW 플래그로 subprocess 시작"""
                            import subprocess
                            if sys.platform == 'win32' and hasattr(subprocess, 'CREATE_NO_WINDOW'):
                                # 원본 start 메서드의 subprocess.Popen 호출을 가로채기
                                original_popen = subprocess.Popen
                                def patched_popen(*args, **kwargs):
                                    if 'creationflags' not in kwargs:
                                        kwargs['creationflags'] = subprocess.CREATE_NO_WINDOW
                                    return original_popen(*args, **kwargs)
                                
                                # start 메서드 실행 중에만 패치 적용
                                subprocess.Popen = patched_popen
                                try:
                                    os.environ['CHROME_HEADLESS'] = '1'
                                    super().start()
                                finally:
                                    # 패치 복원
                                    subprocess.Popen = original_popen
                            else:
                                super().start()
                    
                    service = NoWindowService(
                        driver_manager.install(),
                        log_output=os.devnull
                    )
                else:
                    service = Service(
                        driver_manager.install(),
                        log_output=os.devnull
                    )
                
                logger.info("🔄 ChromeDriver 초기화 중...")
                try:
                    driver = webdriver.Chrome(service=service, options=options)
                    self._driver = driver  # 인스턴스 변수에 저장
                    
                    # Windows에서 드라이버 생성 직후 즉시 모든 Chrome 창 숨기기
                    if sys.platform == 'win32':
                        time.sleep(0.1)
                        for _ in range(10):  # 10번 반복하여 확실히 숨기기
                            hide_chrome_windows(driver)
                            time.sleep(0.05)
                    
                    logger.info("✅ ChromeDriver 인스턴스 생성 완료")
                except Exception as init_error:
                    logger.error(f"❌ ChromeDriver 초기화 실패: {init_error}")
                    raise
                
                # Chrome이 완전히 시작될 때까지 대기 (타임아웃 설정)
                logger.info("⏳ Chrome 시작 대기 중...")
                try:
                    # 간단한 명령으로 Chrome이 응답하는지 확인 (타임아웃 5초)
                    driver.set_page_load_timeout(5)
                    driver.implicitly_wait(2)
                    # capabilities 확인 (빠른 확인)
                    capabilities = driver.capabilities
                    if capabilities:
                        logger.info(f"✅ Chrome 세션 확인 완료 (버전: {capabilities.get('browserVersion', 'unknown')})")
                    else:
                        logger.warning("⚠️ Chrome capabilities 확인 실패 (계속 진행)")
                except Exception as test_error:
                    logger.warning(f"⚠️ Chrome 세션 확인 실패 (계속 진행): {test_error}")
                    # 확인 실패해도 계속 진행
                
                # Windows에서 Selenium Chrome 창만 숨기기 (강화)
                if WINDOWS:
                    # 즉시 여러 번 실행 (창이 뜨는 것을 방지)
                    for _ in range(20):  # 20번 반복하여 확실히 숨기기
                        time.sleep(0.02)  # 창이 생성될 시간 대기
                        hidden_count = hide_chrome_windows(driver)
                        if hidden_count > 0:
                            logger.info(f"✅ {hidden_count}개의 Selenium Chrome 창을 숨겼습니다")
                    
                    # 주기적으로 Selenium Chrome 창만 숨기는 스레드 시작 (더 빠르게)
                    import threading
                    def periodic_hide():
                        while hasattr(self, '_driver') and self._driver:
                            try:
                                hide_chrome_windows(self._driver)
                                time.sleep(0.02)  # 0.02초마다 체크 (더 빠르게)
                            except:
                                break
                    
                    self._hide_window_thread = threading.Thread(target=periodic_hide, daemon=True)
                    self._hide_window_thread.start()
                
                logger.info("✅ ChromeDriver 초기화 성공")
                break
            except Exception as e:
                error_msg = str(e)
                logger.warning(f"⚠️ ChromeDriver 초기화 실패 (시도 {attempt + 1}/{max_retries}): {error_msg}")
                
                # 버전 불일치 오류인 경우
                if "version" in error_msg.lower() or "supports Chrome version" in error_msg:
                    logger.info("🔄 ChromeDriver 버전 불일치 감지, 캐시 삭제 후 재다운로드...")
                    cache_dir = os.path.join(os.path.expanduser("~"), ".wdm")
                    if os.path.exists(cache_dir):
                        try:
                            shutil.rmtree(cache_dir)
                            logger.info("✅ ChromeDriver 캐시 삭제 완료")
                        except Exception as cache_error:
                            logger.warning(f"⚠️ 캐시 삭제 실패: {cache_error}")
                    
                    if attempt < max_retries - 1:
                        time.sleep(2)  # 잠시 대기 후 재시도
                        continue
                
                if attempt == max_retries - 1:
                    logger.error("❌ ChromeDriver 초기화 실패")
                    logger.error("💡 해결 방법:")
                    logger.error("   1. webdriver-manager를 최신 버전으로 업데이트: pip install --upgrade webdriver-manager")
                    logger.error("   2. 또는 Chrome 브라우저를 재시작하세요")
                    raise
        
        if driver is None:
            raise Exception("ChromeDriver 초기화 실패")
        try:
            # 초기 페이지 접근
            driver.get(self.base_url)
            time.sleep(3)  # 페이지 로딩 대기
            
            # 더보기 버튼 20번 클릭
            self._click_more_button(driver)
            
            # 현재 페이지의 HTML 가져오기
            page_source = driver.page_source
            soup = BeautifulSoup(page_source, 'html.parser')
            
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
        finally:
            # 드라이버 종료 전 마지막으로 Selenium Chrome 창 숨기기
            if WINDOWS:
                hide_chrome_windows(driver)
            driver.quit()
            self._driver = None  # 드라이버 참조 제거
            
        # 크롤링 완료
        logger.info("=== 네이버 인플루언서 크롤링 완료 ===")
        # 배치 스크립트 실행은 run_all_crawlers.py에서 한 번만 수행
            
        return all_recipes

    def save_to_json(self, data: List[Dict], filename: str = "naver_influencer_topics.json"):
        """데이터를 JSON 파일로 저장"""
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            logger.info(f"Data saved to {filename}")
        except Exception as e:
            logger.error(f"Error saving data to file: {str(e)}")

    def delete_low_ingredient_entries(self):
        connection = pymysql.connect(
            host=os.getenv('DB_HOST') or os.getenv('MYSQLHOST') or os.getenv('MYSQL_HOST') or 'caboose.proxy.rlwy.net',
            user=os.getenv('DB_USER') or os.getenv('MYSQLUSER') or os.getenv('MYSQL_USER') or 'root',
            password=os.getenv('DB_PASSWORD') or os.getenv('MYSQLPASSWORD') or os.getenv('MYSQL_PASSWORD') or 'HkqYFCoKPPPxgryxiEbUYxcYynQXxeRF',
            db=os.getenv('DB_NAME') or os.getenv('MYSQLDATABASE') or os.getenv('MYSQL_DATABASE') or 'railway',
            port=int(os.getenv('DB_PORT') or os.getenv('MYSQLPORT') or os.getenv('MYSQL_PORT') or 47779),
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

def main():
    crawler = NaverInfluencerCrawler()
    recipes = crawler.crawl()
    crawler.save_to_json(recipes)
    crawler.delete_low_ingredient_entries()
    logger.info(f"Total recipes collected: {len(recipes)}")

if __name__ == "__main__":
    main() 