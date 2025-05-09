
#!/bin/bash
set -e

# Policy check script for ensuring all security controls are in place

echo "Running policy compliance checks..."

# Check for required security files
REQUIRED_FILES=(
  "configs/apparmor/ingestion_profile"
  "configs/seccomp_ingestion.json"
  "configs/falco/falco_rules.yaml"
  "src/utils/verify_integrity.py"
  "src/utils/vault_integration.py"
)

MISSING_FILES=0
for file in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "POLICY VIOLATION: Required security file missing: $file"
    MISSING_FILES=$((MISSING_FILES + 1))
  fi
done

# Check Docker configuration
if ! grep -q "read_only: true" docker-compose.yml; then
  echo "POLICY VIOLATION: Container must use read-only filesystem"
  MISSING_FILES=$((MISSING_FILES + 1))
fi

if ! grep -q "no-new-privileges:true" docker-compose.yml; then
  echo "POLICY VIOLATION: Container must use no-new-privileges flag"
  MISSING_FILES=$((MISSING_FILES + 1))
fi

if ! grep -q "cap_drop" docker-compose.yml; then
  echo "POLICY VIOLATION: Container must drop capabilities"
  MISSING_FILES=$((MISSING_FILES + 1))
fi

# Check code for security issues
if ! grep -q "sanitize_html" src/utils/dark_web_ingestion.py; then
  echo "POLICY VIOLATION: HTML sanitization function missing"
  MISSING_FILES=$((MISSING_FILES + 1))
fi

if ! grep -q "alert_on_anomaly" src/utils/dark_web_ingestion.py; then
  echo "POLICY VIOLATION: Anomaly detection function missing"
  MISSING_FILES=$((MISSING_FILES + 1))
fi

# Check for secrets in code
if grep -r "password\|secret\|token\|key\|credential" --include="*.py" src/ | grep -v "os.getenv\|vault_client.get_secret"; then
  echo "POLICY VIOLATION: Hard-coded secrets detected in code"
  MISSING_FILES=$((MISSING_FILES + 1))
fi

# Check Dockerfile for secure practices
if ! grep -q "nonroot" Dockerfile; then
  echo "POLICY VIOLATION: Dockerfile must use non-root user"
  MISSING_FILES=$((MISSING_FILES + 1))
fi

# Report results
if [ "$MISSING_FILES" -gt 0 ]; then
  echo "POLICY CHECK FAILED: $MISSING_FILES violations found"
  exit 1
else
  echo "POLICY CHECK PASSED: All required security controls are in place"
  exit 0
fi
