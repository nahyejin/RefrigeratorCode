import logging
import os
from datetime import datetime
from selenium.webdriver.chrome.options import Options

def setup_logger(name):
    """로거 설정"""
    # 로그 디렉토리 생성
    log_dir = 'logs'
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)
        
    # 로거 생성
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)
    
    # 파일 핸들러 설정
    log_file = os.path.join(log_dir, f'{name}_{datetime.now().strftime("%Y%m%d")}.log')
    file_handler = logging.FileHandler(log_file, encoding='utf-8')
    file_handler.setLevel(logging.INFO)
    
    # 콘솔 핸들러 설정
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    
    # 포맷터 설정
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    file_handler.setFormatter(formatter)
    console_handler.setFormatter(formatter)
    
    # 핸들러 추가
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
    
    return logger
    
def get_chrome_options() -> Options:
    """Chrome 옵션 설정 - Windows에서 창이 절대 뜨지 않도록 강력한 headless 설정"""
    import os
    import sys
    options = Options()
    
    # Windows에서 강제 headless 모드
    # --headless=new가 가장 안정적 (Chrome 109+)
    options.add_argument('--headless=new')
    # Windows에서 창이 뜨지 않도록 추가 옵션
    options.add_argument('--no-startup-window')
    options.add_argument('--disable-gpu')
    options.add_argument('--disable-software-rasterizer')
    
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--window-size=1920,1080')
    options.add_argument('--disable-infobars')
    options.add_argument('--disable-notifications')
    options.add_argument('--disable-blink-features=AutomationControlled')
    options.add_argument('--disable-web-security')
    options.add_argument('--allow-running-insecure-content')
    options.add_argument('--disable-site-isolation-trials')
    options.add_argument('--disable-extensions')
    options.add_argument('--disable-plugins')
    options.add_argument('--disable-logging')
    options.add_argument('--log-level=3')
    options.add_argument('--disable-background-timer-throttling')
    options.add_argument('--disable-backgrounding-occluded-windows')
    options.add_argument('--disable-renderer-backgrounding')
    options.add_argument('--disable-setuid-sandbox')
    options.add_argument('--no-first-run')
    options.add_argument('--no-default-browser-check')
    options.add_argument('--disable-default-apps')
    
    # Windows에서 백그라운드 실행 강제
    if sys.platform == 'win32':
        options.add_argument('--disable-background-networking')
        options.add_argument('--disable-sync')
        # Windows에서 창이 절대 뜨지 않도록 환경 변수 설정
        os.environ['CHROME_HEADLESS'] = '1'
        os.environ['DISPLAY'] = ':0'
    
    # 디버깅 포트는 제거 (0으로 설정하면 문제 발생 가능)
    options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    options.add_experimental_option('excludeSwitches', ['enable-logging', 'enable-automation'])
    options.add_experimental_option('useAutomationExtension', False)
    options.add_experimental_option("detach", False)
    
    # Chrome 실행 파일 경로 명시 (Windows)
    chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    if os.path.exists(chrome_path):
        options.binary_location = chrome_path
    
    # 환경 변수 설정
    os.environ['CHROME_NO_SANDBOX'] = '1'
    os.environ['CHROME_HEADLESS'] = '1'
    
    return options 