
#!/bin/bash
# Ultimate stealth network isolation ruleset
# This script sets up the host firewall to prevent any leaks

set -e

# Define the Tor network namespace
TOR_NS="stealth_net"
TOR_VETH="veth0_${TOR_NS}"
TOR_DNS_PORT=5353
TOR_SOCKS_PORTS="9050 9051 9052"

echo "Setting up ultimate stealth iptables rules..."

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
iptables -P OUTPUT DROP

# Allow loopback
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

# Allow established connections
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Allow connections to Tor SOCKS ports from container/namespace only
for port in ${TOR_SOCKS_PORTS}; do
    iptables -A INPUT -i ${TOR_VETH} -p tcp --dport ${port} -j ACCEPT
done

# Allow connections to Tor DNS port from container/namespace only
iptables -A INPUT -i ${TOR_VETH} -p udp --dport ${TOR_DNS_PORT} -j ACCEPT

# NAT for the stealth network namespace
iptables -t nat -A POSTROUTING -s 10.0.0.0/24 -o eth0 -j MASQUERADE

# Block all outbound DNS queries except through Tor's DNSPort
iptables -A OUTPUT -p udp --dport 53 -j DROP
iptables -A OUTPUT -p tcp --dport 53 -j DROP
iptables -A FORWARD -p udp --dport 53 -j DROP
iptables -A FORWARD -p tcp --dport 53 -j DROP

# Allow outbound Tor connections only
iptables -A OUTPUT -m owner --uid-owner tor -j ACCEPT

# Block all direct outbound connections from container/namespace
iptables -A FORWARD -i ${TOR_VETH} ! -o ${TOR_VETH} -j DROP

# Block IPv6 completely to prevent leaks
ip6tables -P INPUT DROP
ip6tables -P FORWARD DROP
ip6tables -P OUTPUT DROP

# Log dropped packets for auditing
iptables -A INPUT -j LOG --log-prefix "IPTABLES DROP INPUT: " --log-level 4
iptables -A OUTPUT -j LOG --log-prefix "IPTABLES DROP OUTPUT: " --log-level 4
iptables -A FORWARD -j LOG --log-prefix "IPTABLES DROP FORWARD: " --log-level 4

echo "Stealth iptables rules applied"

# Save rules
if [ -d /etc/iptables ]; then
    iptables-save > /etc/iptables/rules.v4
    ip6tables-save > /etc/iptables/rules.v6
    echo "Rules saved to /etc/iptables/"
fi

# Configure DNS to use only Tor
if [ -f /etc/resolv.conf ]; then
    echo "Configuring DNS to use Tor only"
    cp /etc/resolv.conf /etc/resolv.conf.backup
    echo "nameserver 127.0.0.1" > /etc/resolv.conf
    echo "options use-vc" >> /etc/resolv.conf
fi

echo "Stealth network isolation complete"
