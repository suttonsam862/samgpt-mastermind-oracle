
.PHONY: scan-secure docker-build docker-run docker-stop clean logs help run-ephemeral audit-deps verify-integrity falco-monitor

# Default target
help:
	@echo "Available targets:"
	@echo "  scan-secure      - Run security scan and start secure container"
	@echo "  docker-build     - Build Docker image"
	@echo "  docker-run       - Start Docker containers"
	@echo "  docker-stop      - Stop Docker containers"
	@echo "  clean            - Remove temporary files and Docker resources"
	@echo "  logs             - View logs from running containers"
	@echo "  run-ephemeral    - Run single-use ephemeral container for one job"
	@echo "  audit-deps       - Audit dependencies for security vulnerabilities"
	@echo "  verify-integrity - Verify container integrity"
	@echo "  falco-monitor    - Run Falco runtime security monitoring"

# Run security scan and launch Docker container
scan-secure:
	chmod +x scan-secure.sh
	./scan-secure.sh

# Build Docker image
docker-build:
	# Enable Docker Content Trust for verifying image signatures
	export DOCKER_CONTENT_TRUST=1
	# Build with security flags
	docker-compose build --no-cache --pull

# Run Docker containers
docker-run:
	# Create required directories with secure permissions
	mkdir -p data logs configs/apparmor configs/falco
	chmod 750 data logs
	# Load AppArmor profiles if available
	if [ -x "$(command -v apparmor_parser)" ]; then \
		sudo apparmor_parser -r -W configs/apparmor/*; \
	fi
	# Start containers
	docker-compose up -d
	# Verify container integrity
	docker exec darkweb-ingestion python /app/src/utils/verify_integrity.py --check

# Stop Docker containers
docker-stop:
	docker-compose down
	# Perform security cleanup
	./scripts/security_cleanup.sh

# Clean up resources
clean:
	docker-compose down --rmi all --volumes --remove-orphans
	rm -rf *.log __pycache__ .pytest_cache
	# Securely wipe sensitive data
	find ./data -type f -name "*.json" -exec shred -u {} \;

# View logs
logs:
	docker-compose logs -f

# Audit dependencies for vulnerabilities
audit-deps:
	@echo "Running security audits on dependencies..."
	pip-audit --requirement requirements.txt --format json > security-audit-pip.json
	safety check --full-report --file requirements.txt > security-audit-safety.txt
	bandit -r src/ -f json -o security-audit-bandit.json
	@echo "Checking for policy violations..."
	./scripts/policy_check.sh

# Run container in ephemeral mode for single job
run-ephemeral:
	./scripts/ephemeral_job.sh

# Verify container integrity
verify-integrity:
	docker exec darkweb-ingestion python /app/src/utils/verify_integrity.py --check

# Run Falco runtime security monitoring
falco-monitor:
	docker run --rm -it --name falco \
		--privileged \
		-v /var/run/docker.sock:/host/var/run/docker.sock \
		-v /dev:/host/dev \
		-v /proc:/host/proc:ro \
		-v /boot:/host/boot:ro \
		-v /lib/modules:/host/lib/modules:ro \
		-v /usr:/host/usr:ro \
		-v $(PWD)/configs/falco/falco_rules.yaml:/etc/falco/falco_rules.local.yaml \
		falcosecurity/falco:latest
