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

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class NaverInfluencerCrawler:
    def __init__(self):
        self.base_url = "https://influencer.naver.com/hot-topics"
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        })
        self.max_retries = 3
        self.retry_delay = 2
        self.timeout = 10

        # DNS 설정
        self._setup_dns()
        
        # 프록시 설정 (필요한 경우 주석 해제)
        # self.session.proxies = {
        #     'http': 'http://your-proxy:port',
        #     'https': 'https://your-proxy:port'
        # }

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

    def _extract_topic_data(self, topic_element) -> Optional[Dict]:
        """토픽 데이터 추출"""
        try:
            # 제목 추출
            title_element = topic_element.select_one('div.topic_title')
            if not title_element:
                return None
            title = title_element.get_text(strip=True)

            # 링크 추출
            link_element = topic_element.select_one('a')
            if not link_element:
                return None
            link = link_element.get('href', '')
            if not link.startswith('http'):
                link = f"https://influencer.naver.com{link}"

            # 조회수 추출
            views_element = topic_element.select_one('div.topic_views')
            views = views_element.get_text(strip=True) if views_element else "0"

            # 작성일 추출
            date_element = topic_element.select_one('div.topic_date')
            date = date_element.get_text(strip=True) if date_element else ""

            return {
                'title': title,
                'link': link,
                'views': views,
                'date': date,
                'crawled_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            }
        except Exception as e:
            logger.error(f"Error extracting topic data: {str(e)}")
            return None

    def _get_total_pages(self, soup: BeautifulSoup) -> int:
        """전체 페이지 수 계산"""
        try:
            pagination = soup.select('div.pagination a')
            if not pagination:
                return 1
            
            page_numbers = [int(a.get_text(strip=True)) for a in pagination if a.get_text(strip=True).isdigit()]
            return max(page_numbers) if page_numbers else 1
        except Exception as e:
            logger.error(f"Error getting total pages: {str(e)}")
            return 1

    def crawl(self) -> List[Dict]:
        """크롤링 실행"""
        all_topics = []
        page = 1
        
        while True:
            url = f"{self.base_url}?page={page}"
            logger.info(f"Crawling page {page}")
            
            soup = self._make_request(url)
            if not soup:
                logger.error(f"Failed to fetch page {page}")
                break

            # 토픽 목록 추출
            topic_elements = soup.select('div.topic_item')
            if not topic_elements:
                logger.info("No more topics found")
                break

            # 각 토픽 데이터 추출
            for topic_element in topic_elements:
                topic_data = self._extract_topic_data(topic_element)
                if topic_data:
                    all_topics.append(topic_data)

            # 다음 페이지 확인
            if page == 1:
                total_pages = self._get_total_pages(soup)
                logger.info(f"Total pages: {total_pages}")

            if page >= total_pages:
                break

            page += 1
            time.sleep(random.uniform(1, 2))  # 랜덤 딜레이

        return all_topics

    def save_to_json(self, data: List[Dict], filename: str = "naver_influencer_topics.json"):
        """데이터를 JSON 파일로 저장"""
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            logger.info(f"Data saved to {filename}")
        except Exception as e:
            logger.error(f"Error saving data to file: {str(e)}")

def main():
    crawler = NaverInfluencerCrawler()
    topics = crawler.crawl()
    crawler.save_to_json(topics)

if __name__ == "__main__":
    main() 