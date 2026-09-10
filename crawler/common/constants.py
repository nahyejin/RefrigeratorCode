"""
Constants used across crawlers.
"""

import os
import sys

# 접속 정보는 코드가 아니라 `backend/.env` 에만 둔다 — 이 저장소는 공개다.
# 예전에는 여기에 운영 DB 주소와 비밀번호가 그대로 적혀 있었다.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
from db_env import db_settings  # noqa: E402

# Database configuration
DB_CONFIG = {**db_settings(), 'charset': 'utf8mb4'}

# Recipe filtering keywords
RECIPE_KEYWORDS = [
    '레시피',
    '만드는',
    '만들기',
    '요리',
    '끓이',
    '하는법'
]

# Platform names
PLATFORM_NAVER = 'naver(인플루언서핫토픽)'
PLATFORM_YOUTUBE = 'youtube'

# Crawling targets
NAVER_TARGETS = {
    'blog': {
        'url': 'https://section.blog.naver.com/ThemePost.naver',
        'params': {
            'directoryNo': '20',
            'activeDirectorySeq': '2'
        }
    },
    'influencer': {
        'url': 'https://in.naver.com/discover/135968760155968',
        'params': {}
    }
} 