
#!/usr/bin/env python3
"""
Stealth Network Module for Dark Web Ingestion Service

This module implements advanced network anonymization and traffic obfuscation:
1. Multiple-hop Tor circuit management with automatic rotation
2. I2P fallback transport
3. TLS fingerprint randomization
4. User-Agent and HTTP header randomization
5. Leak prevention

Usage:
    from stealth_net import StealthSession
    
    session = StealthSession()
    response = session.get("http://example.onion/")
"""

import os
import time
import random
import socket
import struct
import logging
import subprocess
from typing import Dict, List, Optional, Tuple, Union
import requests
from requests.adapters import HTTPAdapter
from stem import Signal
from stem.control import Controller
from torpy.http.requests import TorRequests

# Configure logging with redaction
logging.basicConfig(
    level=getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper()),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger("stealth_net")

# Security-sensitive strings to redact in logs
REDACT_PATTERNS = [
    r'([a-z2-7]{16,56}\.onion)',  # .onion addresses
    r'((?:\d{1,3}\.){3}\d{1,3})',  # IP addresses
    r'([0-9a-fA-F]{2}(?::[0-9a-fA-F]{2}){5})'  # MAC addresses
]

class RedactingFilter(logging.Filter):
    """Redacts sensitive information from logs"""
    def filter(self, record):
        import re
        message = record.getMessage()
        for pattern in REDACT_PATTERNS:
            message = re.sub(pattern, '[REDACTED]', message)
        record.msg = message
        return True

logger.addFilter(RedactingFilter())

# ===============================================================
# User-Agent and Header Randomization
# ===============================================================

# List of common desktop and mobile user agents for randomization
USER_AGENTS = [
    # Firefox variants
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/117.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/117.0",
    "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/117.0",
    "Mozilla/5.0 (Android 13; Mobile; rv:109.0) Gecko/117.0 Firefox/117.0",
    
    # Chrome variants
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36",
    
    # Safari variants
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5.2 Safari/605.1.15",
    
    # Edge variants
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36 Edg/116.0.1938.69",
]

# Common language preferences
ACCEPT_LANGUAGES = [
    "en-US,en;q=0.9",
    "en-GB,en;q=0.9",
    "en-CA,en;q=0.9,fr-CA;q=0.8,fr;q=0.7",
    "en;q=0.9",
    "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
    "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
    "es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7",
    "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
    "ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7",
    "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
]

# Platform types for Accept headers
PLATFORMS = [
    "Windows NT 10.0; Win64; x64",
    "Macintosh; Intel Mac OS X 10_15_7",
    "X11; Linux x86_64",
    "Linux; Android 13",
    "iPhone; CPU iPhone OS 16_6 like Mac OS X",
]

def generate_random_headers() -> Dict[str, str]:
    """Generate random HTTP headers to avoid fingerprinting"""
    headers = {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept-Language": random.choice(ACCEPT_LANGUAGES),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "Sec-Fetch-Dest": random.choice(["document", "empty"]),
        "Sec-Fetch-Mode": random.choice(["navigate", "cors"]),
        "Sec-Fetch-Site": random.choice(["none", "same-origin"]),
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
        "Pragma": "no-cache",
        "Cache-Control": "no-cache",
    }
    
    # Add some entropy with random headers
    if random.random() < 0.3:
        headers["DNT"] = "1"
    
    if random.random() < 0.2:
        headers["Connection"] = "keep-alive"
    
    return headers

# ===============================================================
# TLS Fingerprint Randomization
# ===============================================================

try:
    import tls_client
    TLS_CLIENT_AVAILABLE = True
except ImportError:
    logger.warning("tls_client not available. TLS fingerprint randomization disabled.")
    TLS_CLIENT_AVAILABLE = False

