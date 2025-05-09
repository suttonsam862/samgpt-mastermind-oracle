
# Basic Vault configuration for development
# In production, use cloud KMS for auto-unseal

storage "file" {
  path = "/vault/file"
}

listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = 1  # Enable TLS in production with proper certificates
}

# Use KMS for auto-unsealing in production
# seal "awskms" {
#   region     = "us-west-2"
#   kms_key_id = "alias/vault-unseal-key"
# }

# In production, disable this and use proper unsealing
disable_mlock = true

ui = true

# Enable response wrapping for enhanced security
default_lease_ttl = "1h"
max_lease_ttl = "24h"

# Configure Vault for ultimate stealth mode
# Require TLS for all clients in production
# api_addr = "https://vault.example.com:8200"
# require_request_header = true

# Automatic key rotation for added security
# Uncomment in production
# seal "transit" {
#   address            = "https://vault-transit.example.com:8200"
#   token              = "s.transit-unseal-token"
#   disable_renewal    = "false"
#   key_name           = "autounseal"
#   mount_path         = "transit/"
# }

# Telemetry for monitoring
telemetry {
  disable_hostname = true
  prometheus_retention_time = "24h"
}

# For production, enable HSM support
# hsm {
#   plugin_name = "pkcs11"
#   slot = "0"
#   pin = "12345"
#   key_label = "vault-hsm-key"
# }

# Configure the secret maximum TTLs for different engines
max_lease_ttl_seconds = 86400  # 24 hours
default_lease_ttl_seconds = 3600  # 1 hour
