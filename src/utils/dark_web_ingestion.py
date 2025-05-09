
"""
Dark Web Ingestion Module for SamGPT using TorPy and Chroma

This module implements an offline dark-web ingestion service with ultimate stealth mode:
1. Connects to the Tor network using multi-hop circuits
2. Implements TLS fingerprint randomization
3. Randomizes User-Agent and HTTP headers
4. Uses I2P as fallback transport
5. Fetches content from .onion URLs with maximum anonymity
6. Processes and chunks the text
7. Embeds the chunks using SentenceTransformer
8. Stores the embeddings in a local Chroma database

Enhanced with security features:
1. HTML sanitization to prevent XSS and injection attacks
2. Vault integration for secrets management
3. Structured logging with sensitive data redaction
4. Anomaly detection and alerting
"""

import os
import json
import time
import logging
from typing import List, Dict, Any, Optional
import hashlib
import re
from functools import wraps
import traceback
import requests
import html
import sys
import random
from urllib.parse import urlparse

# Import the stealth networking module
from stealth_net import StealthSession, randomize_environment_variables

# Import the Vault integration
from vault_integration import get_tor_credentials, get_database_config, get_webhook_url

# Environment variable configuration with defaults from Vault or environment
tor_creds = get_tor_credentials()
db_config = get_database_config()
TOR_SOCKS_HOST = tor_creds["socks_host"]
TOR_SOCKS_PORT = int(tor_creds["socks_port"])
CHROMA_DB_PATH = db_config["path"]
COLLECTION_NAME = db_config["collection"]
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "1000"))
OVERLAP = int(os.getenv("OVERLAP", "200"))
MODEL_NAME = os.getenv("MODEL_NAME", "all-MiniLM-L6-v2")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
WEBHOOK_URL = get_webhook_url()

# Stealth mode configuration
USE_STEALTH_MODE = os.getenv("USE_STEALTH_MODE", "false").lower() == "true"
USE_MULTI_HOP = os.getenv("USE_MULTI_HOP", "false").lower() == "true"
CIRCUIT_HOPS = int(os.getenv("CIRCUIT_HOPS", "3"))
USE_TLS_FINGERPRINT_RANDOMIZATION = os.getenv("USE_TLS_FINGERPRINT_RANDOMIZATION", "false").lower() == "true"
USE_I2P_FALLBACK = os.getenv("USE_I2P_FALLBACK", "false").lower() == "true"
TOR2_SOCKS_HOST = os.getenv("TOR2_SOCKS_HOST", TOR_SOCKS_HOST)
TOR2_SOCKS_PORT = int(os.getenv("TOR2_SOCKS_PORT", "9051"))
TOR3_SOCKS_HOST = os.getenv("TOR3_SOCKS_HOST", TOR_SOCKS_HOST)
TOR3_SOCKS_PORT = int(os.getenv("TOR3_SOCKS_PORT", "9052"))
I2P_HTTP_PROXY = os.getenv("I2P_HTTP_PROXY", "i2p:4444")

# Configure logging based on environment
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL.upper()),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(os.getenv("LOG_FILE", "dark_web_ingestion.log")),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("dark_web_ingestion")

# Make sure we don't log sensitive data
class SensitiveFilter(logging.Filter):
    def filter(self, record):
        if record.getMessage().find('.onion') != -1:
            # Redact full onion URLs in logs
            record.msg = re.sub(r'([a-z2-7]{16,56}\.onion)', '[REDACTED_ONION]', record.msg)
        # Also redact IP addresses
        if isinstance(record.msg, str):
            record.msg = re.sub(r'((?:\d{1,3}\.){3}\d{1,3})', '[REDACTED_IP]', record.msg)
        return True

logger.addFilter(SensitiveFilter())

# Try to import required packages
try:
    from torpy.http.requests import TorRequests
    from bs4 import BeautifulSoup
    import chromadb
    from sentence_transformers import SentenceTransformer
