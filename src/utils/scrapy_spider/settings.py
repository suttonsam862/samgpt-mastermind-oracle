
"""
Scrapy settings for dark web crawling.
"""

BOT_NAME = 'dark_web_crawler'

SPIDER_MODULES = ['src.utils.scrapy_spider.spiders']
NEWSPIDER_MODULE = 'src.utils.scrapy_spider.spiders'

# Disable cookies for anonymity
COOKIES_ENABLED = False

# Use random user agents
RANDOM_UA_PER_PROXY = True
RANDOM_UA_TYPE = 'random'

# Respect the robots.txt directives
ROBOTSTXT_OBEY = False

# Configure maximum concurrent requests
CONCURRENT_REQUESTS = 8
CONCURRENT_REQUESTS_PER_DOMAIN = 4
CONCURRENT_REQUESTS_PER_IP = 4

# Enable and configure the AutoThrottle
AUTOTHROTTLE_ENABLED = True
AUTOTHROTTLE_START_DELAY = 5
AUTOTHROTTLE_MAX_DELAY = 60
AUTOTHROTTLE_TARGET_CONCURRENCY = 1.0
AUTOTHROTTLE_DEBUG = False

# Disable timeout middleware
DOWNLOAD_TIMEOUT = 60

# Enable and configure Tor-specific middleware
DOWNLOADER_MIDDLEWARES = {
    'scrapy.downloadermiddlewares.httpproxy.HttpProxyMiddleware': 110,
    'src.utils.scrapy_spider.middlewares.TorCircuitRotationMiddleware': 120,
    'src.utils.scrapy_spider.middlewares.TLSFingerprintRandomizationMiddleware': 130,
    'src.utils.scrapy_spider.middlewares.GracefulFailureRetryMiddleware': 550,
    'scrapy.downloadermiddlewares.retry.RetryMiddleware': None,  # Disable default retry
}

# Configure item pipelines
ITEM_PIPELINES = {
    'src.utils.scrapy_spider.pipelines.HTMLSanitizationPipeline': 100,
    'src.utils.scrapy_spider.pipelines.ContentExtractionPipeline': 200,
    'src.utils.scrapy_spider.pipelines.ContentChunkingPipeline': 300,
    'src.utils.scrapy_spider.pipelines.ChromaDBStoragePipeline': 400,
}

# Tor proxy settings
HTTP_PROXY = 'http://127.0.0.1:8118'  # Privoxy forwarding to Tor
HTTPS_PROXY = 'http://127.0.0.1:8118'

# Direct Tor SOCKS settings (alternative to HTTP proxy)
SOCKS_PROXY = 'socks5://127.0.0.1:9050'
TOR_SOCKS_HOST = '127.0.0.1'
TOR_SOCKS_PORT = 9050

# Tor control settings
TOR_CONTROL_PORT = 9051
TOR_CONTROL_PASSWORD = None  # Set from environment in production
TOR_MAX_REQUESTS_PER_CIRCUIT = 10
TOR_MIN_CIRCUIT_LIFESPAN = 30
TOR_ENABLE_RANDOM_ROTATION = True
TOR_RANDOM_ROTATION_CHANCE = 0.2

# Content extraction settings
CONTENT_CHUNK_SIZE = 1000
CONTENT_CHUNK_OVERLAP = 200

# ChromaDB settings
CHROMA_DB_PATH = './data/chroma_db'
CHROMA_COLLECTION_NAME = 'dark_web_content'
EMBEDDING_MODEL_NAME = 'all-MiniLM-L6-v2'

# Log settings
LOG_LEVEL = 'INFO'

# Retry settings
RETRY_ENABLED = True
RETRY_TIMES = 3
RETRY_HTTP_CODES = [500, 502, 503, 504, 408, 429]
RETRY_BACKOFF_FACTOR = 1.5
RETRY_PRIORITY_ADJUST = -1

# Security settings
HTTPERROR_ALLOW_ALL = True  # Don't fail on non-200 responses

# Other settings
FEED_EXPORT_ENCODING = 'utf-8'
TELNETCONSOLE_ENABLED = False
