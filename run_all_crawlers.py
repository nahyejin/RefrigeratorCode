import logging
import subprocess
import sys
import os
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
        elif hasattr(crawler_instance, 'process_influencer_list'):
            crawler_instance.process_influencer_list()
        else:
            raise Exception("크롤러에 실행 메서드가 없습니다.")
        logger.info(f"=== {desc} 실행 완료 ===\n")
    except Exception as e:
        logger.error(f"!!! {desc} 실행 실패: {str(e)} !!!\n")
        raise

def run_ingredients_batch():
    """used_ingredients 배치 처리 실행"""
    try:
        logger.info("=== used_ingredients 배치 처리 시작 ===")
        # 현재 스크립트의 디렉토리를 기준으로 상대 경로 사용
        base_dir = os.path.dirname(os.path.abspath(__file__))
        script_path = os.path.join(base_dir, 'ingredient_management', 'update_used_ingredients_batch.py')
        result = subprocess.run([sys.executable, script_path], check=True, capture_output=True, text=True)
        logger.info("=== used_ingredients 배치 처리 완료 ===")
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"used_ingredients 배치 처리 실패: {str(e)}")
        logger.error(f"에러 출력: {e.stderr}")
        return False
    except Exception as e:
        logger.error(f"used_ingredients 배치 처리 중 예외 발생: {str(e)}")
        return False

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
        
        # 모든 크롤러 완료 후 used_ingredients 배치 처리 실행
        if run_ingredients_batch():
            logger.info("=== 전체 프로세스 완료 (크롤링 + 재료 추출) ===")
        else:
            logger.warning("=== 크롤링은 완료되었으나 재료 추출에 실패했습니다 ===")
            
    except Exception as e:
        logger.error(f"크롤러 실행 중 오류 발생: {str(e)}")
        exit(1)

if __name__ == "__main__":
    main() 