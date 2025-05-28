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
    post_time: str  # Changed to str to store YYYY-MM-DD format
    platform: str
    link: str
    used_ingredients: Optional[List[str]] = None
    used_ingredients_block: Optional[str] = None
    block_reason: Optional[str] = None
    views: Optional[int] = None  # For YouTube videos 