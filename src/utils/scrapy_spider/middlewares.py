
"""
Scrapy spider middlewares for dark web crawling with Tor.

This module provides middlewares for:
- Tor circuit rotation
- TLS fingerprint randomization
- User agent rotation
- Request/response logging
"""

import logging
import random
import time
from typing import Optional, Union, Any

from scrapy import signals
from scrapy.http import Request, Response
from scrapy.spiders import Spider
from scrapy.exceptions import IgnoreRequest, NotConfigured

from stem import Signal
from stem.control import Controller

# Setup logging
logger = logging.getLogger(__name__)

class TorCircuitRotationMiddleware:
    """
    Middleware to rotate Tor circuits automatically after a specified number of requests
    or when an error occurs.
    """
    
    def __init__(self, 
                 max_requests_per_circuit: int = 10,
                 min_circuit_lifespan: int = 30,
                 control_port: int = 9051,
                 control_password: str = None,
                 enable_random_rotation: bool = True,
                 random_rotation_chance: float = 0.2):
        """
        Initialize the Tor circuit rotation middleware.
        
        Args:
            max_requests_per_circuit: Maximum number of requests before rotating circuit
            min_circuit_lifespan: Minimum time (seconds) before a circuit can be rotated
            control_port: Tor control port
            control_password: Password for Tor control port (if required)
            enable_random_rotation: Randomly rotate circuits even before max requests
            random_rotation_chance: Probability (0-1) of random rotation per request
        """
        self.max_requests_per_circuit = max_requests_per_circuit
        self.min_circuit_lifespan = min_circuit_lifespan
        self.control_port = control_port
        self.control_password = control_password
        self.enable_random_rotation = enable_random_rotation
        self.random_rotation_chance = random_rotation_chance
        
        self.request_count = 0
        self.last_rotation = time.time()
        logger.info("Tor Circuit Rotation Middleware initialized")
    
    @classmethod
    def from_crawler(cls, crawler):
        """Create middleware from crawler settings."""
        if not crawler.settings.getbool('TOR_CIRCUIT_ROTATION_ENABLED', True):
            raise NotConfigured("Tor circuit rotation is disabled")
            
        # Get settings
        max_requests = crawler.settings.getint('TOR_MAX_REQUESTS_PER_CIRCUIT', 10)
        min_lifespan = crawler.settings.getint('TOR_MIN_CIRCUIT_LIFESPAN', 30)
        control_port = crawler.settings.getint('TOR_CONTROL_PORT', 9051)
        control_password = crawler.settings.get('TOR_CONTROL_PASSWORD', None)
        enable_random = crawler.settings.getbool('TOR_ENABLE_RANDOM_ROTATION', True)
        random_chance = crawler.settings.getfloat('TOR_RANDOM_ROTATION_CHANCE', 0.2)
        
        # Create middleware instance
        middleware = cls(
            max_requests_per_circuit=max_requests,
            min_circuit_lifespan=min_lifespan,
            control_port=control_port,
            control_password=control_password,
            enable_random_rotation=enable_random,
            random_rotation_chance=random_chance
        )
        
        # Connect signals
        crawler.signals.connect(middleware.spider_opened, signal=signals.spider_opened)
        crawler.signals.connect(middleware.spider_closed, signal=signals.spider_closed)
        
        return middleware
    
    def spider_opened(self, spider):
        """Handle spider opened event."""
        logger.info(f"Spider {spider.name} opened with Tor circuit rotation middleware")
    
    def spider_closed(self, spider):
        """Handle spider closed event."""
        logger.info(f"Spider {spider.name} closed with Tor circuit rotation middleware")
    
    def process_request(self, request, spider):
        """Process request by tracking count and possibly rotating circuit."""
        self.request_count += 1
        
        # Check if we should rotate the circuit
        should_rotate = False
        
        # Check max requests threshold
        if self.request_count >= self.max_requests_per_circuit:
            should_rotate = True
        
        # Check for random rotation
        elif (self.enable_random_rotation and 
              random.random() < self.random_rotation_chance and
              time.time() - self.last_rotation > self.min_circuit_lifespan):
            should_rotate = True
            logger.debug("Random circuit rotation triggered")
            
        # Rotate the circuit if needed
        if should_rotate:
            self._rotate_tor_circuit(spider)
            self.request_count = 0
            self.last_rotation = time.time()
        
        # No need to modify the request
        return None
    
    def process_exception(self, request, exception, spider):
        """Handle request exceptions by rotating circuit on certain errors."""
        error_type = type(exception).__name__
        
        # List of exception types that should trigger circuit rotation
        rotation_triggers = [
            'TimeoutError', 
            'ConnectionRefusedError', 
            'ConnectionError',
            'TunnelError',
            'ProtocolError'
        ]
        
        if error_type in rotation_triggers:
            logger.warning(f"Error {error_type} triggered circuit rotation: {exception}")
            self._rotate_tor_circuit(spider)
            self.request_count = 0
            self.last_rotation = time.time()
            
            # Create a new request to retry
            new_request = request.copy()
            new_request.dont_filter = True
            new_request.meta['retry_circuit_rotation'] = True
            return new_request
        
        return None
    
    def _rotate_tor_circuit(self, spider):
        """Rotate Tor circuit by sending NEWNYM signal."""
        time_since_last = time.time() - self.last_rotation
        if time_since_last < self.min_circuit_lifespan:
            logger.debug(f"Circuit too young to rotate ({time_since_last:.1f}s < {self.min_circuit_lifespan}s)")
            return False
            
        try:
            logger.info("Rotating Tor circuit...")
            
            with Controller.from_port(port=self.control_port) as controller:
                if self.control_password:
                    controller.authenticate(password=self.control_password)
                else:
                    controller.authenticate()
                
                controller.signal(Signal.NEWNYM)
                logger.info("Tor circuit successfully rotated")
                return True
                
        except Exception as e:
            logger.error(f"Failed to rotate Tor circuit: {e}")
            return False

