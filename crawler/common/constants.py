"""
Constants used across crawlers.
"""

# Database configuration
DB_CONFIG = {
    'host': 'caboose.proxy.rlwy.net',
    'user': 'root',
    'password': 'HkqYFCoKPPPxgryxiEbUYxcYynQXxeRF',
    'db': 'railway',
    'port': 3306,
    'charset': 'utf8mb4'
}

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