
#!/bin/bash

# Setup script for Deep Explorer integration
# This script extracts the Deep Explorer files and sets up the directory structure

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEEP_EXPLORER_ZIP="$PROJECT_ROOT/Deep-Explorer-master.zip"
CRAWLERS_DIR="$PROJECT_ROOT/crawlers"
DEEP_EXPLORER_DIR="$CRAWLERS_DIR/deep_explorer"

echo "Setting up Deep Explorer..."

# Create crawlers directory if it doesn't exist
mkdir -p "$CRAWLERS_DIR"

# Check if Deep Explorer zip exists
if [ ! -f "$DEEP_EXPLORER_ZIP" ]; then
  echo "Error: Deep-Explorer-master.zip not found in project root!"
  exit 1
fi

# Extract Deep Explorer
echo "Extracting Deep Explorer..."
unzip -q -o "$DEEP_EXPLORER_ZIP" -d "$CRAWLERS_DIR/tmp"

# Move to the correct directory
if [ -d "$CRAWLERS_DIR/tmp/Deep-Explorer-master" ]; then
  # Remove existing directory if it exists
  rm -rf "$DEEP_EXPLORER_DIR"
  
  # Move extracted files to destination
  mv "$CRAWLERS_DIR/tmp/Deep-Explorer-master" "$DEEP_EXPLORER_DIR"
  
  # Clean up temp directory
  rm -rf "$CRAWLERS_DIR/tmp"
  
  echo "Deep Explorer extracted to $DEEP_EXPLORER_DIR"
else
  echo "Error: Expected directory structure not found in zip!"
  exit 1
fi

# Check if requirements.txt exists and install dependencies
if [ -f "$DEEP_EXPLORER_DIR/requirements.txt" ]; then
  echo "Installing Python dependencies..."
  pip install -r "$DEEP_EXPLORER_DIR/requirements.txt"
else
  echo "Warning: requirements.txt not found in Deep Explorer!"
fi

echo "Setting up directory for results..."
touch "$DEEP_EXPLORER_DIR/results.txt"
chmod 644 "$DEEP_EXPLORER_DIR/results.txt"

echo "Making Deep Explorer scripts executable..."
chmod +x "$DEEP_EXPLORER_DIR/deepexplorer.py"

echo "Deep Explorer setup complete!"
echo "You can now use the Discover functionality in the Dark Web Ingestion Panel"