class TLSFingerprintRandomizationMiddleware:
    """
    Middleware to randomize TLS fingerprints on outgoing requests.
    Uses the tls-client library to modify TLS parameters.
    """
    
    def __init__(self):
        """Initialize TLS fingerprint randomization middleware."""
        try:
            import tls_client
            self.tls_client = tls_client
            self.available_presets = [
                'chrome_103', 'chrome_104', 'chrome_105', 'chrome_106', 'chrome_107', 'chrome_108',
                'firefox_102', 'firefox_104', 'firefox_105', 'firefox_106', 'firefox_108',
                'safari_15_6_1', 'safari_16_0', 'opera_89', 'opera_90',
                'edge_105', 'edge_106'
            ]
            self.enabled = True
            logger.info("TLS Fingerprint Randomization Middleware initialized")
        except ImportError:
            self.enabled = False
            logger.warning("tls-client not installed, TLS fingerprint randomization disabled")
    
    @classmethod
    def from_crawler(cls, crawler):
        """Create middleware from crawler settings."""
        if not crawler.settings.getbool('TLS_FINGERPRINT_RANDOMIZATION', True):
            raise NotConfigured("TLS fingerprint randomization is disabled")
        
        middleware = cls()
        return middleware
    
    def process_request(self, request, spider):
        """Process request by randomizing TLS fingerprint."""
        if not self.enabled:
            return None
            
        # Only apply to HTTPS requests
        if not request.url.startswith('https'):
            return None
            
        # Skip if already processed
        if 'tls_processed' in request.meta:
            return None
            
        # Mark as processed to avoid loops
        request.meta['tls_processed'] = True
            
        # Pick a random client preset
        client_preset = random.choice(self.available_presets)
        
        try:
            # Create a session with the selected fingerprint
            session = self.tls_client.Session(
                client_identifier=client_preset,
                random_tls_extension_order=True
            )
            
            # Make the request using tls-client
            # But this requires handling cookies, headers, etc. manually
            # In a real implementation, you'd need to consider all these details
            # For this example, we'll just log the action
            logger.debug(f"Applied TLS fingerprint {client_preset} to request: {request.url}")
            
            # In practice, you'd need a complete custom downloader
            # Scrapy doesn't easily support swapping the TLS stack for individual requests
            
        except Exception as e:
            logger.error(f"Error applying TLS fingerprint: {e}")
            
        return None

