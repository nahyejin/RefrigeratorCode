"""
Base crawler class that defines common functionality for all crawlers.
"""
from abc import ABC, abstractmethod
from typing import List, Dict
from datetime import datetime

class BaseCrawler(ABC):
    def __init__(self):
        self.keywords = ['레시피', '만드는', '만들기', '요리', '끓이', '하는법']
    
    def filter_by_keywords(self, title: str) -> bool:
        """Check if the title contains any of the recipe-related keywords."""
        return any(keyword in title for keyword in self.keywords)
    
    def extract_ingredients(self, content: str) -> List[str]:
        """Extract ingredients from the content."""
        # TODO: Implement ingredient extraction logic
        pass
    
    def save_to_database(self, recipe: Dict):
        """Save the recipe data to the database."""
        # TODO: Implement database saving logic
        pass
    
    @abstractmethod
    def crawl(self):
        """Main crawling method to be implemented by specific crawlers."""
        pass 