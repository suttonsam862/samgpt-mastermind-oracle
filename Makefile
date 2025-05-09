
.PHONY: scan-secure docker-build docker-run docker-stop clean logs help

# Default target
help:
	@echo "Available targets:"
	@echo "  scan-secure    - Run security scan and start secure container"
	@echo "  docker-build   - Build Docker image"
	@echo "  docker-run     - Start Docker containers"
	@echo "  docker-stop    - Stop Docker containers"
	@echo "  clean          - Remove temporary files and Docker resources"
	@echo "  logs           - View logs from running containers"

# Run security scan and launch Docker container
scan-secure:
	chmod +x scan-secure.sh
	./scan-secure.sh

# Build Docker image
docker-build:
	docker-compose build

# Run Docker containers
docker-run:
	docker-compose up -d

# Stop Docker containers
docker-stop:
	docker-compose down

# Clean up resources
clean:
	docker-compose down --rmi all --volumes --remove-orphans
	rm -rf *.log __pycache__ .pytest_cache

# View logs
logs:
	docker-compose logs -f
