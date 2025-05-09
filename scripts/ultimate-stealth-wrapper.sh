
#!/bin/bash
set -e

# Ultimate Stealth Wrapper for Dark Web Ingestion Service
# This script creates a fresh network namespace with randomized MAC/IP,
# sets up Tor multi-hop circuits, configures environment jitter, and
# runs the dark web ingestion service with maximum anonymity.

# Generate a unique random identifier for this run
RANDOM_SUFFIX=$(cat /dev/urandom | tr -dc 'a-z0-9' | fold -w 8 | head -n 1)
NAMESPACE="stealth_${RANDOM_SUFFIX}"
CONTAINER_NAME="stealth-ingestion-${RANDOM_SUFFIX}"
LOG_FILE="./logs/stealth_${RANDOM_SUFFIX}.log"

echo "Starting Ultimate Stealth run with ID: ${RANDOM_SUFFIX}"

# Create the log file with restrictive permissions
mkdir -p ./logs
touch "${LOG_FILE}"
chmod 600 "${LOG_FILE}"

# Function to clean everything up on exit
cleanup() {
    echo "Cleaning up stealth environment..."
    
    # Stop and remove the container
    docker stop "${CONTAINER_NAME}" 2>/dev/null || true
    docker rm "${CONTAINER_NAME}" 2>/dev/null || true
    
    # Remove the network namespace
    ip netns del "${NAMESPACE}" 2>/dev/null || true
    ip link del "veth0_${NAMESPACE}" 2>/dev/null || true
    
    # Clean up any temporary files
    find /tmp -name "stealth_${RANDOM_SUFFIX}*" -exec shred -u {} \; 2>/dev/null || true
    
    # Reset environment variables
    unset TZ
    unset LANG
    unset LC_ALL
    
    # Reset clock if we changed it
    if [ -f "/tmp/stealth_${RANDOM_SUFFIX}_time" ]; then
        ORIGINAL_TIME=$(cat "/tmp/stealth_${RANDOM_SUFFIX}_time")
        date -s "@${ORIGINAL_TIME}" 2>/dev/null || true
        rm -f "/tmp/stealth_${RANDOM_SUFFIX}_time"
    fi
    
    echo "Cleanup complete. All stealth artifacts removed."
}

# Register cleanup function for exit
trap cleanup EXIT INT TERM

# Create a new network namespace with random MAC and IP
echo "Creating isolated network namespace with randomized MAC and IP..."
if ! command -v ip >/dev/null; then
    echo "ERROR: 'ip' command not found. Cannot create network namespace."
    echo "Running without network namespace isolation."
else
    # Create the namespace
    ip netns add "${NAMESPACE}"
    
    # Generate random MAC address (ensuring locally administered bit is set)
    MAC_BYTE1=$(printf "%02x" $((0x02 + RANDOM % 2)))
    MAC_BYTE2=$(printf "%02x" $((RANDOM % 256)))
    MAC_BYTE3=$(printf "%02x" $((RANDOM % 256)))
    MAC_BYTE4=$(printf "%02x" $((RANDOM % 256)))
    MAC_BYTE5=$(printf "%02x" $((RANDOM % 256)))
    MAC_BYTE6=$(printf "%02x" $((RANDOM % 256)))
    MAC_ADDR="${MAC_BYTE1}:${MAC_BYTE2}:${MAC_BYTE3}:${MAC_BYTE4}:${MAC_BYTE5}:${MAC_BYTE6}"
    
    # Generate random IP in 10.0.0.0/8 subnet
    IP_BYTE2=$((RANDOM % 256))
    IP_BYTE3=$((RANDOM % 256))
    IP_BYTE4=$((1 + RANDOM % 254))
    IP_ADDR="10.${IP_BYTE2}.${IP_BYTE3}.${IP_BYTE4}"
    
    echo "Namespace: ${NAMESPACE}"
    echo "MAC address: ${MAC_ADDR}"
    echo "IP address: ${IP_ADDR}"
    
    # Create veth pair
    ip link add "veth0_${NAMESPACE}" type veth peer name "veth1_${NAMESPACE}"
    
    # Move one end to namespace
    ip link set "veth1_${NAMESPACE}" netns "${NAMESPACE}"
    
    # Configure host end
    ip addr add "10.0.0.1/24" dev "veth0_${NAMESPACE}"
    ip link set "veth0_${NAMESPACE}" up
    
    # Configure namespace end
    ip netns exec "${NAMESPACE}" ip link set "veth1_${NAMESPACE}" address "${MAC_ADDR}"
    ip netns exec "${NAMESPACE}" ip addr add "${IP_ADDR}/24" dev "veth1_${NAMESPACE}"
    ip netns exec "${NAMESPACE}" ip link set "veth1_${NAMESPACE}" up
    ip netns exec "${NAMESPACE}" ip link set lo up
    ip netns exec "${NAMESPACE}" ip route add default via "10.0.0.1"
    
    # Enable IP forwarding on host
    echo 1 > /proc/sys/net/ipv4/ip_forward
    
    # Set up NAT for the namespace
    iptables -t nat -A POSTROUTING -s "10.0.0.0/24" -o eth0 -j MASQUERADE
    
    # Block direct DNS from namespace
    iptables -A FORWARD -i "veth0_${NAMESPACE}" -p udp --dport 53 -j DROP
    iptables -A FORWARD -i "veth0_${NAMESPACE}" -p tcp --dport 53 -j DROP
    
    echo "Network namespace created successfully."