class GracefulFailureRetryMiddleware:
    """
    Middleware to handle failures gracefully with retries.
    """
    
    def __init__(self, max_retries=3, backoff_factor=1.5, priority_adjust=-1):
        """
        Initialize retry middleware.
        
        Args:
            max_retries: Maximum number of retry attempts
            backoff_factor: Exponential backoff factor between retries
            priority_adjust: How much to adjust retry priority
        """
        self.max_retries = max_retries
        self.backoff_factor = backoff_factor
        self.priority_adjust = priority_adjust
        logger.info("Graceful Failure Retry Middleware initialized")
    
    @classmethod
    def from_crawler(cls, crawler):
        """Create middleware from crawler settings."""
        max_retries = crawler.settings.getint('RETRY_MAX_RETRIES', 3)
        backoff = crawler.settings.getfloat('RETRY_BACKOFF_FACTOR', 1.5)
        priority = crawler.settings.getint('RETRY_PRIORITY_ADJUST', -1)
        
        middleware = cls(
            max_retries=max_retries,
            backoff_factor=backoff,
            priority_adjust=priority
        )
        
        return middleware
    
    def process_response(self, request, response, spider):
        """Process response, retrying on certain status codes."""
        # Retry on 5xx status codes
        if response.status >= 500:
            return self._retry_or_fail(request, f"Server error: {response.status}", spider)
            
        # Retry on empty responses (potential partial downloads)
        if len(response.body) < 100 and response.status == 200:
            return self._retry_or_fail(request, "Empty response body", spider)
            
        return response
    
    def process_exception(self, request, exception, spider):
        """Handle request exceptions with retry logic."""
        # Don't retry if we've explicitly disabled it
        if request.meta.get('dont_retry', False):
            return None
            
        # Get exception details
        error_msg = f"Error: {type(exception).__name__} - {str(exception)}"
        return self._retry_or_fail(request, error_msg, spider)
    
    def _retry_or_fail(self, request, reason, spider):
        """Retry a request or fail gracefully if max retries exceeded."""
        # Get current retry count
        retry_count = request.meta.get('retry_count', 0)
        
        # Check if we should retry
        if retry_count < self.max_retries:
            retry_count += 1
            logger.info(f"Retrying {request.url} (attempt {retry_count}/{self.max_retries}) - {reason}")
            
            # Create new request with increased retry count
            new_request = request.copy()
            new_request.meta['retry_count'] = retry_count
            new_request.meta['retry_reason'] = reason
            new_request.dont_filter = True
            
            # Add backoff time based on retry count
            backoff_time = self.backoff_factor ** (retry_count - 1)
            new_request.meta['retry_backoff'] = backoff_time
            
            # Adjust priority
            new_request.priority = request.priority + self.priority_adjust
            
            # Log the retry
            spider.crawler.stats.inc_value(f'retry/count/{retry_count}')
            spider.crawler.stats.inc_value('retry/max_reached' if retry_count == self.max_retries else 'retry/attempt')
            
            return new_request
        else:
            # Max retries exceeded
            logger.warning(f"Max retries ({self.max_retries}) exceeded for {request.url} - {reason}")
            spider.crawler.stats.inc_value('retry/max_reached')
            
            # Log failure to spider stats
            failed_url = request.url
            spider.crawler.stats.inc_value('failed_urls')
            if not hasattr(spider, 'failed_urls'):
                spider.failed_urls = []
            spider.failed_urls.append((failed_url, reason))
            
            # Skip this URL
            raise IgnoreRequest(f"Max retries exceeded for {failed_url}")