class TLSRandomizedAdapter(HTTPAdapter):
    """HTTP adapter that randomizes TLS parameters to avoid JA3 fingerprinting"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        
        if not TLS_CLIENT_AVAILABLE:
            return
            
        # Select a randomized client profile for TLS
        self.tls_profile = random.choice([
            "chrome_105", "chrome_106", "chrome_107", "chrome_108",
            "chrome_109", "chrome_110", "chrome_111", "safari_15_3",
            "safari_15_6_1", "safari_16_0", "firefox_102", "firefox_104"
        ])
        
        logger.info(f"Using TLS profile: {self.tls_profile}")
        
    def send(self, request, **kwargs):
        if not TLS_CLIENT_AVAILABLE:
            return super().send(request, **kwargs)
            
        # Use tls_client instead of the default requests implementation
        try:
            session = tls_client.Session(client_identifier=self.tls_profile)
            
            # Transfer headers from the request to our tls_client session
            for header, value in request.headers.items():
                session.headers[header] = value
                
            # Execute the request using the appropriate method
            method = request.method.lower()
            url = request.url
            
            # Make the actual request with tls_client
            if method == "get":
                response = session.get(url, **kwargs)
            elif method == "post":
                response = session.post(url, data=request.body, **kwargs)
            elif method == "put":
                response = session.put(url, data=request.body, **kwargs)
            elif method == "delete":
                response = session.delete(url, **kwargs)
            else:
                return super().send(request, **kwargs)
                
            # Convert tls_client response to requests.Response
            requests_response = requests.Response()
            requests_response.status_code = response.status_code
            requests_response.headers = response.headers
            requests_response._content = response.content
            requests_response.request = request
            requests_response.url = url
            
            return requests_response
        except Exception as e:
            logger.warning(f"TLS randomization failed, falling back to standard adapter: {e}")
            return super().send(request, **kwargs)

# ===============================================================
# Multi-Hop Tor Circuit Management
# ===============================================================

class TorCircuitManager:
    """Manages Tor circuits, ensuring they're rotated frequently"""
    
    def __init__(self, control_port: int = 9051, password: str = None):
        self.control_port = control_port
        self.password = password
        # Keep track of when we last rotated the circuit
        self.last_rotation = 0
        # How often to rotate circuits (in seconds)
        self.rotation_interval = 30
        
    def rotate_circuit(self) -> bool:
        """
        Force Tor to use a new circuit by sending the NEWNYM signal
        Returns: True if successful, False otherwise
        """
        # Check if we've rotated recently
        now = time.time()
        if now - self.last_rotation < self.rotation_interval:
            logger.debug(f"Circuit rotation skipped (last rotation was {now - self.last_rotation:.2f}s ago)")
            return False
            
        try:
            with Controller.from_port(port=self.control_port) as controller:
                if self.password:
                    controller.authenticate(password=self.password)
                else:
                    controller.authenticate()
                    
                controller.signal(Signal.NEWNYM)
                self.last_rotation = now
                logger.info("Tor circuit successfully rotated")
                return True
        except Exception as e:
            logger.error(f"Failed to rotate Tor circuit: {str(e)}")
            return False

# ===============================================================
# I2P Fallback Transport
# ===============================================================

class I2PSession:
    """Wrapper for I2P HTTP requests as fallback for Tor"""
    
    def __init__(self, i2p_http_proxy: str = "127.0.0.1:4444"):
        self.i2p_http_proxy = i2p_http_proxy
        self.session = requests.Session()
        self.session.proxies = {
            "http": f"http://{i2p_http_proxy}",
            "https": f"http://{i2p_http_proxy}"
        }
        
    def request(self, method: str, url: str, **kwargs) -> requests.Response:
        """Make an HTTP request through I2P"""
        # Add randomized headers if not provided
        if "headers" not in kwargs:
            kwargs["headers"] = generate_random_headers()
            
        # Add timeout if not specified
        if "timeout" not in kwargs:
            kwargs["timeout"] = 120  # I2P can be slow, use a longer timeout
            
        try:
            logger.info(f"Making {method} request to {url} via I2P")
            return self.session.request(method, url, **kwargs)
        except Exception as e:
            logger.error(f"I2P request failed: {str(e)}")
            raise

# ===============================================================
# Stealth Session - Main interface
# ===============================================================

