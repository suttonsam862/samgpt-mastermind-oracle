
"""
Scrapy pipelines for content extraction, cleaning, and storage.

This module provides pipelines for:
- Main content extraction using readability-lxml
- HTML sanitization
- Content chunking
- Embedding generation
- Storage to ChromaDB
"""

import logging
import time
import os
import hashlib
from typing import Dict, List, Tuple, Optional, Any, Union
import re

from scrapy.exceptions import DropItem
import lxml.html
from lxml.html.clean import Cleaner

# Import readability for content extraction
try:
    from readability import Document
except ImportError:
    Document = None
    logging.error("readability-lxml package not installed, content extraction disabled")

# Setup logging
logger = logging.getLogger(__name__)

class ContentExtractionPipeline:
    """
    Pipeline for extracting main article content from HTML documents
    using readability-lxml.
    """
    
    def __init__(self):
        """Initialize content extraction pipeline."""
        self.readability_available = Document is not None
        if not self.readability_available:
            logger.error("ContentExtractionPipeline requires readability-lxml")
        logger.info("Content Extraction Pipeline initialized")
    
    @classmethod
    def from_crawler(cls, crawler):
        """Create pipeline from crawler settings."""
        return cls()
    
    def process_item(self, item, spider):
        """
        Extract main article content from item's HTML.
        
        Args:
            item: Scrapy item with HTML body
            spider: Current spider
            
        Returns:
            Item with extracted content added
        """
        if not self.readability_available:
            # Skip processing if readability is not available
            return item
            
        # Get HTML from item
        html = item.get('html')
        if not html:
            raise DropItem("Item has no HTML content")
            
        try:
            # Parse with readability
            doc = Document(html)
            
            # Extract title and main content
            item['title'] = doc.title()
            item['content'] = doc.summary()
            item['text'] = self._html_to_text(doc.summary())
            
            # Extract metadata
            item['readability_score'] = getattr(doc, 'score', 0)
            item['extraction_time'] = time.time()
            
            logger.debug(f"Extracted content from {item.get('url', 'unknown')}: {len(item['text'])} chars")
            return item
            
        except Exception as e:
            logger.error(f"Error extracting content: {e}")
            
            # Fallback to simple extraction if readability fails
            item['content'] = html
            item['text'] = self._html_to_text(html)
            item['readability_score'] = 0
            item['extraction_time'] = time.time()
            item['extraction_error'] = str(e)
            
            return item
    
    def _html_to_text(self, html_content):
        """Convert HTML to plain text by stripping tags."""
        try:
            # Parse HTML
            doc = lxml.html.fromstring(html_content)
            
            # Create cleaner to remove scripts, styles, etc.
            cleaner = Cleaner(
                scripts=True,
                javascript=True,
                style=True,
                inline_style=True,
                links=True,
                meta=True,
                page_structure=False,
                processing_instructions=True,
                embedded=True,
                frames=True,
                forms=True,
                annoying_tags=True,
                remove_unknown_tags=True
            )
            
            # Apply cleaner
            doc = cleaner.clean_html(doc)
            
            # Extract text with proper spacing
            text_parts = []
            
            # Process text nodes with their parent tags for better context
            for element in doc.iter():
                if element.text and element.text.strip():
                    text_parts.append(element.text.strip())
                if element.tail and element.tail.strip():
                    text_parts.append(element.tail.strip())
            
            # Join with space and normalize whitespace
            text = ' '.join(text_parts)
            text = re.sub(r'\s+', ' ', text).strip()
            
            return text
            
        except Exception as e:
            logger.error(f"Error converting HTML to text: {e}")
            
            # Very basic fallback
            text = re.sub(r'<[^>]+>', ' ', html_content)
            text = re.sub(r'\s+', ' ', text).strip()
            
            return text

