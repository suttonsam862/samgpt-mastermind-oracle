
#!/bin/bash
set -e

# Ephemeral job script for dark web ingestion
# This script creates a one-time-use container for a single ingestion job,
# runs it, captures results, then completely removes all traces

# Generate a unique random container name to avoid predictability
RANDOM_SUFFIX=$(cat /dev/urandom | tr -dc 'a-z0-9' | fold -w 8 | head -n 1)
CONTAINER_NAME="ephemeral-ingestion-${RANDOM_SUFFIX}"

echo "Creating ephemeral container: ${CONTAINER_NAME}"

# Create temporary network
NETWORK_NAME="ephemeral-net-${RANDOM_SUFFIX}"
docker network create --internal "${NETWORK_NAME}"

# Create a short-lived Tor container
TOR_CONTAINER="ephemeral-tor-${RANDOM_SUFFIX}"
docker run -d --name "${TOR_CONTAINER}" \
    --network "${NETWORK_NAME}" \
    --cap-drop ALL \
    --security-opt no-new-privileges=true \
    --read-only \
    dperson/tor:latest

# Wait for Tor to be ready
echo "Waiting for Tor to initialize..."
sleep 5

# Directory for output (with secure permissions)
OUTPUT_DIR="./data/ephemeral_output_${RANDOM_SUFFIX}"
mkdir -p "${OUTPUT_DIR}"
chmod 700 "${OUTPUT_DIR}"

# Run the ingestion container with all security features enabled
echo "Running ephemeral ingestion job..."
docker run --rm --name "${CONTAINER_NAME}" \
    --network "${NETWORK_NAME}" \
    --link "${TOR_CONTAINER}:tor" \
    --cap-drop ALL \
    --security-opt no-new-privileges=true \
    --security-opt seccomp=configs/seccomp_ingestion.json \
    --read-only \
    --tmpfs /app/tmp:rw,size=100M,noexec,nosuid,nodev \
    -v "${PWD}/data/urls.json:/app/data/urls.json:ro" \
    -v "${OUTPUT_DIR}:/app/data/chroma_db:rw" \
    -v "${PWD}/logs:/app/logs:rw" \
    -e TOR_SOCKS_HOST=tor \
    -e TOR_SOCKS_PORT=9050 \
    -e LOG_LEVEL=INFO \
    -e CHROMA_DB_PATH=/app/data/chroma_db \
    darkweb-ingestion:latest --file /app/data/urls.json

# Job completed
echo "Ephemeral job completed"

# Copy results to persistent storage (if needed)
echo "Saving results to persistent storage..."
cp -r "${OUTPUT_DIR}"/* ./data/chroma_db/

# Stop and remove Tor container
echo "Cleaning up temporary containers..."
docker stop "${TOR_CONTAINER}"
docker rm "${TOR_CONTAINER}"

# Remove temporary network
docker network rm "${NETWORK_NAME}"

# Securely delete temporary files
echo "Securely wiping temporary files..."
find "${OUTPUT_DIR}" -type f -exec shred -u {} \;
rm -rf "${OUTPUT_DIR}"

# Zero out any logs
> logs/ephemeral-job.log

echo "Ephemeral job complete and cleanup finished"
echo "Results are saved to ./data/chroma_db"
