
#!/usr/bin/env python3
"""
HashiCorp Vault Integration Module

This module provides secure access to credentials and secrets stored in Vault
using short-lived tokens with automatic renewal.
"""

import os
import json
import requests
import logging
from typing import Dict, Optional, Any
import time

# Configure logging with redaction for sensitive values
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("vault_integration")

# Redact sensitive information in logs
class SensitiveFilter(logging.Filter):
    def filter(self, record):
        msg = record.getMessage()
        # Redact token and secret values
        if any(x in msg.lower() for x in ["token", "password", "secret", "key", "credential"]):
            record.msg = "[REDACTED SENSITIVE INFORMATION]"
        return True

logger.addFilter(SensitiveFilter())

class VaultClient:
    """Client for interacting with HashiCorp Vault"""
    
    def __init__(self):
        """Initialize the Vault client with environment-based configuration"""
        self.vault_addr = os.getenv("VAULT_ADDR", "http://vault:8200")
        self.role_id = os.getenv("VAULT_ROLE_ID")
        self.secret_id = os.getenv("VAULT_SECRET_ID")
        self.token = os.getenv("VAULT_TOKEN")
        self.token_expiry = 0
        
        # Validate configuration
        if not (self.token or (self.role_id and self.secret_id)):
            logger.warning("No Vault authentication configured. Using environment variables only.")
        
        # Connect to Vault if credentials are available
        if self.role_id and self.secret_id:
            self._authenticate_with_approle()
        elif self.token:
            logger.info("Using provided Vault token")
        
    def _authenticate_with_approle(self) -> bool:
        """Authenticate with Vault using AppRole auth method"""
        try:
            logger.info("Authenticating to Vault with AppRole")
            payload = {
                "role_id": self.role_id,
                "secret_id": self.secret_id
            }
            
            response = requests.post(
                f"{self.vault_addr}/v1/auth/approle/login",
                json=payload,
                timeout=5
            )
            
            if response.status_code == 200:
                auth_data = response.json()["auth"]
                self.token = auth_data["client_token"]
                # Calculate token expiry time (in seconds)
                self.token_expiry = time.time() + auth_data["lease_duration"]
                logger.info("Successfully authenticated to Vault")
                return True
            else:
                logger.error(f"Failed to authenticate to Vault: {response.status_code}")
                return False
                
        except Exception as e:
            logger.error(f"Error authenticating to Vault: {str(e)}")
            return False
    
    def _renew_token_if_needed(self) -> bool:
        """Renew Vault token if it's close to expiry"""
        # If no token or token is expired, try to reauthenticate
        if not self.token:
            return self._authenticate_with_approle()
            
        # If token is close to expiry (less than 10 minutes), renew it
        if self.token_expiry - time.time() < 600:
            try:
                logger.info("Renewing Vault token")
                headers = {"X-Vault-Token": self.token}
                response = requests.post(
                    f"{self.vault_addr}/v1/auth/token/renew-self",
                    headers=headers,
                    timeout=5
                )
                
                if response.status_code == 200:
                    auth_data = response.json()["auth"]
                    self.token = auth_data["client_token"]
                    self.token_expiry = time.time() + auth_data["lease_duration"]
                    logger.info("Successfully renewed Vault token")
                    return True
                else:
                    logger.warning("Failed to renew token, reauthenticating")
                    return self._authenticate_with_approle()
                    
            except Exception as e:
                logger.error(f"Error renewing Vault token: {str(e)}")
                return self._authenticate_with_approle()
        
        return True
    
    def get_secret(self, path: str) -> Optional[Dict[str, Any]]:
        """
        Get a secret from Vault at the specified path
        
        Args:
            path: Path to the secret in Vault (e.g., "secret/data/tor/credentials")
            
        Returns:
            Dictionary containing secret data or None if failed
        """
        # Ensure we have a valid token
        if not self._renew_token_if_needed():
            logger.error("Failed to authenticate to Vault")
            return None
        
        try:
            logger.info(f"Fetching secret from {path}")
            headers = {"X-Vault-Token": self.token}
            
            response = requests.get(
                f"{self.vault_addr}/v1/{path}",
                headers=headers,
                timeout=5
            )
            
            if response.status_code == 200:
                return response.json()["data"]["data"]
            else:
                logger.error(f"Failed to get secret from {path}: {response.status_code}")
                return None
                
        except Exception as e:
            logger.error(f"Error getting secret from Vault: {str(e)}")
            return None
            
    def get_dynamic_secret(self, path: str) -> Optional[Dict[str, Any]]:
        """
        Get a dynamic secret from Vault (like database credentials)
        
        Args:
            path: Path to the dynamic secret in Vault
            
        Returns:
            Dictionary containing secret data and lease info, or None if failed
        """
        # Ensure we have a valid token
        if not self._renew_token_if_needed():
            logger.error("Failed to authenticate to Vault")
            return None
            
        try:
            logger.info(f"Requesting dynamic secret from {path}")
            headers = {"X-Vault-Token": self.token}
            
            response = requests.get(
                f"{self.vault_addr}/v1/{path}",
                headers=headers,
                timeout=5
            )
            
            if response.status_code == 200:
                data = response.json()
                # For dynamic secrets, we need to include lease info for renewal
                return {
                    "data": data["data"],
                    "lease_id": data["lease_id"],
                    "lease_duration": data["lease_duration"]
                }
            else:
                logger.error(f"Failed to get dynamic secret from {path}: {response.status_code}")
                return None
                
        except Exception as e:
            logger.error(f"Error getting dynamic secret from Vault: {str(e)}")
            return None

