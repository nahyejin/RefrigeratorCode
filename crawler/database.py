import logging
from typing import Dict, Optional
from datetime import datetime
import pymysql
import pymysql.cursors
# 저장소 뿌리의 `db_env` 를 불러온다 — 접속 정보는 코드가 아니라
# `backend/.env` 에만 있다. 이 저장소는 공개다.
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.abspath(_os.path.join(_os.path.dirname(__file__), '..')))
from db_env import connect as _connect

class Database:
    def __init__(self):
        self.conn = _connect()
        self.cursor = self.conn.cursor()
        self.setup_database()
        
    def setup_database(self):
        """recipes 테이블 생성"""
        try:
            self.cursor.execute('''
                CREATE TABLE IF NOT EXISTS recipes (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    title TEXT,
                    link TEXT,
                    content MEDIUMTEXT,
                    used_ingredients TEXT,
                    used_ingredients_block TEXT,
                    block_reason VARCHAR(255),
                    author VARCHAR(255),
                    thumbnail TEXT,
                    platform VARCHAR(50),
                    likes INT,
                    comments INT,
                    post_time DATE,
                    collected_at DATETIME
                )
            ''')
            self.conn.commit()
        except Exception as e:
            logging.error(f"데이터베이스 설정 실패: {str(e)}")
            raise
            
    def save_recipe(self, recipe_data):
        """레시피 저장"""
        try:
            print("\n=== 데이터베이스 저장 시도 ===")
            print(f"저장할 데이터: {recipe_data}")
            
            self.cursor.execute('''
                INSERT INTO recipes (
                    title, link, content, used_ingredients, used_ingredients_block, 
                    block_reason, author, thumbnail, platform, likes, comments, 
                    post_time, collected_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ''', (
                recipe_data['title'],
                recipe_data['link'],
                recipe_data['content'],
                recipe_data['used_ingredients'],
                recipe_data['used_ingredients_block'],
                recipe_data['block_reason'],
                recipe_data['author'],
                recipe_data['thumbnail'],
                recipe_data['platform'],
                recipe_data['likes'],
                recipe_data['comments'],
                recipe_data['post_time'],
                recipe_data['collected_at']
            ))
            self.conn.commit()
            print("데이터베이스 저장 성공!")
            print(f"저장된 ID: {self.cursor.lastrowid}")
        except Exception as e:
            print(f"데이터베이스 저장 실패: {str(e)}")
            raise
            
    def close(self):
        """데이터베이스 연결 종료"""
        if self.conn:
            self.conn.close()

    def is_post_exists(self, blog_id: str, post_id: str) -> bool:
        """포스트가 이미 존재하는지 확인"""
        self.cursor.execute(
            "SELECT 1 FROM recipes WHERE blog_id = %s AND post_id = %s",
            (blog_id, post_id)
        )
        return self.cursor.fetchone() is not None
            
    def save_ingredient(self, name: str, category: Optional[str] = None) -> int:
        """재료 저장 및 ID 반환"""
        # 재료가 이미 존재하는지 확인
        self.cursor.execute(
            "SELECT id FROM ingredients WHERE name = %s",
            (name,)
        )
        result = self.cursor.fetchone()
        
        if result:
            return result[0]
            
        # 새로운 재료 저장
        self.cursor.execute('''
            INSERT INTO ingredients (name, category, created_at)
            VALUES (%s, %s, %s)
        ''', (
            name,
            category,
            datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        ))
        
        self.conn.commit()
        return self.cursor.lastrowid
            
    def link_post_ingredient(self, post_id: int, ingredient_id: int):
        """포스트와 재료 연결"""
        self.cursor.execute('''
            INSERT IGNORE INTO post_ingredients (post_id, ingredient_id, created_at)
            VALUES (%s, %s, %s)
        ''', (
            post_id,
            ingredient_id,
            datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        ))
        
        self.conn.commit() 