class StealthSession:
    """
    Stealth HTTP session that routes through multi-hop Tor circuits with
    circuit rotation, TLS fingerprint randomization, and header variation
    
    Falls back to I2P if Tor fails
    """
    
    def __init__(
        self,
        tor_socks_host: str = "127.0.0.1",
        tor_socks_port: int = 9050,
        tor_control_port: int = 9051,
        tor_password: str = None,
        i2p_http_proxy: str = "127.0.0.1:4444",
        max_retries: int = 3,
        circuit_hops: int = 3
    ):
        self.tor_socks_host = tor_socks_host
        self.tor_socks_port = tor_socks_port
        self.max_retries = max_retries
        self.circuit_hops = circuit_hops
        
        # Initialize circuit manager
        self.circuit_manager = TorCircuitManager(
            control_port=tor_control_port, 
            password=tor_password
        )
        
        # Initialize I2P as fallback
        self.i2p_session = I2PSession(i2p_http_proxy=i2p_http_proxy)
        
        logger.info(f"Stealth session initialized with {circuit_hops} Tor hops")
    
    def request(
        self, 
        method: str, 
        url: str, 
        retry_count: int = 0,
        use_i2p: bool = False,
        **kwargs
    ) -> requests.Response:
        """Make a stealth request through Tor (default) or I2P"""
        
        # Use I2P if specified or if we've exceeded retry limit with Tor
        if use_i2p or retry_count >= self.max_retries:
            try:
                return self.i2p_session.request(method, url, **kwargs)
            except Exception as e:
                logger.error(f"All transport methods failed. Request could not be completed: {str(e)}")
                raise
        
        # Otherwise use Tor (primary transport)
        try:
            # Rotate circuit before request
            self.circuit_manager.rotate_circuit()
            
            # Add randomized headers if not provided
            if "headers" not in kwargs:
                kwargs["headers"] = generate_random_headers()
            
            # Add timeout if not specified
            if "timeout" not in kwargs:
                kwargs["timeout"] = 60
            
            # Use TorRequests for Tor connectivity
            with TorRequests(hops_count=self.circuit_hops) as tor_requests:
                with tor_requests.get_session() as session:
                    # Add TLS randomization if available
                    if TLS_CLIENT_AVAILABLE:
                        session.mount("https://", TLSRandomizedAdapter())
                    
                    logger.info(f"Making {method} request through Tor ({self.circuit_hops} hops)")
                    return session.request(method, url, **kwargs)
                    
        except Exception as e:
            logger.warning(f"Tor request failed (attempt {retry_count+1}/{self.max_retries}): {str(e)}")
            # Sleep briefly to prevent rapid retries
            time.sleep(2)
            # Retry with Tor
            return self.request(method, url, retry_count=retry_count+1, **kwargs)
    
    # Convenience methods for common HTTP verbs
    def get(self, url: str, **kwargs) -> requests.Response:
        return self.request("GET", url, **kwargs)
        
    def post(self, url: str, **kwargs) -> requests.Response:
        return self.request("POST", url, **kwargs)
        
    def put(self, url: str, **kwargs) -> requests.Response:
        return self.request("PUT", url, **kwargs)
        
    def delete(self, url: str, **kwargs) -> requests.Response:
        return self.request("DELETE", url, **kwargs)

# ===============================================================
# Network Namespace Management
# ===============================================================

def create_network_namespace(name: str = "stealth_net") -> Tuple[str, str]:
    """
    Creates a network namespace with random MAC and IP address
    
    Returns:
        Tuple[str, str]: (MAC address, IP address) of the created interface
    """
    try:
        # Generate random MAC address (ensuring locally administered bit is set)
        mac = [0x02]  # Locally administered MAC address
        mac.extend([random.randint(0, 255) for _ in range(5)])
        mac_addr = ":".join([f"{b:02x}" for b in mac])
        
        # Generate random private IP in 10.0.0.0/8 subnet
        ip_addr = f"10.{random.randint(0, 255)}.{random.randint(0, 255)}.{random.randint(1, 254)}/24"
        
        logger.info(f"Creating network namespace {name} with random MAC and IP")
        
        # Create the namespace
        subprocess.run(["ip", "netns", "add", name], check=True)
        
        # Create veth pair
        subprocess.run(["ip", "link", "add", f"veth0_{name}", "type", "veth", "peer", "name", f"veth1_{name}"], check=True)
        
        # Move one end to namespace
        subprocess.run(["ip", "link", "set", f"veth1_{name}", "netns", name], check=True)
        
        # Configure host end
        subprocess.run(["ip", "addr", "add", f"10.0.0.1/24", "dev", f"veth0_{name}"], check=True)
        subprocess.run(["ip", "link", "set", f"veth0_{name}", "up"], check=True)
        
        # Configure namespace end with random MAC and IP
        subprocess.run(["ip", "netns", "exec", name, "ip", "link", "set", f"veth1_{name}", "address", mac_addr], check=True)
        subprocess.run(["ip", "netns", "exec", name, "ip", "addr", "add", ip_addr, "dev", f"veth1_{name}"], check=True)
        subprocess.run(["ip", "netns", "exec", name, "ip", "link", "set", f"veth1_{name}", "up"], check=True)
        
        # Set up loopback in namespace
        subprocess.run(["ip", "netns", "exec", name, "ip", "link", "set", "lo", "up"], check=True)
        
        # Set up default route in namespace
        subprocess.run(["ip", "netns", "exec", name, "ip", "route", "add", "default", "via", "10.0.0.1"], check=True)
        
        # Enable IP forwarding on host
        subprocess.run(["sysctl", "-w", "net.ipv4.ip_forward=1"], check=True)
        
        # Set up NAT
        subprocess.run([
            "iptables", "-t", "nat", "-A", "POSTROUTING", 
            "-s", "10.0.0.0/24", "-o", "eth0", "-j", "MASQUERADE"
        ], check=True)
        
        logger.info(f"Network namespace {name} created with MAC {mac_addr} and IP {ip_addr}")
        return mac_addr, ip_addr
        
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to create network namespace: {e}")
        return None, None

