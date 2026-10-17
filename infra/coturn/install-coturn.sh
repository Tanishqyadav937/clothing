#!/bin/bash
# Install and configure coTURN TURN server on Ubuntu/Debian

set -e

echo "Starting coTURN installation..."

# Update system packages
echo "Updating package manager..."
apt-get update
apt-get install -y coturn

# Create necessary directories
echo "Creating directories..."
mkdir -p /etc/coturn
mkdir -p /var/log/coturn
mkdir -p /var/run/coturn

# Copy configuration file
echo "Copying configuration..."
cp /root/turnserver.conf /etc/coturn/turnserver.conf

# Replace environment variables in config
if [ -n "$TURN_REALM" ]; then
  sed -i "s/realm=example.com/realm=$TURN_REALM/" /etc/coturn/turnserver.conf
fi

if [ -n "$TURN_SECRET" ]; then
  sed -i "s/static-auth-secret=your-secret-key/static-auth-secret=$TURN_SECRET/" /etc/coturn/turnserver.conf
fi

# Set permissions
chown -R turnserver:turnserver /etc/coturn
chown -R turnserver:turnserver /var/log/coturn
chown -R turnserver:turnserver /var/run/coturn

# Enable coTURN service
echo "Enabling coTURN service..."
echo 'TURNSERVER_ENABLED=1' > /etc/default/coturn

# Start and enable service
systemctl daemon-reload
systemctl enable coturn
systemctl start coturn

# Configure firewall (UFW)
echo "Configuring firewall rules..."
if command -v ufw &> /dev/null; then
  ufw allow 3478/udp
  ufw allow 3478/tcp
  ufw allow 5349/tcp
  ufw allow 49152:65535/udp
fi

echo "coTURN installation completed successfully!"
echo "Service status:"
systemctl status coturn
