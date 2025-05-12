
"""
Spider for crawling .onion sites through Tor.

This spider implements:
- Tor proxy connection
- Graceful failure handling with retries
- Advanced content extraction
"""

import logging
import time
import json
from urllib.parse import urlparse
import re

import scrapy
from scrapy.exceptions import CloseSpider
from scrapy.spidermiddlewares.httperror import HttpError
from twisted.internet.error import DNSLookupError, TCPTimedOutError, TimeoutError

# Setup logging
logger = logging.getLogger(__name__)

class OnionSpider(scrapy.Spider):
    """Spider for crawling .onion sites through Tor."""
    
    name = "onion"
    
    custom_settings = {
        # Crawl settings
        'ROBOTSTXT_OBEY': False,  # .onion sites often don't have robots.txt
        'CONCURRENT_REQUESTS': 8,  # Limit concurrent requests
        'DOWNLOAD_TIMEOUT': 60,   # Increased timeout for Tor
        'DOWNLOAD_DELAY': 2,      # Time between requests
        'RANDOMIZE_DOWNLOAD_DELAY': True,  # Add randomness to download delay
        
        # Retry settings
        'RETRY_ENABLED': True,
        'RETRY_TIMES': 3,           # Max retry attempts
        'RETRY_HTTP_CODES': [500, 502, 503, 504, 408, 429],  # Status codes to retry
        
        # Tor proxy settings
        'HTTPPROXY_ENABLED': True,
        'HTTP_PROXY': 'http://127.0.0.1:8118',  # Privoxy forwarding to Tor
        'HTTPS_PROXY': 'http://127.0.0.1:8118',
        
        # Alternative direct Tor configuration
        'DOWNLOADER_MIDDLEWARES': {
            'scrapy.downloadermiddlewares.httpproxy.HttpProxyMiddleware': 110,
            'src.utils.scrapy_spider.middlewares.TorCircuitRotationMiddleware': 120,
            'src.utils.scrapy_spider.middlewares.GracefulFailureRetryMiddleware': 550,
            'scrapy.downloadermiddlewares.retry.RetryMiddleware': None,  # Disable default retry
        },
        
        # Content processing pipeline
        'ITEM_PIPELINES': {
            'src.utils.scrapy_spider.pipelines.HTMLSanitizationPipeline': 100,
            'src.utils.scrapy_spider.pipelines.ContentExtractionPipeline': 200,
            'src.utils.scrapy_spider.pipelines.ContentChunkingPipeline': 300,
            'src.utils.scrapy_spider.pipelines.ChromaDBStoragePipeline': 400,
        },
        
        # Tor settings
        'TOR_CONTROL_PORT': 9051,
        'TOR_MAX_REQUESTS_PER_CIRCUIT': 10,
        'TOR_ENABLE_RANDOM_ROTATION': True,
    }
    
    def __init__(self, urls=None, urls_file=None, *args, **kwargs):
        """
        Initialize the spider with URLs to crawl.
        
        Args:
            urls: String of comma-separated URLs or JSON-encoded list of URLs
            urls_file: Path to file containing URLs (JSON or one URL per line)
        """
        super(OnionSpider, self).__init__(*args, **kwargs)
        
        self.start_urls = []
        self.failed_urls = []
        self.start_time = time.time()
        
        # Process URLs from string
        if urls:
            try:
                # Try parsing as JSON
                url_list = json.loads(urls)
                if isinstance(url_list, list):
                    self.start_urls = url_list
                else:
                    self.start_urls = urls.split(',')
            except json.JSONDecodeError:
                # Treat as comma-separated list
                self.start_urls = urls.split(',')
        
        # Process URLs from file
        if urls_file:
            try:
                with open(urls_file, 'r') as f:
                    content = f.read().strip()
                    
                    # Try parsing as JSON
                    if content.startswith('[') and content.endswith(']'):
                        try:
                            url_list = json.loads(content)
                            if isinstance(url_list, list):
                                self.start_urls.extend(url_list)
                        except json.JSONDecodeError:
                            # Not valid JSON, treat as line-separated
                            lines = content.split('\n')
                            self.start_urls.extend([line.strip() for line in lines if line.strip()])
                    else:
                        # Treat as line-separated
                        lines = content.split('\n')
                        self.start_urls.extend([line.strip() for line in lines if line.strip()])
            except Exception as e:
                logger.error(f"Error loading URLs from file: {e}")
        
        # Filter to only .onion URLs
        self.start_urls = [url.strip() for url in self.start_urls if self._is_valid_onion_url(url.strip())]
        
        if not self.start_urls:
            logger.warning("No valid .onion URLs provided")
    
    def _is_valid_onion_url(self, url):
        """Validate if a URL is a proper .onion address."""
        try:
            parsed = urlparse(url)
            # Check if scheme is present
            if not parsed.scheme or not parsed.netloc:
                return False
                
            # Check if it's a .onion domain
            if not parsed.netloc.endswith('.onion'):
                return False
                
            # Check for valid onion address format (v2 or v3)
            hostname = parsed.netloc.split('.')[0]
            # V3 onion addresses are 56 chars, V2 are 16 chars
            if len(hostname) not in (16, 56):
                return False
                
            # Check for valid base32 chars (a-z2-7)
            if not re.match(r'^[a-z2-7]+$', hostname):
                return False
                
            return True
        except Exception:
            return False
    
    def start_requests(self):
        """Generate initial requests for all start URLs."""
        logger.info(f"Starting crawl of {len(self.start_urls)} .onion URLs")
        
        for url in self.start_urls:
            logger.debug(f"Starting request for {url}")
            yield scrapy.Request(
                url=url,
                callback=self.parse,
                errback=self.handle_error,
                meta={
                    'handle_httpstatus_all': True,
                    'original_url': url,
                    'start_time': time.time()
                }
            )
    
    def parse(self, response):
        """
        Parse response and extract content.
        
        Args:
            response: HTTP response from scraped page
            
        Yields:
            Item with extracted data
        """
        # Check response status
        if response.status != 200:
            logger.warning(f"Got status {response.status} for {response.url}")
            return
        
        # Extract processing metrics
        request_time = time.time() - response.meta.get('start_time', self.start_time)
        logger.info(f"Processed {response.url} in {request_time:.2f}s")
        
        # Create item with raw HTML
        item = {
            'url': response.url,
            'original_url': response.meta.get('original_url', response.url),
            'status': response.status,
            'html': response.text,
            'headers': dict(response.headers),
            'crawl_time': time.time(),
            'request_time': request_time
        }
        
        # The pipelines will add:
        # - content (extracted HTML)
        # - text (plain text)
        # - title
        # - chunks (segmented text)
        
        yield item
    
    def handle_error(self, failure):
        """
        Handle failed requests with detailed logging.
        
        Args:
            failure: Twisted Failure object
        """
        # Extract request from failure
        request = failure.request
        url = request.url
        
        # Log based on error type
        if failure.check(HttpError):
            response = failure.value.response
            logger.error(f"HTTP Error {response.status} on {url}")
            self.crawler.stats.inc_value(f'error/http/{response.status}')
        
        elif failure.check(DNSLookupError):
            logger.error(f"DNS lookup error on {url}")
            self.crawler.stats.inc_value('error/dns')
        
        elif failure.check(TimeoutError, TCPTimedOutError):
            logger.error(f"Timeout error on {url}")
            self.crawler.stats.inc_value('error/timeout')
            
        else:
            logger.error(f"Unknown error on {url}: {failure.value}")
            self.crawler.stats.inc_value('error/unknown')
        
        # Track failed URL
        self.failed_urls.append((url, str(failure.value)))
    
    def closed(self, reason):
        """Handle spider close event."""
        # Calculate statistics
        end_time = time.time()
        crawl_duration = end_time - self.start_time
        
        success_count = len(self.start_urls) - len(self.failed_urls)
        
        logger.info(f"Spider closed: {reason}")
        logger.info(f"Crawled {success_count}/{len(self.start_urls)} URLs in {crawl_duration:.2f}s")
        
        # Log failures if any
        if self.failed_urls:
            logger.info(f"Failed URLs ({len(self.failed_urls)}):")
            for url, reason in self.failed_urls[:10]:  # Limit to first 10
                logger.info(f"- {url}: {reason}")
            
            if len(self.failed_urls) > 10:
                logger.info(f"... and {len(self.failed_urls) - 10} more.")