# Singleton instance for application-wide use
vault_client = VaultClient()

def get_tor_credentials() -> Dict[str, str]:
    """Get Tor credentials from Vault or environment variables"""
    # Try to get credentials from Vault
    creds = vault_client.get_secret("secret/data/tor/credentials")
    
    if creds:
        return {
            "socks_host": creds.get("socks_host", os.getenv("TOR_SOCKS_HOST", "tor")),
            "socks_port": creds.get("socks_port", os.getenv("TOR_SOCKS_PORT", "9050"))
        }
    
    # Fall back to environment variables
    return {
        "socks_host": os.getenv("TOR_SOCKS_HOST", "tor"),
        "socks_port": os.getenv("TOR_SOCKS_PORT", "9050")
    }

def get_database_config() -> Dict[str, str]:
    """Get database configuration from Vault or environment variables"""
    # Try to get config from Vault
    config = vault_client.get_secret("secret/data/database/config")
    
    if config:
        return {
            "path": config.get("path", os.getenv("CHROMA_DB_PATH", "/app/data/chroma_db")),
            "collection": config.get("collection", os.getenv("COLLECTION_NAME", "samgpt"))
        }
    
    # Fall back to environment variables
    return {
        "path": os.getenv("CHROMA_DB_PATH", "/app/data/chroma_db"),
        "collection": os.getenv("COLLECTION_NAME", "samgpt")
    }

def get_webhook_url() -> Optional[str]:
    """Get webhook URL for alerts from Vault or environment variables"""
    # Try to get webhook from Vault
    webhook = vault_client.get_secret("secret/data/alerts/webhook")
    
    if webhook and "url" in webhook:
        return webhook["url"]
    
    # Fall back to environment variable
    return os.getenv("WEBHOOK_URL")

# Example of how to use this module:
if __name__ == "__main__":
    tor_creds = get_tor_credentials()
    db_config = get_database_config()
    webhook_url = get_webhook_url()
    
    print(f"Tor SOCKS Host: {tor_creds['socks_host']}")
    print(f"Tor SOCKS Port: {tor_creds['socks_port']}")
    print(f"Database Path: {db_config['path']}")
    print(f"Collection Name: {db_config['collection']}")
    print(f"Webhook URL configured: {'Yes' if webhook_url else 'No'}")
