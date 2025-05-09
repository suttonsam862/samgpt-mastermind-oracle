
# Use Python 3.10 slim as base image for minimal footprint
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

# Multi-stage build for smaller final image
FROM python:3.10-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=off \
    PIP_DISABLE_PIP_VERSION_CHECK=on \
    CHROMA_DB_PATH=/app/data/chroma_db \
    TOR_SOCKS_HOST=tor \
    TOR_SOCKS_PORT=9050 \
    LOG_LEVEL=INFO \
    LOG_FILE=/app/logs/dark_web_ingestion.log \
    COLLECTION_NAME=samgpt

# Create a non-root user
RUN groupadd -g 1000 appuser && \
    useradd -u 1000 -g appuser -s /bin/bash -m appuser

# Create directory structure
RUN mkdir -p /app/src/utils /app/data /app/logs && \
    chown -R appuser:appuser /app

# Copy installed packages from builder stage
COPY --from=builder /usr/local/lib/python3.10/site-packages /usr/local/lib/python3.10/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Set the working directory
WORKDIR /app

# Copy application code
COPY src/utils/dark_web_ingestion.py /app/src/utils/
COPY requirements.txt /app/

# Set ownership
RUN chown -R appuser:appuser /app

# Create directories that need write permissions in read-only mode
RUN mkdir -p /app/tmp && chown -R appuser:appuser /app/tmp

# Switch to non-root user
USER appuser

# Run as non-root user
ENTRYPOINT ["python", "/app/src/utils/dark_web_ingestion.py"]
CMD ["--help"]
