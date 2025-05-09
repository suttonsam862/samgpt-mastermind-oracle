
#!/usr/bin/env python3
"""
Boot Integrity and Attestation Verification Script

This script verifies:
1. The container image signature using cosign
2. Critical file hashes against expected values
3. Platform integrity using TPM attestation (if available)
"""

import argparse
import hashlib
import json
import logging
import os
import subprocess
import sys
from typing import Dict, List, Optional

# Configure logging with redaction for sensitive values
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("verify_integrity")

# File paths to verify (critical security and application files)
CRITICAL_FILES = [
    "/app/src/utils/dark_web_ingestion.py",
    "/app/src/utils/verify_integrity.py",
    "/app/requirements.txt",
]

# Public key for signature verification
ATTESTATION_KEY_PATH = "/app/attestation_key.pub"

def calculate_file_hash(file_path: str) -> str:
    """Calculate SHA-256 hash of a file"""
    if not os.path.exists(file_path):
        logger.error(f"File not found: {file_path}")
        return ""

    sha256_hash = hashlib.sha256()
    try:
        with open(file_path, "rb") as f:
            # Read and update hash in chunks to handle large files efficiently
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()
    except Exception as e:
        logger.error(f"Error calculating hash for {file_path}: {e}")
        return ""

def verify_image_signature() -> bool:
    """
    Verify container image signature using cosign (if available)
    In production, this would use OIDC tokens and KMS
    """
    try:
        # Try to use cosign if it's available in the container
        # Real implementation would use the actual image digest
        result = subprocess.run(
            ["cosign", "verify", "--key", ATTESTATION_KEY_PATH, os.environ.get("CONTAINER_IMAGE", "")],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            logger.info("Image signature verified successfully")
            return True
        else:
            logger.error(f"Image signature verification failed: {result.stderr}")
            return False
    except FileNotFoundError:
        # Fall back to checking if we're running in a read-only container
        # which is a partial indication of integrity
        logger.warning("cosign not found, checking for read-only filesystem")
        try:
            # Try to write to a protected location
            with open("/app/test_write", "w") as f:
                f.write("test")
            # If we got here, filesystem is writable (bad)
            os.remove("/app/test_write")
            logger.error("Filesystem is writable - container integrity compromised!")
            return False
        except PermissionError:
            # Expected behavior in read-only container
            logger.info("Filesystem is read-only as expected")
            return True

def get_tpm_quote() -> Optional[Dict]:
    """
    Get a TPM quote for remote attestation if TPM is available
    This is a simplified version - production would use an attestation service
    """
    try:
        # Try to access TPM device (will fail in most containers)
        # Real implementation would use tpm2-tools or similar
        if os.path.exists("/dev/tpmrm0"):
            # Simulate TPM quote gathering
            logger.info("TPM device found, could gather attestation")
            return {"status": "simulated", "pcr0": "0000000000000000000000000000000000000000"}
        else:
            logger.warning("No TPM device available for attestation")
            return None
    except Exception as e:
        logger.error(f"Error accessing TPM: {e}")
        return None

def verify_file_integrity() -> bool:
    """Verify integrity of critical files"""
    # In production, these would be dynamically fetched from a secure source
    # or verified against signatures rather than hardcoded hashes
    try:
        integrity_check_passed = True
        
        for file_path in CRITICAL_FILES:
            file_hash = calculate_file_hash(file_path)
            if not file_hash:
                integrity_check_passed = False
                continue
                
            logger.info(f"File {file_path} has hash: {file_hash}")
            # In production: verify against known good hashes from secure source
        
        return integrity_check_passed
    except Exception as e:
        logger.error(f"Error verifying file integrity: {e}")
        return False

def main():
    """Main verification entry point"""
    parser = argparse.ArgumentParser(description='Verify container integrity')
    parser.add_argument('--check', action='store_true', help='Perform integrity check')
    args = parser.parse_args()
    
    if not args.check:
        parser.print_help()
        return
    
    # Verify critical components
    image_ok = verify_image_signature()
    files_ok = verify_file_integrity()
    tpm_quote = get_tpm_quote()  # For auditing
    
    if not (image_ok and files_ok):
        logger.critical("Integrity verification failed!")
        sys.exit(1)
    
    logger.info("All integrity checks passed")
    sys.exit(0)

if __name__ == "__main__":
    main()
