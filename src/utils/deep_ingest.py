
"""
Deep Explorer Integration Module for Dark Web URL Discovery

This module integrates the Deep Explorer tool to discover .onion URLs
based on search queries, then feeds them into our ingestion pipeline.
"""

import os
import subprocess
import logging
import time
from typing import List, Optional, Dict, Any
import re
import json
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("deep_ingest")

# Path to Deep Explorer directory
DEEP_EXPLORER_PATH = os.path.join(os.path.dirname(__file__), '../../crawlers/deep_explorer')

def discover_onions(query: str, limit: int = 50) -> List[str]:
    """
    Discover .onion URLs by crawling the dark web using Deep Explorer.
    
    Args:
        query: Search query to use for discovery
        limit: Maximum number of URLs to return
        
    Returns:
        List of discovered .onion URLs
    """
    results_file = os.path.join(DEEP_EXPLORER_PATH, "results.txt")
    
    # Ensure the Deep Explorer directory exists
    if not os.path.exists(DEEP_EXPLORER_PATH):
        logger.error(f"Deep Explorer directory not found at {DEEP_EXPLORER_PATH}")
        return []
    
    logger.info(f"Starting Deep Explorer search for '{query}' with limit {limit}")
    
    try:
        # Build command to run Deep Explorer
        cmd = [
            "python", 
            os.path.join(DEEP_EXPLORER_PATH, "deepexplorer.py"),
            "--query", query,
            "--limit", str(limit),
            "--mode", "all",
            "--output", results_file
        ]
        
        # Execute the Deep Explorer command
        logger.info(f"Executing: {' '.join(cmd)}")
        process = subprocess.Popen(
            cmd,
            cwd=DEEP_EXPLORER_PATH,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Wait for process to complete with timeout
        stdout, stderr = process.communicate(timeout=600)  # 10 minute timeout
        
        # Check if process executed successfully
        if process.returncode != 0:
            logger.warning(f"Deep Explorer exited with code {process.returncode}: {stderr}")
            return []
            
        # Read and parse results
        if os.path.exists(results_file):
            with open(results_file, 'r') as f:
                content = f.read()
                
            # Extract and deduplicate onion URLs
            # Look for .onion URLs with both http and https prefixes
            onion_pattern = r'https?://[a-z2-7]{16,56}\.onion\S*'
            urls = re.findall(onion_pattern, content)
            
            # Deduplicate URLs
            unique_urls = list(set(urls))
            
            logger.info(f"Discovered {len(unique_urls)} unique .onion URLs")
            return unique_urls
        else:
            logger.warning(f"Results file not found at {results_file}")
            return []
            
    except subprocess.TimeoutExpired:
        logger.error(f"Deep Explorer search timed out after 10 minutes")
        return []
    except Exception as e:
        logger.error(f"Error during onion discovery: {str(e)}")
        return []

def run_discovery_pipeline(queries: List[str], limit_per_query: int = 20) -> List[str]:
    """
    Run the full discovery pipeline using multiple search queries.
    
    Args:
        queries: List of search queries to execute
        limit_per_query: Maximum number of URLs to discover per query
        
    Returns:
        List of all discovered .onion URLs
    """
    all_urls = []
    
    for query in queries:
        try:
            logger.info(f"Processing query: '{query}'")
            urls = discover_onions(query, limit_per_query)
            all_urls.extend(urls)
            
            # Brief pause between queries to avoid overwhelming resources
            time.sleep(1)
        except Exception as e:
            logger.error(f"Error processing query '{query}': {str(e)}")
    
    # Final deduplication
    unique_urls = list(set(all_urls))
    logger.info(f"Total unique URLs discovered: {len(unique_urls)}")
    
    return unique_urls

if __name__ == "__main__":
    # Example usage
    test_queries = ["cryptomarket", "forum hacking"]
    urls = run_discovery_pipeline(test_queries)
    print(f"Discovered {len(urls)} unique .onion URLs")
    for url in urls[:10]:  # Print first 10 for verification
        print(f" - {url}")