fi

# Set random environment variables for host fingerprint obfuscation
echo "Randomizing environment variables..."

# List of possible timezones
TIMEZONES=(
    "UTC" "America/New_York" "Europe/London" "Asia/Tokyo" 
    "Australia/Sydney" "Europe/Berlin" "America/Los_Angeles"
    "Asia/Shanghai" "Pacific/Auckland" "Africa/Cairo"
)
RANDOM_TZ=${TIMEZONES[$RANDOM % ${#TIMEZONES[@]}]}

# List of possible locales
LOCALES=(
    "en_US.UTF-8" "en_GB.UTF-8" "de_DE.UTF-8" 
    "fr_FR.UTF-8" "es_ES.UTF-8" "ru_RU.UTF-8"
    "ja_JP.UTF-8" "zh_CN.UTF-8" "ar_SA.UTF-8"
)
RANDOM_LOCALE=${LOCALES[$RANDOM % ${#LOCALES[@]}]}

# Apply environment jitter
export TZ="${RANDOM_TZ}"
export LANG="${RANDOM_LOCALE}"
export LC_ALL="${RANDOM_LOCALE}"

echo "Set timezone: ${RANDOM_TZ}"
echo "Set locale: ${RANDOM_LOCALE}"

# Apply random clock skew if possible
if [ "$(id -u)" -eq 0 ]; then
    echo "Applying random clock skew..."
    CURRENT_TIME=$(date +%s)
    echo "${CURRENT_TIME}" > "/tmp/stealth_${RANDOM_SUFFIX}_time"
    
    # Random skew between -30 and +30 seconds
    SKEW=$((RANDOM % 61 - 30))
    NEW_TIME=$((CURRENT_TIME + SKEW))
    date -s "@${NEW_TIME}" > /dev/null
    
    echo "Applied ${SKEW} second clock skew"
else
    echo "Skipping clock skew (requires root)"
fi

# Start multi-hop Tor containers
echo "Starting multi-hop Tor circuits..."

# Create a Docker network for stealth operations
docker network create "stealth_net_${RANDOM_SUFFIX}" --internal

# Start Tor container for primary circuit
docker run -d --name "tor1_${RANDOM_SUFFIX}" \
    --network "stealth_net_${RANDOM_SUFFIX}" \
    --cap-drop ALL \
    -v "${PWD}/configs/torrc:/etc/tor/torrc:ro" \
    -e "TZ=${RANDOM_TZ}" \
    --read-only \
    --tmpfs /tmp:size=10M,noexec \
    dperson/tor:latest

# Start I2P container as fallback
docker run -d --name "i2p_${RANDOM_SUFFIX}" \
    --network "stealth_net_${RANDOM_SUFFIX}" \
    --cap-drop ALL \
    -e "TZ=${RANDOM_TZ}" \
    --read-only \
    --tmpfs /tmp:size=10M,noexec \
    geti2p/i2p:latest

echo "Waiting for Tor circuits to initialize..."
sleep 10

# Run the dark web ingestion job in the isolated environment
echo "Running stealth dark web ingestion job..."
docker run --rm --name "${CONTAINER_NAME}" \
    --network "stealth_net_${RANDOM_SUFFIX}" \
    --link "tor1_${RANDOM_SUFFIX}:tor" \
    --link "i2p_${RANDOM_SUFFIX}:i2p" \
    --cap-drop ALL \
    --security-opt no-new-privileges=true \
    --security-opt seccomp=configs/seccomp_ingestion.json \
    --read-only \
    --tmpfs /app/tmp:rw,size=100M,noexec,nosuid,nodev \
    -v "${PWD}/data/urls.json:/app/data/urls.json:ro" \
    -v "${PWD}/data/chroma_db:/app/data/chroma_db:rw" \
    -v "${LOG_FILE}:/app/logs/dark_web_ingestion.log:rw" \
    -e TOR_SOCKS_HOST=tor \
    -e TOR_SOCKS_PORT=9050 \
    -e I2P_HTTP_PROXY=i2p:4444 \
    -e LOG_LEVEL=INFO \
    -e CHROMA_DB_PATH=/app/data/chroma_db \
    -e "TZ=${RANDOM_TZ}" \
    -e "LANG=${RANDOM_LOCALE}" \
    -e "LC_ALL=${RANDOM_LOCALE}" \
    darkweb-ingestion:latest --file /app/data/urls.json --stealth-mode

# Job completed
echo "Stealth job completed"

# Stop and remove Tor and I2P containers
echo "Removing temporary containers..."
docker stop "tor1_${RANDOM_SUFFIX}" "i2p_${RANDOM_SUFFIX}"
docker rm "tor1_${RANDOM_SUFFIX}" "i2p_${RANDOM_SUFFIX}"

# Remove the Docker network
docker network rm "stealth_net_${RANDOM_SUFFIX}"

echo "Stealth job successful. Results are saved to ./data/chroma_db"
echo "Log file: ${LOG_FILE}"

# Note: cleanup function will be called automatically on exit
