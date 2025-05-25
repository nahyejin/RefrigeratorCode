import os
import logging
from database import Database
from crawling.naver_crawler import NaverCrawler
from utils import setup_logger

def main():
    # 로거 설정
    logger = setup_logger('main')
    
    try:
        # 데이터베이스 연결
        db = Database()
        
        # 네이버 크롤러 실행 (블로그 + 인플루언서)
        crawler = NaverCrawler()
        crawler.crawl()
            
    except Exception as e:
        logger.error(f"크롤링 중 오류 발생: {str(e)}")
        
if __name__ == "__main__":
    main() 