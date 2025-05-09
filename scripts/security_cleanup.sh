
#!/bin/bash
set -e

# Security cleanup script for dark web ingestion service
# This script performs thorough cleanup after container shutdown

echo "Running security cleanup..."

# Remove all stopped containers
docker container prune -f

# Remove any unused networks
docker network prune -f

# Remove any temporary files
find ./logs -type f -name "*.tmp" -delete
find ./data -type f -name "*.tmp" -delete

# Clean Docker build cache to prevent data leakage
docker builder prune -f

# Securely wipe any temporary credential files
find . -name "*.key" -o -name "*.token" -o -name "*.secret" | while read file; do
    echo "Securely wiping ${file}..."
    shred -u "${file}"
done

# Reset iptables to default if running as root
if [ "$(id -u)" -eq 0 ]; then
    echo "Restoring default iptables configuration..."
    iptables -F
    iptables -X
    iptables -t nat -F
    iptables -t nat -X
    iptables -t mangle -F
    iptables -t mangle -X
    iptables -P INPUT ACCEPT
    iptables -P FORWARD ACCEPT
    iptables -P OUTPUT ACCEPT
fi

# Check for any remaining Docker volumes associated with the service
VOLUMES=$(docker volume ls -q --filter name=darkweb)
if [ -n "${VOLUMES}" ]; then
    echo "Removing volumes: ${VOLUMES}"
    docker volume rm ${VOLUMES}
fi

echo "Security cleanup completed"
