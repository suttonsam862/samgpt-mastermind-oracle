
#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting security scan for Dark Web Ingestion module${NC}"

# Step 1: Update dependencies
echo -e "${YELLOW}Updating dependencies...${NC}"
pip install --upgrade --requirement requirements.txt

# Step 2: Run security audit with pip-audit
echo -e "${YELLOW}Running pip-audit vulnerability scan...${NC}"
if ! pip-audit; then
    echo -e "${RED}pip-audit found vulnerabilities!${NC}"
    exit 1
fi

# Step 3: Run security check with safety
echo -e "${YELLOW}Running safety check...${NC}"
if ! safety check -r requirements.txt; then
    echo -e "${RED}Safety check found vulnerabilities!${NC}"
    exit 1
fi

# Step 4: Check for outdated packages
echo -e "${YELLOW}Checking for outdated packages...${NC}"
pip list --outdated

# Step 5: Build and launch Docker container with security settings
echo -e "${YELLOW}Building secure Docker container...${NC}"

# Check if .env file exists, if not, create from template
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env file from template...${NC}"
    cp .env.example .env
    echo -e "${YELLOW}Please edit the .env file with your settings!${NC}"
fi

# Create required directories
mkdir -p data logs

# Ensure proper permissions
chmod +x scan-secure.sh

# Build the Docker image
docker-compose build

echo -e "${YELLOW}Launching Docker containers in secure mode...${NC}"

# Run Docker with read-only root filesystem
docker-compose up -d

echo -e "${GREEN}Security scan completed successfully${NC}"
echo -e "Tor and Dark Web Ingestion services are running"
echo -e "To view logs: docker-compose logs -f"
echo -e "To stop services: docker-compose down"

exit 0
