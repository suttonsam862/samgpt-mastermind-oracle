
"""
Dark Web Ingestion Module for SamGPT using TorPy and Chroma

This module implements an offline dark-web ingestion service that:
1. Connects to the Tor network using TorPy
2. Fetches content from .onion URLs
3. Processes and chunks the text
4. Embeds the chunks using SentenceTransformer
5. Stores the embeddings in a local Chroma database
"""

import os
import json
import time
import logging
from typing import List, Dict, Any, Optional
import hashlib

# Try to import required packages
try:
    from torpy.http.requests import TorRequests
    from bs4 import BeautifulSoup
    import chromadb
    from sentence_transformers import SentenceTransformer
except ImportError:
    print("Required packages not found. Installing dependencies...")
    import subprocess
    subprocess.check_call([
        "pip", "install", 
        "torpy", "beautifulsoup4", "chromadb", "sentence-transformers"
    ])
    # Now import after installation
    from torpy.http.requests import TorRequests
    from bs4 import BeautifulSoup
    import chromadb
    from sentence_transformers import SentenceTransformer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("dark_web_ingestion")

# Constants
CHUNK_SIZE = 1000  # Target token size for chunks
OVERLAP = 200      # Overlap between chunks
MODEL_NAME = "all-MiniLM-L6-v2"
COLLECTION_NAME = "samgpt"
PERSISTENCE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chroma_db")

class DarkWebIngestion:
    def __init__(self):
        """Initialize the ingestion module with Chroma DB and sentence transformer."""
        # Ensure persistence directory exists
        os.makedirs(PERSISTENCE_DIR, exist_ok=True)
        
        logger.info(f"Initializing Chroma client with persistence at {PERSISTENCE_DIR}")
        self.chroma_client = chromadb.PersistentClient(path=PERSISTENCE_DIR)
        
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
    
    def ingest_onion(self, url_list: List[str], timeout: int = 60) -> Dict[str, Any]:
        """
        Fetch content from .onion URLs through Tor, process text, and store in Chroma.
        
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
        valid_urls = [url for url in url_list if url.endswith(".onion")]
        if len(valid_urls) < len(url_list):
            non_onion = len(url_list) - len(valid_urls)
            logger.warning(f"Skipping {non_onion} non-.onion URLs")
            stats["urls_skipped"] += non_onion
        
        if not valid_urls:
            logger.error("No valid .onion URLs to process")
            stats["errors"].append("No valid .onion URLs provided")
            return stats
        
        # Initialize Tor
        logger.info(f"Initializing Tor connection for {len(valid_urls)} URLs")
        try:
            with TorRequests() as tor_requests:
                # Process each URL
                for url in valid_urls:
                    if self.is_already_ingested(url):
                        logger.info(f"URL already ingested, skipping: {url}")
                        stats["urls_skipped"] += 1
                        continue
                        
                    try:
                        logger.info(f"Fetching: {url}")
                        # Create a Tor circuit and session
                        with tor_requests.get_session() as session:
                            response = session.get(url, timeout=timeout)
                            
                            if response.status_code != 200:
                                logger.warning(f"Failed to fetch {url}: Status {response.status_code}")
                                stats["errors"].append(f"Status {response.status_code} for {url}")
                                continue
                            
                            # Parse HTML with BeautifulSoup
                            soup = BeautifulSoup(response.text, 'html.parser')
                            
                            # Extract title if available
                            title = soup.title.string if soup.title else "Untitled"
                            
                            # Remove script and style elements
                            for script in soup(["script", "style"]):
                                script.extract()
                                
                            # Get text content
                            text = soup.get_text(separator=' ', strip=True)
                            
                            if not text:
                                logger.warning(f"No text content found at {url}")
                                stats["errors"].append(f"Empty content for {url}")
                                continue
                            
                            # Generate chunks
                            chunks = self.chunk_text(text)
                            logger.info(f"Created {len(chunks)} chunks from {url}")
                            
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
                                    "source_url": url,
                                    "source_url_hash": url_hash,
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
                            logger.info(f"Successfully ingested {url} with {len(chunks)} chunks")
                    
                    except Exception as e:
                        logger.error(f"Error processing {url}: {str(e)}")
                        stats["errors"].append(f"Error for {url}: {str(e)}")
        
        except Exception as e:
            logger.error(f"Error initializing Tor: {str(e)}")
            stats["errors"].append(f"Tor error: {str(e)}")
        
        logger.info(f"Ingestion complete. Processed {stats['urls_processed']} URLs with {stats['chunks_ingested']} chunks.")
        return stats

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

def main(url_file: str = None, urls: List[str] = None):
    """
    Entry point for dark web ingestion.
    
    Args:
        url_file: Path to a file containing URLs (JSON array or one URL per line)
        urls: List of URLs to ingest (alternative to url_file)
    """
    url_list = []
    
    # Get URLs from file if specified
    if url_file:
        url_list = load_url_list(url_file)
        logger.info(f"Loaded {len(url_list)} URLs from {url_file}")
    
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
    
    args = parser.parse_args()
    
    if not args.file and not args.url:
        parser.error("No URLs provided. Use --file or --url")
    
    main(url_file=args.file, urls=args.url)