class HTMLSanitizationPipeline:
    """
    Pipeline for sanitizing HTML to prevent XSS and other attacks.
    """
    
    def __init__(self):
        """Initialize HTML sanitization pipeline."""
        self.cleaner = Cleaner(
            scripts=True,
            javascript=True,
            comments=True,
            style=True,
            inline_style=True,
            links=True,
            meta=True,
            page_structure=False,
            processing_instructions=True,
            embedded=True,
            frames=True,
            forms=True,
            annoying_tags=True,
            remove_unknown_tags=True,
            safe_attrs_only=True,
            safe_attrs=frozenset(['src', 'alt', 'title', 'href', 'class'])
        )
        logger.info("HTML Sanitization Pipeline initialized")
    
    @classmethod
    def from_crawler(cls, crawler):
        """Create pipeline from crawler settings."""
        return cls()
    
    def process_item(self, item, spider):
        """
        Sanitize HTML content in item.
        
        Args:
            item: Scrapy item with HTML content
            spider: Current spider
            
        Returns:
            Item with sanitized HTML
        """
        # Get HTML from item
        html = item.get('html')
        if not html:
            return item
            
        try:
            # Parse HTML
            doc = lxml.html.fromstring(html)
            
            # Apply cleaner
            clean_doc = self.cleaner.clean_html(doc)
            
            # Convert back to string
            item['sanitized_html'] = lxml.html.tostring(clean_doc, encoding='unicode')
            
            logger.debug(f"Sanitized HTML for {item.get('url', 'unknown')}")
            return item
            
        except Exception as e:
            logger.error(f"Error sanitizing HTML: {e}")
            item['sanitized_html'] = ''
            item['sanitization_error'] = str(e)
            
            return item

