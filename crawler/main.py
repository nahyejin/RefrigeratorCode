from naver_crawler import NaverCrawler
from utils import setup_logger

def main():
    logger = setup_logger('main')
    crawler = NaverCrawler()
    
    try:
        # 디스커버 게시물 크롤링
        logger.info("디스커버 게시물 크롤링 시작")
        crawler.crawl_discover_posts(max_pages=5)
        
        # 인플루언서 게시물 크롤링
        logger.info("인플루언서 게시물 크롤링 시작")
        crawler.crawl_influencer_posts(max_pages=5)
        
    except Exception as e:
        logger.error(f"크롤링 중 오류 발생: {str(e)}")
    finally:
        if crawler.driver:
            crawler.driver.quit()

if __name__ == "__main__":
    main() 