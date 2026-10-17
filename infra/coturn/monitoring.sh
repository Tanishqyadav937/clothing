#!/bin/bash
# Monitor coTURN TURN server status and connections

echo "=== coTURN Server Monitoring ==="
echo ""

# Check service status
echo "1. Service Status:"
systemctl status coturn --no-pager || echo "Service not running"
echo ""

# Check UDP listener
echo "2. UDP Port Listener (3478):"
if command -v ss &> /dev/null; then
  ss -ulnp | grep 3478 || echo "UDP 3478 not listening"
else
  netstat -ulnp 2>/dev/null | grep 3478 || echo "UDP 3478 not listening"
fi
echo ""

# Check TCP listener
echo "3. TCP Port Listener (3478):"
if command -v ss &> /dev/null; then
  ss -tlnp | grep 3478 || echo "TCP 3478 not listening"
else
  netstat -tlnp 2>/dev/null | grep 3478 || echo "TCP 3478 not listening"
fi
echo ""

# Check TLS listener
echo "4. TLS Port Listener (5349):"
if command -v ss &> /dev/null; then
  ss -tlnp | grep 5349 || echo "TLS 5349 not listening"
else
  netstat -tlnp 2>/dev/null | grep 5349 || echo "TLS 5349 not listening"
fi
echo ""

# Check log file
echo "5. Recent Log Entries (last 20 lines):"
if [ -f /var/log/coturn/coturn.log ]; then
  tail -20 /var/log/coturn/coturn.log
else
  echo "Log file not found at /var/log/coturn/coturn.log"
fi
echo ""

# Check active connections
echo "6. Active Connections:"
if command -v ss &> /dev/null; then
  CONNECTIONS=$(ss -u | grep -c ESTAB || echo 0)
else
  CONNECTIONS=$(netstat -u 2>/dev/null | grep -c ESTAB || echo 0)
fi
echo "Active UDP connections: $CONNECTIONS"
echo ""

# Check disk space
echo "7. Disk Space Usage:"
df -h /var/log/coturn || echo "Cannot check disk space"

echo ""
echo "=== End of Report ==="
