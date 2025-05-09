
#!/bin/bash
# Host-level firewall rules to enforce network isolation for Tor container

# Flush existing rules
iptables -F
iptables -X
iptables -t nat -F
iptables -t nat -X
iptables -t mangle -F
iptables -t mangle -X

# Set default policies
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT ACCEPT

# Allow loopback
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

# Allow established connections
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Allow Docker bridge networks (adjust these based on your Docker network configuration)
iptables -A INPUT -i br-tor -j ACCEPT
iptables -A OUTPUT -o br-tor -j ACCEPT
iptables -A INPUT -i br-services -j ACCEPT
iptables -A OUTPUT -o br-services -j ACCEPT

# Block all outbound DNS queries from the Tor container
iptables -A FORWARD -s 172.28.0.0/24 -p udp --dport 53 -j DROP
iptables -A FORWARD -s 172.28.0.0/24 -p tcp --dport 53 -j DROP

# Only allow Tor to make outbound connections (to Tor network)
iptables -A FORWARD -s 172.28.0.0/24 ! -d 172.28.0.0/24 -j ACCEPT

# Block all direct outbound connections from the ingestion container
iptables -A FORWARD -s 172.28.0.0/24 -d 0.0.0.0/0 -j DROP

# Log dropped packets for auditing
iptables -A INPUT -j LOG --log-prefix "IPTABLES DROPPED: " --log-level 4
iptables -A FORWARD -j LOG --log-prefix "IPTABLES DROPPED: " --log-level 4

# Save rules
iptables-save > /etc/iptables/rules.v4
echo "Firewall rules applied and saved"
