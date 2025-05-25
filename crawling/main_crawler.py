"""
Main crawler execution script.
"""
from naver_crawler import NaverCrawler
# from youtube_crawler import YoutubeCrawler  # Uncomment when implemented

def main():
    # Initialize crawlers
    crawlers = [
        NaverCrawler(),
        # YoutubeCrawler(),  # Uncomment when implemented
    ]
    
    # Run crawlers
    for crawler in crawlers:
        print(f"Starting {crawler.__class__.__name__}...")
        crawler.crawl()
        print(f"Finished {crawler.__class__.__name__}")
    
    # Run ingredients update batch
    print("Running ingredients update batch...")
    # TODO: Implement ingredients update batch execution
    print("Finished ingredients update batch")

if __name__ == "__main__":
    main() 