def cleanup_network_namespace(name: str = "stealth_net"):
    """Remove the network namespace and associated interfaces"""
    try:
        # Remove veth pair (automatically removes both ends)
        try:
            subprocess.run(["ip", "link", "del", f"veth0_{name}"], check=True)
        except subprocess.CalledProcessError:
            pass  # Interface might already be gone
        
        # Remove namespace
        subprocess.run(["ip", "netns", "del", name], check=True)
        
        # Clean up NAT rule
        try:
            subprocess.run([
                "iptables", "-t", "nat", "-D", "POSTROUTING", 
                "-s", "10.0.0.0/24", "-o", "eth0", "-j", "MASQUERADE"
            ], check=True)
        except subprocess.CalledProcessError:
            pass  # Rule might already be gone
            
        logger.info(f"Network namespace {name} removed")
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to clean up network namespace: {e}")

def run_in_namespace(namespace: str, command: List[str]) -> subprocess.CompletedProcess:
    """Run a command in the specified namespace"""
    cmd = ["ip", "netns", "exec", namespace] + command
    return subprocess.run(cmd, check=True)

# ===============================================================
# Environment Jitter Functions
# ===============================================================

def randomize_environment_variables():
    """Set random environment variables to avoid fingerprinting"""
    # Randomize timezone
    timezones = [
        "UTC", "America/New_York", "Europe/London", "Asia/Tokyo", 
        "Australia/Sydney", "Europe/Berlin", "America/Los_Angeles"
    ]
    os.environ["TZ"] = random.choice(timezones)
    
    # Randomize locale settings
    locales = [
        "en_US.UTF-8", "en_GB.UTF-8", "de_DE.UTF-8", 
        "fr_FR.UTF-8", "es_ES.UTF-8", "ru_RU.UTF-8"
    ]
    selected_locale = random.choice(locales)
    os.environ["LANG"] = selected_locale
    os.environ["LC_ALL"] = selected_locale
    
    logger.info(f"Environment randomized: TZ={os.environ['TZ']}, LANG={os.environ['LANG']}")

def add_clock_skew(max_seconds: int = 30):
    """Add a random clock skew (requires root privileges)"""
    try:
        # Get current time
        current_time = time.time()
        
        # Generate random skew (-max_seconds to +max_seconds)
        skew_seconds = random.randint(-max_seconds, max_seconds)
        
        # Calculate new time
        new_time = current_time + skew_seconds
        
        # Format for date command (seconds since epoch)
        date_cmd = ["date", "+%s", "-s", f"@{int(new_time)}"]
        
        subprocess.run(date_cmd, check=True)
        logger.info(f"Added clock skew of {skew_seconds} seconds")
        return True
    except subprocess.CalledProcessError as e:
        logger.warning(f"Failed to add clock skew (may require root): {e}")
        return False

# ===============================================================
# Main function for testing
# ===============================================================

def main():
    """Test the stealth networking functionality"""
    # Randomize environment variables
    randomize_environment_variables()
    
    # Create a network namespace (requires root)
    try:
        mac_addr, ip_addr = create_network_namespace()
        if mac_addr and ip_addr:
            logger.info(f"Created namespace with MAC {mac_addr} and IP {ip_addr}")
    except Exception as e:
        logger.warning(f"Could not create network namespace (may require root): {e}")
    
    # Initialize stealth session
    session = StealthSession(
        tor_socks_host=os.environ.get("TOR_SOCKS_HOST", "127.0.0.1"),
        tor_socks_port=int(os.environ.get("TOR_SOCKS_PORT", "9050")),
        circuit_hops=3
    )
    
    # Test with a non-onion URL first (check.torproject.org)
    try:
        response = session.get("https://check.torproject.org", timeout=30)
        if "Congratulations" in response.text:
            logger.info("Successfully connected through Tor!")
        else:
            logger.warning("Connected, but not through Tor.")
    except Exception as e:
        logger.error(f"Error testing Tor connection: {e}")
    
    # Clean up network namespace if we created one
    try:
        cleanup_network_namespace()
    except Exception as e:
        logger.warning(f"Could not clean up network namespace: {e}")

if __name__ == "__main__":
    main()
