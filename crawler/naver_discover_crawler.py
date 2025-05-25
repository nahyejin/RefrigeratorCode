import os
import time
import json
import logging
from datetime import datetime
from typing import List, Dict, Optional
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from bs4 import BeautifulSoup
from urllib.parse import urlparse, parse_qs

from database import Database
from utils import setup_logger, get_chrome_options

class NaverDiscoverCrawler:
    def __init__(self, db: Database):
        self.db = db
        self.logger = setup_logger('naver_discover_crawler')
        self.driver = None
        self.base_url = "https://discover.naver.com/food"
        self.wait_time = 10
        
    def __enter__(self):
        self.driver = webdriver.Chrome(options=get_chrome_options())
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.driver:
            self.driver.quit()
            
    def get_topic_posts(self, topic_url: str) -> List[Dict]:
        """특정 토픽의 포스트들을 수집"""
        posts = []
        try:
            self.driver.get(topic_url)
            time.sleep(3)  # 페이지 로딩 대기
            
            # 스크롤 다운하여 더 많은 포스트 로드
            self._scroll_down()
            
            # 포스트 목록 가져오기
            post_elements = self.driver.find_elements(By.CSS_SELECTOR, "div.sc_new.cs_feed._cs_feed")
            
            for element in post_elements:
                try:
                    post_data = self._extract_post_data(element)
                    if post_data:
                        posts.append(post_data)
                except Exception as e:
                    self.logger.error(f"포스트 데이터 추출 중 오류: {str(e)}")
                    continue
                    
        except Exception as e:
            self.logger.error(f"토픽 포스트 수집 중 오류: {str(e)}")
            
        return posts
        
    def _scroll_down(self):
        """페이지 끝까지 스크롤 다운"""
        last_height = self.driver.execute_script("return document.body.scrollHeight")
        
        while True:
            self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(2)
            
            new_height = self.driver.execute_script("return document.body.scrollHeight")
            if new_height == last_height:
                break
            last_height = new_height
            
    def _extract_post_data(self, element) -> Optional[Dict]:
        """포스트 요소에서 데이터 추출"""
        try:
            # 포스트 URL
            post_url = element.find_element(By.CSS_SELECTOR, "a.link_end").get_attribute("href")
            
            # 블로그 ID 추출
            blog_id = self._extract_blog_id(post_url)
            if not blog_id:
                return None
                
            # 포스트 ID 추출
            post_id = self._extract_post_id(post_url)
            if not post_id:
                return None
                
            # 이미 저장된 포스트인지 확인
            if self.db.is_post_exists(blog_id, post_id):
                return None
                
            # 제목
            title = element.find_element(By.CSS_SELECTOR, "strong.title_end").text.strip()
            
            # 작성자
            author = element.find_element(By.CSS_SELECTOR, "span.name").text.strip()
            
            # 작성일
            date_str = element.find_element(By.CSS_SELECTOR, "span.date").text.strip()
            date = self._parse_date(date_str)
            
            # 썸네일 이미지
            try:
                thumbnail = element.find_element(By.CSS_SELECTOR, "img.thumb").get_attribute("src")
            except NoSuchElementException:
                thumbnail = None
                
            return {
                "blog_id": blog_id,
                "post_id": post_id,
                "title": title,
                "author": author,
                "date": date,
                "url": post_url,
                "thumbnail": thumbnail,
                "source": "naver_discover"
            }
            
        except Exception as e:
            self.logger.error(f"포스트 데이터 추출 중 오류: {str(e)}")
            return None
            
    def _extract_blog_id(self, url: str) -> Optional[str]:
        """URL에서 블로그 ID 추출"""
        try:
            parsed = urlparse(url)
            path_parts = parsed.path.split('/')
            if len(path_parts) >= 2:
                return path_parts[1]
        except Exception as e:
            self.logger.error(f"블로그 ID 추출 중 오류: {str(e)}")
        return None
        
    def _extract_post_id(self, url: str) -> Optional[str]:
        """URL에서 포스트 ID 추출"""
        try:
            parsed = urlparse(url)
            query_params = parse_qs(parsed.query)
            return query_params.get('blogId', [None])[0]
        except Exception as e:
            self.logger.error(f"포스트 ID 추출 중 오류: {str(e)}")
        return None
        
    def _parse_date(self, date_str: str) -> str:
        """날짜 문자열 파싱"""
        try:
            # "2024.03.21." 형식의 날짜 처리
            date_str = date_str.replace('.', '')
            return datetime.strptime(date_str, '%Y%m%d').strftime('%Y-%m-%d')
        except Exception as e:
            self.logger.error(f"날짜 파싱 중 오류: {str(e)}")
            return datetime.now().strftime('%Y-%m-%d')
            
    def crawl(self):
        """네이버 디스커버 푸드 토픽 크롤링 실행"""
        try:
            self.driver.get(self.base_url)
            time.sleep(3)
            
            # 푸드 토픽 섹션 찾기
            topic_section = self.driver.find_element(By.XPATH, "//h3[contains(text(), '지금 핫한 푸드 토픽')]")
            topic_container = topic_section.find_element(By.XPATH, "./following-sibling::div")
            
            # 토픽 링크 수집
            topic_links = topic_container.find_elements(By.CSS_SELECTOR, "a.link_topic")
            
            for link in topic_links:
                try:
                    topic_url = link.get_attribute("href")
                    topic_name = link.text.strip()
                    
                    self.logger.info(f"토픽 '{topic_name}' 크롤링 시작")
                    
                    # 토픽의 포스트 수집
                    posts = self.get_topic_posts(topic_url)
                    
                    # 수집된 포스트 저장
                    for post in posts:
                        self.db.save_post(post)
                        
                    self.logger.info(f"토픽 '{topic_name}'에서 {len(posts)}개의 포스트 수집 완료")
                    
                except Exception as e:
                    self.logger.error(f"토픽 처리 중 오류: {str(e)}")
                    continue
                    
        except Exception as e:
            self.logger.error(f"크롤링 중 오류 발생: {str(e)}")
            
        finally:
            if self.driver:
                self.driver.quit() 