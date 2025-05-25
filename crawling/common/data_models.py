"""
Data models for crawlers.
"""
from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional

@dataclass
class Recipe:
    """Recipe data model."""
    title: str
    content: str
    author: str
    thumbnail: str
    likes: int
    comments: int
    post_time: datetime
    platform: str
    used_ingredients: List[str]
    views: Optional[int] = None  # For YouTube videos
    link: Optional[str] = None   # Original URL 