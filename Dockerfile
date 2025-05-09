
# Start with a builder image for dependency installation
FROM python:3.10-slim AS builder

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=off \
    PIP_DISABLE_PIP_VERSION_CHECK=on

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user
RUN groupadd -g 1000 appuser && \
    useradd -u 1000 -g appuser -s /bin/bash -m appuser

# Copy requirements first for better caching
COPY requirements.txt /tmp/
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# Multi-stage build using Google's Distroless Python image for minimal attack surface
# This image is signed and can be verified with Docker Content Trust
FROM gcr.io/distroless/python3:nonroot

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    CHROMA_DB_PATH=/app/data/chroma_db \
    TOR_SOCKS_HOST=tor \
    TOR_SOCKS_PORT=9050 \
    LOG_LEVEL=INFO \
    LOG_FILE=/app/logs/dark_web_ingestion.log \
    COLLECTION_NAME=samgpt

# Copy Python packages from builder
COPY --from=builder /usr/local/lib/python3.10/site-packages /usr/local/lib/python3.10/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Create directory structure - note Distroless doesn't have shell so we do this in builder
WORKDIR /app

# Copy application code and boot verification script
COPY src/utils/dark_web_ingestion.py /app/src/utils/
COPY src/utils/verify_integrity.py /app/src/utils/
COPY requirements.txt /app/
COPY attestation_key.pub /app/

# Set runtime user - Distroless nonroot image runs as uid 65532
USER 65532:65532

# Healthcheck to verify integrity - runs the verification script
HEALTHCHECK --interval=5m --timeout=30s \
  CMD ["python", "/app/src/utils/verify_integrity.py", "--check"]

# Run as non-root user
ENTRYPOINT ["python", "/app/src/utils/dark_web_ingestion.py"]
CMD ["--help"]
