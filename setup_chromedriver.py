from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

# Remove the ChromeType import and use the default ChromeDriverManager installation
service = Service(ChromeDriverManager().install())
options = webdriver.ChromeOptions()
driver = webdriver.Chrome(service=service, options=options)

# 원하는 웹 페이지 열기 (예시)
driver.get('https://www.example.com')

# 작업 완료 후 브라우저 종료
driver.quit()
