
#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting comprehensive security scan for Dark Web Ingestion module${NC}"

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

# Step 4: Run Bandit code security analysis
echo -e "${YELLOW}Running Bandit security analysis...${NC}"
if ! bandit -r src/ -c bandit.yaml; then
    echo -e "${RED}Bandit found security issues in code!${NC}"
    exit 1
fi

# Step 5: Check for outdated packages
echo -e "${YELLOW}Checking for outdated packages...${NC}"
pip list --outdated

# Step 6: Verify AppArmor/SELinux
echo -e "${YELLOW}Verifying system security modules...${NC}"
if [ -x "$(command -v aa-status)" ]; then
    aa-status
    # Load AppArmor profiles
    echo -e "${YELLOW}Loading AppArmor profiles...${NC}"
    for profile in configs/apparmor/*; do
        if [ -f "$profile" ]; then
            sudo apparmor_parser -r -W "$profile"
        fi
    done
else
    echo -e "${YELLOW}AppArmor not detected. Checking SELinux...${NC}"
    if [ -x "$(command -v sestatus)" ]; then
        sestatus
        echo -e "${YELLOW}SELinux is available for policy enforcement${NC}"
    else
        echo -e "${RED}WARNING: Neither AppArmor nor SELinux is available${NC}"
        echo -e "${RED}It is strongly recommended to use a system with mandatory access controls${NC}"
    fi
fi

# Step 7: Verify Seccomp profiles
echo -e "${YELLOW}Verifying Seccomp profiles...${NC}"
if [ ! -f "configs/seccomp_ingestion.json" ]; then
    echo -e "${RED}Seccomp profile missing!${NC}"
    exit 1
fi

# Step 8: Verify Docker security features
echo -e "${YELLOW}Checking Docker security features...${NC}"
if docker info | grep -q "Security Options"; then
    echo -e "${GREEN}Docker security features available${NC}"
else
    echo -e "${RED}Docker security features not enabled!${NC}"
    exit 1
fi

# Step 9: Check for .env file or create from template
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env file from template...${NC}"
    cp .env.example .env
    echo -e "${YELLOW}Please edit the .env file with your settings!${NC}"
fi

# Step 10: Generate attestation key if not exists
if [ ! -f attestation_key.pub ]; then
    echo -e "${YELLOW}Generating attestation keys...${NC}"
    openssl genrsa -out attestation_key.pem 4096
    openssl rsa -in attestation_key.pem -pubout -out attestation_key.pub
    chmod 400 attestation_key.pem
    chmod 444 attestation_key.pub
    echo -e "${GREEN}Attestation keys generated${NC}"
fi

# Step 11: Create required directories
mkdir -p data logs configs/apparmor configs/falco
chmod 750 data logs

# Step 12: Build the Docker image with security features
echo -e "${YELLOW}Building secure Docker container...${NC}"
docker-compose build --no-cache

# Step 13: Set up iptables rules if running as root
if [ "$(id -u)" -eq 0 ]; then
    echo -e "${YELLOW}Setting up iptables rules...${NC}"
    chmod +x configs/iptables-rules.sh
    ./configs/iptables-rules.sh
else
    echo -e "${YELLOW}Not running as root, skipping iptables setup${NC}"
    echo -e "${YELLOW}Run 'sudo configs/iptables-rules.sh' to apply network isolation${NC}"
fi

echo -e "${YELLOW}Launching Docker containers in secure mode...${NC}"

# Run Docker with read-only root filesystem
docker-compose up -d

# Verify container integrity
echo -e "${YELLOW}Verifying container integrity...${NC}"
sleep 5 # Give container time to start
if docker exec darkweb-ingestion python /app/src/utils/verify_integrity.py --check; then
    echo -e "${GREEN}Container integrity verified${NC}"
else
    echo -e "${RED}Container integrity check failed!${NC}"
    docker-compose down
    exit 1
fi

echo -e "${GREEN}Comprehensive security scan completed successfully${NC}"
echo -e "Tor and Dark Web Ingestion services are running with enhanced security"
echo -e "To view logs: docker-compose logs -f"
echo -e "To stop services: docker-compose down"
echo -e "To run a one-time ephemeral job: ./scripts/ephemeral_job.sh"

exit 0