class ContentChunkingPipeline:
    """
    Pipeline for chunking text content into smaller pieces for embedding.
    """
    
    def __init__(self, chunk_size=1000, chunk_overlap=200):
        """
        Initialize content chunking pipeline.
        
        Args:
            chunk_size: Target size of each chunk (approximate)
            chunk_overlap: Overlap between chunks
        """
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        logger.info(f"Content Chunking Pipeline initialized (size={chunk_size}, overlap={chunk_overlap})")
    
    @classmethod
    def from_crawler(cls, crawler):
        """Create pipeline from crawler settings."""
        chunk_size = crawler.settings.getint('CONTENT_CHUNK_SIZE', 1000)
        chunk_overlap = crawler.settings.getint('CONTENT_CHUNK_OVERLAP', 200)
        return cls(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    
    def process_item(self, item, spider):
        """
        Chunk text content in item.
        
        Args:
            item: Scrapy item with text content
            spider: Current spider
            
        Returns:
            Item with chunks added
        """
        # Get text from item
        text = item.get('text')
        if not text:
            return item
            
        try:
            # Chunk the text
            chunks = self._chunk_text(text)
            
            # Add chunks to item
            item['chunks'] = chunks
            item['chunk_count'] = len(chunks)
            
            logger.debug(f"Created {len(chunks)} chunks for {item.get('url', 'unknown')}")
            return item
            
        except Exception as e:
            logger.error(f"Error chunking text: {e}")
            item['chunks'] = [text]  # Fallback to single chunk
            item['chunk_count'] = 1
            item['chunking_error'] = str(e)
            
            return item
    
    def _chunk_text(self, text):
        """
        Split text into chunks of approximately chunk_size tokens with overlap.
        
        A simple approximation: average English word is ~5 characters
        and ~4.7 words per token.
        """
        # Split into words
        words = text.split()
        if not words:
            return []
            
        # Estimate words per chunk
        words_per_chunk = self.chunk_size // 5
        words_overlap = self.chunk_overlap // 5
        
        chunks = []
        
        # Create chunks with overlap
        for i in range(0, len(words), words_per_chunk - words_overlap):
            chunk = ' '.join(words[i:i + words_per_chunk])
            if chunk:  # Ensure we don't add empty chunks
                chunks.append(chunk)
                
        return chunks

class ChromaDBStoragePipeline:
    """
    Pipeline for storing extracted content in ChromaDB.
    """
    
    def __init__(self, chroma_db_path, collection_name, model_name):
        """
        Initialize ChromaDB storage pipeline.
        
        Args:
            chroma_db_path: Path to ChromaDB database
            collection_name: Name of collection to store data
            model_name: Name of embedding model to use
        """
        self.chroma_db_path = chroma_db_path
        self.collection_name = collection_name
        self.model_name = model_name
        self.chroma_client = None
        self.collection = None
        self.model = None
        logger.info(f"ChromaDB Storage Pipeline initialized")
    
    @classmethod
    def from_crawler(cls, crawler):
        """Create pipeline from crawler settings."""
        chroma_db_path = crawler.settings.get('CHROMA_DB_PATH', './data/chroma_db')
        collection_name = crawler.settings.get('CHROMA_COLLECTION_NAME', 'dark_web_content')
        model_name = crawler.settings.get('EMBEDDING_MODEL_NAME', 'all-MiniLM-L6-v2')
        
        return cls(
            chroma_db_path=chroma_db_path,
            collection_name=collection_name,
            model_name=model_name
        )
    
    def open_spider(self, spider):
        """Initialize ChromaDB and embedding model when spider opens."""
        try:
            # Import required packages
            import chromadb
            from sentence_transformers import SentenceTransformer
            
            # Create directory if it doesn't exist
            os.makedirs(self.chroma_db_path, exist_ok=True)
            
            # Initialize ChromaDB client
            self.chroma_client = chromadb.PersistentClient(path=self.chroma_db_path)
            
            # Get or create collection
            try:
                self.collection = self.chroma_client.get_collection(self.collection_name)
                logger.info(f"Using existing ChromaDB collection: {self.collection_name}")
            except Exception:
                self.collection = self.chroma_client.create_collection(
                    name=self.collection_name,
                    metadata={"description": "Dark Web content repository"}
                )
                logger.info(f"Created new ChromaDB collection: {self.collection_name}")
            
            # Initialize embedding model
            self.model = SentenceTransformer(self.model_name)
            logger.info(f"Initialized embedding model: {self.model_name}")
            
        except ImportError as e:
            logger.error(f"Required package not available: {e}")
            self.chroma_client = None
            self.collection = None
            self.model = None
            
        except Exception as e:
            logger.error(f"Error initializing ChromaDB storage: {e}")
            self.chroma_client = None
            self.collection = None
            self.model = None
    
    def close_spider(self, spider):
        """Close connections when spider closes."""
        logger.info("Closing ChromaDB Storage Pipeline")
    
    def process_item(self, item, spider):
        """
        Store item chunks in ChromaDB.
        
        Args:
            item: Scrapy item with chunks
            spider: Current spider
            
        Returns:
            Item (unchanged)
        """
        # Skip if not initialized properly
        if not self.chroma_client or not self.collection or not self.model:
            logger.warning("ChromaDB storage not initialized, skipping storage")
            return item
            
        # Get chunks from item
        chunks = item.get('chunks')
        if not chunks:
            return item
            
        url = item.get('url', 'unknown')
        title = item.get('title', 'Untitled')
        
        try:
            # Generate embeddings for all chunks
            embeddings = self.model.encode(chunks)
            
            # Create a unique identifier for this URL
            url_hash = hashlib.sha256(url.encode()).hexdigest()
            
            # Prepare data for batch insertion
            ids = []
            metadatas = []
            documents = []
            
            # Process each chunk
            for idx, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
                chunk_id = f"{url_hash}_{idx}"
                
                metadata = {
                    "source_url_hash": url_hash,
                    "title": title,
                    "chunk_index": idx,
                    "total_chunks": len(chunks),
                    "timestamp": time.time()
                }
                
                ids.append(chunk_id)
                metadatas.append(metadata)
                documents.append(chunk)
            
            # Add to collection in batch
            self.collection.add(
                ids=ids,
                embeddings=embeddings.tolist(),
                metadatas=metadatas,
                documents=documents
            )
            
            logger.info(f"Stored {len(chunks)} chunks for {url}")
            
            # Add storage info to item
            item['stored_chunks'] = len(chunks)
            item['storage_timestamp'] = time.time()
            
            return item
            
        except Exception as e:
            logger.error(f"Error storing chunks in ChromaDB: {e}")
            item['storage_error'] = str(e)
            return item