except ImportError as e:
    logger.error(f"Required package not found: {str(e)}")
    logger.info("Installing dependencies...")
    import subprocess
    try:
        subprocess.check_call([
            "pip", "install", 
            "torpy>=1.1.6", "beautifulsoup4>=4.12.2", "chromadb>=0.4.18", 
            "sentence-transformers>=2.2.2", "requests>=2.31.0",
            "stem>=1.8.1", "tls-client>=0.2.0", "pysocks>=1.7.1"
        ])
        # Now import after installation
        from torpy.http.requests import TorRequests
        from bs4 import BeautifulSoup
        import chromadb
        from sentence_transformers import SentenceTransformer
    except Exception as install_error:
        logger.critical(f"Failed to install dependencies: {str(install_error)}")
        sys.exit(1)

def alert_on_anomaly(description, details=None):
    """Send alerts for anomalies through webhook or logging"""
    logger.warning(f"ANOMALY: {description}")
    
    if details:
        logger.warning(f"Details: {json.dumps(details)}")
        
    if WEBHOOK_URL:
        try:
            requests.post(
                WEBHOOK_URL, 
                json={"event": "anomaly", "description": description, "details": details},
                timeout=5
            )
        except Exception as e:
            logger.error(f"Failed to send webhook alert: {str(e)}")

