import logging
from crawler import NaverBlogCrawler, NaverInfluencerCrawler, YouTubeCrawler

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

def run_crawler(crawler_instance, desc):
    """크롤러 실행 및 예외처리"""
    try:
        logger.info(f"=== {desc} 실행 시작 ===")
        if hasattr(crawler_instance, 'crawl'):
            crawler_instance.crawl()
        elif hasattr(crawler_instance, 'crawl_influencer_posts'):
            crawler_instance.crawl_influencer_posts("https://in.naver.com/discover/135968760155968")
        else:
            raise Exception("크롤러에 실행 메서드가 없습니다.")
        logger.info(f"=== {desc} 실행 완료 ===\n")
    except Exception as e:
        logger.error(f"!!! {desc} 실행 실패: {str(e)} !!!\n")
        raise

def main():
    """모든 크롤러를 순차적으로 실행"""
    try:
        # 네이버 주제별보기 크롤러
        naver_blog = NaverBlogCrawler()
        run_crawler(naver_blog, "네이버(주제별보기) 크롤러")
        
        # 네이버 인플루언서 크롤러
        naver_influencer = NaverInfluencerCrawler()
        run_crawler(naver_influencer, "네이버(인플루언서핫토픽) 크롤러")
        
        # 유튜브 크롤러
        youtube = YouTubeCrawler()
        run_crawler(youtube, "유튜브(인플루언서) 크롤러")
        
        logger.info("=== 모든 크롤러 실행 완료 ===")
    except Exception as e:
        logger.error(f"크롤러 실행 중 오류 발생: {str(e)}")
        exit(1)

if __name__ == "__main__":
    main() 