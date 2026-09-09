import logging
import subprocess
import traceback
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

def run_crawler(make_crawler, desc):
    """크롤러 하나를 만들고 돌린다. **실패해도 다음 크롤러로 넘어간다.**

    예전에는 여기서 예외를 다시 던졌고 `main()` 이 그걸 받아 `exit(1)` 했다.
    그래서 크롤러 하나가 죽으면 **뒤에 오는 것이 통째로 안 돌았다** — 실제로
    2026-09-09 밤 네이버 인플루언서 크롤러가 렌더러 응답 없음(7초)으로 죽자
    유튜브 크롤러는 시작도 못 했고, 그 뒤의 룰베이스·LLM 재료 추출까지 다
    건너뛰었다. 크롤러 셋은 서로 상관이 없다 — 하나가 넘어져도 나머지는 제
    몫을 해야 한다.

    만드는 것(`make_crawler`)까지 여기서 한다. 드라이버를 띄우다 죽는 경우가
    있는데, 바깥에서 만들면 그 실패는 또 통째로 죽는 길로 샌다.

    돌려주는 값: 성공했나.
    """
    crawler_instance = None
    try:
        logger.info(f"=== {desc} 실행 시작 ===")
        crawler_instance = make_crawler()
        if hasattr(crawler_instance, 'crawl'):
            crawler_instance.crawl()
        elif hasattr(crawler_instance, 'crawl_influencer_posts'):
            crawler_instance.crawl_influencer_posts("https://in.naver.com/discover/135968760155968")
        elif hasattr(crawler_instance, 'process_influencer_list'):
            crawler_instance.process_influencer_list()
        else:
            raise Exception("크롤러에 실행 메서드가 없습니다.")
        logger.info(f"=== {desc} 실행 완료 ===\n")
        return True
    except Exception as e:
        logger.error(f"!!! {desc} 실행 실패(다음 크롤러로 넘어갑니다): {e} !!!")
        logger.error(traceback.format_exc())
        return False
    finally:
        # 넘어진 크롤러가 크롬을 붙들고 있으면 다음 크롤러가 쓸 자리가 줄어든다.
        driver = getattr(crawler_instance, "driver", None) if crawler_instance else None
        if driver is not None:
            try:
                driver.quit()
            except Exception:
                pass


def run_ingredients_batch():
    """used_ingredients 배치 처리 실행 (룰베이스, 즉시 폴백용)"""
    try:
        logger.info("=== used_ingredients 배치 처리 시작 (룰베이스) ===")
        # 현재 스크립트의 디렉토리를 기준으로 상대 경로 사용
        base_dir = os.path.dirname(os.path.abspath(__file__))
        script_path = os.path.join(base_dir, 'ingredient_management', 'update_used_ingredients_batch.py')
        result = subprocess.run([sys.executable, script_path], check=True, capture_output=True, text=True)
        logger.info("=== used_ingredients 배치 처리 완료 (룰베이스) ===")
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"used_ingredients 배치 처리 실패: {str(e)}")
        logger.error(f"에러 출력: {e.stderr}")
        return False
    except Exception as e:
        logger.error(f"used_ingredients 배치 처리 중 예외 발생: {str(e)}")
        return False


def run_llm_ingredients_daily():
    """오늘 새로 크롤링된(아직 LLM 미처리) 레시피만 무료 티어 한도 내에서 LLM으로 재료 재추출.
    GEMINI_API_KEY가 없거나 하루 한도를 이미 다 썼으면 실패해도 크롤링 자체는 이미 끝난 뒤라 무해함.
    """
    try:
        logger.info("=== used_ingredients LLM 처리 시작 (신규분, 무료 한도 내) ===")
        base_dir = os.path.dirname(os.path.abspath(__file__))
        script_path = os.path.join(base_dir, 'ingredient_management', 'llm_ingredient_extraction.py')
        result = subprocess.run(
            [
                sys.executable, script_path,
                '--pending-only', '--commit',
                '--limit', '450',  # 처리할 레시피 수 상한 (실제 신규분은 보통 이보다 훨씬 적음)
                '--batch-size', '8',  # 8건씩 묶어 호출 → 최대여도 API 호출은 하루 500건 한도의 일부만 사용, 챗봇 몫 넉넉히 남김
                '--rpm', '12', '--concurrency', '2',
            ],
            check=True, capture_output=True, text=True,
        )
        logger.info("=== used_ingredients LLM 처리 완료 ===")
        logger.info(result.stdout[-2000:])
        return True
    except subprocess.CalledProcessError as e:
        # 일일 한도 초과 등으로 실패해도 크롤링 자체엔 영향 없음 — 다음 실행에서 이어서 처리됨
        logger.warning(f"used_ingredients LLM 처리 실패(다음 실행에서 이어서 처리됨): {str(e)}")
        logger.warning(f"에러 출력: {e.stderr[-1000:] if e.stderr else ''}")
        return False
    except Exception as e:
        logger.warning(f"used_ingredients LLM 처리 중 예외 발생(다음 실행에서 이어서 처리됨): {str(e)}")
        return False

def main():
    """크롤러를 차례로 돌린다. **하나가 죽어도 나머지는 돈다.**"""
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    jobs = [
        (NaverBlogCrawler, "네이버(주제별보기) 크롤러"),
        (NaverInfluencerCrawler, "네이버(인플루언서핫토픽) 크롤러"),
        (YouTubeCrawler, "유튜브(인플루언서) 크롤러"),
    ]
    ok, failed = [], []
    for make, desc in jobs:
        (ok if run_crawler(make, desc) else failed).append(desc)

    if failed:
        logger.warning("=== 크롤러 %d/%d 성공 · 실패: %s ==="
                       % (len(ok), len(jobs), ", ".join(failed)))
    else:
        logger.info("=== 모든 크롤러 실행 완료 ===")

    # **크롤러가 다 죽었어도 뒷단은 돈다.**
    #
    # 룰베이스·LLM 재료 추출은 "아직 재료가 안 채워진 레시피" 를 훑는다. 어제
    # 못 끝낸 것이 남아 있을 수 있으므로, 오늘 새로 들어온 것이 없다고 해서
    # 건너뛸 이유가 없다.
    if run_ingredients_batch():
        logger.info("=== 룰베이스 재료 추출 완료 ===")
    else:
        logger.warning("=== 룰베이스 재료 추출에 실패했습니다 ===")

    run_llm_ingredients_daily()
    logger.info("=== 전체 프로세스 완료 (크롤링 %d/%d · 룰베이스 · LLM 재료 추출) ==="
                % (len(ok), len(jobs)))

    # 하나도 성공 못 했을 때만 실패로 끝낸다 — 작업 스케줄러 기록에 남는다.
    if not ok:
        logger.error("크롤러가 하나도 성공하지 못했습니다")
        exit(1)


if __name__ == "__main__":
    main() 