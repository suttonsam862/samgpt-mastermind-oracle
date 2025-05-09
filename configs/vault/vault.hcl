
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