def anomaly_detector(func):
    """Decorator to catch and report anomalies in functions"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.time()
        try:
            result = func(*args, **kwargs)
            execution_time = time.time() - start_time
            
            # Check for anomalies in execution time
            if execution_time > 300:  # More than 5 minutes
                alert_on_anomaly(
                    f"Function {func.__name__} took too long to execute",
                    {"execution_time": execution_time, "function": func.__name__}
                )
                
            return result
        except Exception as e:
            alert_on_anomaly(
                f"Exception in {func.__name__}: {str(e)}",
                {"traceback": traceback.format_exc(), "function": func.__name__}
            )
            raise
    return wrapper

class DarkWebIngestion:
    def __init__(self):
        """Initialize the ingestion module with Chroma DB and sentence transformer."""
        # Set random environment variables for fingerprint diversity
        if USE_STEALTH_MODE:
            randomize_environment_variables()
            logger.info("Stealth mode enabled with randomized environment")
        
        # Ensure persistence directory exists
        os.makedirs(CHROMA_DB_PATH, exist_ok=True)
        
        logger.info(f"Initializing Chroma client with persistence at {CHROMA_DB_PATH}")
        self.chroma_client = chromadb.PersistentClient(path=CHROMA_DB_PATH)
        
        # Get or create the collection
        try:
            self.collection = self.chroma_client.get_collection(COLLECTION_NAME)
            logger.info(f"Using existing collection '{COLLECTION_NAME}'")
        except ValueError:
            logger.info(f"Creating new collection '{COLLECTION_NAME}'")
            self.collection = self.chroma_client.create_collection(
                name=COLLECTION_NAME,
                metadata={"description": "SamGPT Dark Web content repository"}
            )
        
        logger.info(f"Loading sentence transformer model: {MODEL_NAME}")
        self.model = SentenceTransformer(MODEL_NAME)
        
        # Initialize stealth session if enabled
        if USE_STEALTH_MODE:
            self.stealth_session = StealthSession(
                tor_socks_host=TOR_SOCKS_HOST,
                tor_socks_port=TOR_SOCKS_PORT,
                tor_control_port=int(os.getenv("TOR_CONTROL_PORT", "9051")),
                tor_password=os.getenv("TOR_PASSWORD", None),
                i2p_http_proxy=I2P_HTTP_PROXY,
                circuit_hops=CIRCUIT_HOPS
            )
            logger.info(f"Stealth session initialized with {CIRCUIT_HOPS} Tor hops")
    
    def chunk_text(self, text: str) -> List[str]:
        """
        Split text into chunks of approximately CHUNK_SIZE tokens with OVERLAP.
        
        This is a simple approximation - in production you'd want a more 
        sophisticated chunking strategy.
        """
        # Simple approximation: average English word is ~5 characters
        # and ~4.7 words per token
        words = text.split()
        chunks = []
        
        # Estimate words per chunk (rough approximation)
        words_per_chunk = CHUNK_SIZE // 5
        words_overlap = OVERLAP // 5
        
        for i in range(0, len(words), words_per_chunk - words_overlap):
            chunk = " ".join(words[i:i + words_per_chunk])
            if chunk:  # Ensure we don't add empty chunks
                chunks.append(chunk)
                
        return chunks
    
    def sanitize_html(self, html_content: str) -> str:
        """Sanitize HTML content to prevent XSS and injection attacks"""
        # Use BeautifulSoup to parse and clean HTML
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Remove potentially dangerous elements
        for tag in soup.find_all(['script', 'iframe', 'object', 'embed', 'form']):
            tag.decompose()
            
        # Remove event handlers from all remaining tags
        for tag in soup.find_all(True):
            for attr in list(tag.attrs):
                if attr.startswith('on'):
                    del tag[attr]
                # Remove javascript: URLs
                elif attr == 'href' or attr == 'src':
                    if tag[attr].startswith('javascript:'):
                        del tag[attr]
                        
        # Get the sanitized text
        sanitized_text = soup.get_text(separator=' ', strip=True)
        
        # Additional HTML entity decoding
        sanitized_text = html.unescape(sanitized_text)
        
        return sanitized_text
    
    def url_to_id(self, url: str) -> str:
        """Create a deterministic ID from a URL."""
        return hashlib.sha256(url.encode()).hexdigest()
    
    def is_already_ingested(self, url: str) -> bool:
        """Check if URL has already been ingested by querying metadata."""
        url_id = self.url_to_id(url)
        # Query with empty embedding list to just check metadata
        result = self.collection.get(
            where={"source_url_hash": url_id},
            limit=1
        )
        return len(result["ids"]) > 0
    
    def validate_onion_url(self, url: str) -> bool:
        """Validate if a URL is a proper .onion address"""
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
    
    @anomaly_detector
    def ingest_onion(self, url_list: List[str], timeout: int = 60) -> Dict[str, Any]:
        """
        Fetch content from .onion URLs through Tor, process text, and store in Chroma.
        
        In stealth mode, uses multi-hop circuits, TLS fingerprint randomization,
        and I2P fallback for maximum anonymity.
        
        Args:
            url_list: List of .onion URLs to ingest
            timeout: Request timeout in seconds
            
        Returns:
            Dictionary with statistics about the ingestion process
        """
        stats = {
            "urls_total": len(url_list),
            "urls_processed": 0,
            "urls_skipped": 0,
            "chunks_ingested": 0,
            "errors": []
        }
        
        # Validate URLs
        valid_urls = [url for url in url_list if self.validate_onion_url(url)]
        if len(valid_urls) < len(url_list):
            non_onion = len(url_list) - len(valid_urls)
            logger.warning(f"Skipping {non_onion} invalid URLs")
            stats["urls_skipped"] += non_onion
            stats["errors"].append(f"Skipped {non_onion} invalid URLs")
        
        if not valid_urls:
            logger.error("No valid .onion URLs to process")
            stats["errors"].append("No valid .onion URLs provided")
            return stats
        
        # Process each URL using appropriate anonymity method
        if USE_STEALTH_MODE:
            logger.info(f"Using stealth mode for {len(valid_urls)} URLs")
            return self._ingest_with_stealth(valid_urls, timeout, stats)
        else:
            logger.info(f"Using standard Tor for {len(valid_urls)} URLs")
            return self._ingest_with_standard_tor(valid_urls, timeout, stats)
            
    def _ingest_with_stealth(self, url_list: List[str], timeout: int, stats: Dict[str, Any]) -> Dict[str, Any]:
        """Process URLs using stealth mode with multi-hop circuits and fingerprint randomization"""
        for url in url_list:
            if self.is_already_ingested(url):
                logger.info("URL already ingested, skipping (URL redacted)")
                stats["urls_skipped"] += 1
                continue
                
            try:
                logger.info("Fetching URL via stealth transport (redacted for security)")
                
                # Use our stealth session that handles circuit rotation, TLS randomization, etc.
                response = self.stealth_session.get(url, timeout=timeout)
                
                if response.status_code != 200:
                    logger.warning(f"Failed to fetch URL: Status {response.status_code}")
                    stats["errors"].append(f"Status {response.status_code} for URL")
                    continue
                
                # Process the response same as standard method
                self._process_response(response, url, stats)
                
            except Exception as e:
                logger.error(f"Error processing URL: {str(e)}")
                stats["errors"].append(f"Error: {str(e)}")
        
        return stats
    
    def _ingest_with_standard_tor(self, url_list: List[str], timeout: int, stats: Dict[str, Any]) -> Dict[str, Any]:
        """Process URLs using standard TorPy approach"""
        # Initialize Tor using credentials from Vault
        logger.info(f"Initializing Tor connection for {len(url_list)} URLs")
        try:
            with TorRequests(socks_port=TOR_SOCKS_PORT, socks_host=TOR_SOCKS_HOST) as tor_requests:
                # Process each URL
                for url in url_list:
                    if self.is_already_ingested(url):
                        logger.info("URL already ingested, skipping (URL redacted)")
                        stats["urls_skipped"] += 1
                        continue
                        
                    try:
                        logger.info("Fetching URL (redacted for security)")
                        # Create a Tor circuit and session
                        with tor_requests.get_session() as session:
                            # Set a user-agent to avoid fingerprinting
                            headers = {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; rv:91.0) Gecko/20100101 Firefox/91.0'
                            }
                            
                            response = session.get(url, timeout=timeout, headers=headers)
                            
                            if response.status_code != 200:
                                logger.warning(f"Failed to fetch URL: Status {response.status_code}")
                                stats["errors"].append(f"Status {response.status_code} for URL")
                                continue
                            
                            # Process the response
                            self._process_response(response, url, stats)
                    
                    except Exception as e:
                        logger.error(f"Error processing URL: {str(e)}")
                        stats["errors"].append(f"Error: {str(e)}")
        
        except Exception as e:
            logger.error(f"Error initializing Tor: {str(e)}")
            stats["errors"].append(f"Tor error: {str(e)}")
        
        logger.info(f"Ingestion complete. Processed {stats['urls_processed']} URLs with {stats['chunks_ingested']} chunks.")
        return stats
    
    def _process_response(self, response, url: str, stats: Dict[str, Any]):
        """Process an HTTP response and store the content in ChromaDB"""
        content_length = len(response.text)
        
        # Check for anomalously large responses
        if content_length > 5000000:  # > 5MB
            alert_on_anomaly(
                "Oversized response detected",
                {"size_bytes": content_length}
            )
        
        # Sanitize HTML before parsing
        sanitized_html = self.sanitize_html(response.text)
        
        # Parse HTML with BeautifulSoup
        soup = BeautifulSoup(sanitized_html, 'html.parser')
        
        # Extract title if available
        title = soup.title.string if soup.title else "Untitled"
        title = title[:200]  # Limit title length
            
        # Get text content
        text = soup.get_text(separator=' ', strip=True)
        
        if not text or len(text) < 50:
            logger.warning("No meaningful text content found at URL")
            stats["errors"].append("Empty or minimal content")
            return
        
        # Generate chunks
        chunks = self.chunk_text(text)
        logger.info(f"Created {len(chunks)} chunks from URL")
        
        # Check for anomalously small chunking result
        if len(text) > 10000 and len(chunks) < 2:
            alert_on_anomaly(
                "Chunking anomaly detected",
                {"text_length": len(text), "chunk_count": len(chunks)}
            )
        
        # Generate embeddings for all chunks at once (more efficient)
        embeddings = self.model.encode(chunks)
        
        # Create a unique identifier for this URL
        url_hash = self.url_to_id(url)
        
        # Prepare IDs, metadatas, and documents for batch insertion
        ids = []
        metadatas = []
        documents = []
        
        for idx, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            chunk_id = f"{url_hash}_{idx}"
            metadata = {
                "source_url_hash": url_hash,  # Store hash instead of actual URL
                "title": title,
                "chunk_index": idx,
                "total_chunks": len(chunks),
                "timestamp": time.time()
            }
            
            ids.append(chunk_id)
            metadatas.append(metadata)
            documents.append(chunk)
        
        # Add to collection in a single batch operation
        self.collection.add(
            ids=ids,
            embeddings=embeddings.tolist(),
            metadatas=metadatas,
            documents=documents
        )
        
        stats["chunks_ingested"] += len(chunks)
        stats["urls_processed"] += 1
        logger.info(f"Successfully ingested URL with {len(chunks)} chunks")

def load_url_list(file_path: str) -> List[str]:
    """
    Load URLs from a file.
    Supports JSON arrays and plain text files (one URL per line).
    """
    if not os.path.exists(file_path):
        logger.error(f"File not found: {file_path}")
        return []
    
    with open(file_path, 'r') as f:
        content = f.read().strip()
        
        # Try to parse as JSON
        if content.startswith('[') and content.endswith(']'):
            try:
                return json.loads(content)
            except json.JSONDecodeError:
                pass
        
        # Fall back to text file parsing (one URL per line)
        return [line.strip() for line in content.split('\n') if line.strip()]

@anomaly_detector
def main(url_file: str = None, urls: List[str] = None, stealth_mode: bool = False):
    """
    Entry point for dark web ingestion.
    
    Args:
        url_file: Path to a file containing URLs (JSON array or one URL per line)
        urls: List of URLs to ingest (alternative to url_file)
        stealth_mode: Use enhanced stealth mode with multi-hop circuits
    """
    # Enable stealth mode if specified
    if stealth_mode:
        os.environ["USE_STEALTH_MODE"] = "true"
        os.environ["USE_MULTI_HOP"] = "true"
        os.environ["USE_TLS_FINGERPRINT_RANDOMIZATION"] = "true"
        os.environ["USE_I2P_FALLBACK"] = "true"
    
    url_list = []
    
    # Get URLs from file if specified
    if url_file:
        url_list = load_url_list(url_file)
        logger.info(f"Loaded {len(url_list)} URLs from file")
    
    # Use provided URL list if given
    if urls:
        url_list.extend(urls)
        logger.info(f"Added {len(urls)} URLs from direct input")
    
    # Validate we have URLs to process
    if not url_list:
        logger.error("No URLs to process. Provide either url_file or urls.")
        return
    
    # Initialize and run ingestion
    ingestion = DarkWebIngestion()
    stats = ingestion.ingest_onion(url_list)
    
    # Report results
    logger.info(f"Ingestion summary:")
    logger.info(f"- Total URLs: {stats['urls_total']}")
    logger.info(f"- Processed: {stats['urls_processed']}")
    logger.info(f"- Skipped: {stats['urls_skipped']}")
    logger.info(f"- Chunks ingested: {stats['chunks_ingested']}")
    
    if stats['errors']:
        logger.warning(f"Encountered {len(stats['errors'])} errors")
        for error in stats['errors'][:5]:  # Show first 5 errors
            logger.warning(f"- {error}")
        
        if len(stats['errors']) > 5:
            logger.warning(f"- ... and {len(stats['errors']) - 5} more errors")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Dark Web Content Ingestion Tool")
    parser.add_argument("--file", "-f", help="Path to file containing .onion URLs")
    parser.add_argument("--url", "-u", action="append", help="Direct .onion URL to ingest (can be used multiple times)")
    parser.add_argument("--stealth-mode", action="store_true", help="Use enhanced stealth features")
    
    args = parser.parse_args()
    
    if not args.file and not args.url:
        parser.error("No URLs provided. Use --file or --url")
    
    main(url_file=args.file, urls=args.url, stealth_mode=args.stealth_mode)
