# TURN Server Configuration and Guide

## What is TURN?

TURN (Traversal Using Relays around NAT) is a protocol that relays media streams when direct peer-to-peer connections fail. It serves as a fallback when:

- Both peers are behind different NATs
- Firewall blocks P2P connections
- Symmetric NAT makes P2P impossible

## How TURN Works in CallMe

1. **STUN Discovery**: Both peers first try to discover their public IP using STUN (Simple Traversal of User Datagram Protocol)
2. **P2P Attempt**: They attempt direct connection using discovered IPs
3. **TURN Fallback**: If P2P fails, they connect through the TURN relay server
4. **Media Relay**: The TURN server relays audio/video between peers

Without TURN, approximately 15-20% of calls would fail in restrictive network environments.

---

## coTURN Configuration

### Key Settings

**Listening Ports:**
```
listening-port=3478       # UDP and TCP
tls-listening-port=5349   # TLS (requires certificate)
```

**Realm and Authentication:**
```
realm=example.com
static-auth-secret=your-32-char-secret-key
use-auth-secret
```

The realm identifies your TURN server. Clients must know the realm to authenticate.

**Port Allocation:**
```
min-port=49152
max-port=65535
```

These ephemeral ports are allocated for media relay (16,384 ports available).

**Bandwidth Limiting:**
```
bps-capacity=1000000    # 1 Mbps per user limit
user-quota=100          # Max 100 concurrent users per session
```

---

## Time-Limited Credentials

### Credential Generation

Instead of static username/password, CallMe uses time-limited HMAC credentials:

```
username: <timestamp>:<original-username>
password: HMAC-SHA1(secret, username)
```

Example:
```
timestamp: 1700000000
username: alice
secret: my-secret-key

TURN username: 1700000000:alice
TURN password: base64(HMAC-SHA1("my-secret-key", "1700000000:alice"))
```

### Server-Side Generation

The signaling server generates credentials on-demand:

```javascript
const timestamp = Math.floor(Date.now() / 1000) + 3600; // 1 hour validity
const username = `${timestamp}:${user.username}`;
const password = crypto
  .createHmac('sha1', TURN_SECRET)
  .update(username)
  .digest('base64');

return {
  username,
  password,
  ttl: 3600,
  urls: ['turn:turn.example.com:3478', ...]
};
```

### Client-Side Usage

```javascript
const pc = new RTCPeerConnection({
  iceServers: [
    {
      urls: 'turn:turn.example.com:3478',
      username: credentials.username,
      credential: credentials.password
    }
  ]
});
```

---

## Deployment

### VPS Requirements

- **Provider**: DigitalOcean, Linode, AWS EC2, etc.
- **Cost**: ~$6-12/month (1GB RAM, 1 CPU, 1Gbps)
- **OS**: Ubuntu 20.04 or later
- **Public IP**: Required (no NAT)
- **Bandwidth**: Unlimited or high quota recommended

### Installation

```bash
# SSH into VPS
ssh root@your-vps-ip

# Run installation script
curl -O https://your-repo/infra/coturn/install-coturn.sh
export TURN_REALM=example.com
export TURN_SECRET=$(openssl rand -base64 32)
bash install-coturn.sh
```

### SSL/TLS Setup (Optional but Recommended)

```bash
# Generate self-signed certificate (for testing)
openssl req -x509 -newkey rsa:2048 -keyout /etc/coturn/turn_server_pkey.pem \
  -out /etc/coturn/turn_server_cert.pem -days 365 -nodes

# Update turnserver.conf
echo "cert=/etc/coturn/turn_server_cert.pem" >> /etc/coturn/turnserver.conf
echo "pkey=/etc/coturn/turn_server_pkey.pem" >> /etc/coturn/turnserver.conf

# Restart
systemctl restart coturn
```

---

## Monitoring

### Service Status

```bash
# Check if running
systemctl status coturn

# View logs
tail -f /var/log/coturn/coturn.log

# Check listening ports
ss -ulnp | grep 3478
ss -tlnp | grep 3478
```

### Connection Counting

```bash
# Active UDP connections
netstat -u | grep -c ESTAB

# Active TCP connections
netstat -t | grep -c ESTAB
```

### Resource Usage

```bash
# CPU and memory
top -p $(pgrep turnserver)

# Open file descriptors
lsof -p $(pgrep turnserver) | wc -l
```

### Bandwidth Monitoring

Monitor relay usage:

```bash
# Network interface stats
iftop -i eth0

# Per-port usage
nethogs eth0
```

---

## Testing TURN Server

### Using stunclient

```bash
# Install
apt-get install stun-client

# Test TURN server
stunclient -v your-vps-ip 3478
```

Expected output:
```
Binding test: success
Local address: 192.168.x.x:xxxxx
Mapped address: your-vps-ip:xxxxx
Response echo test: success
```

### Manual Testing with turnutils

```bash
# Install
apt-get install coturn-turnutils

# Test credentials
turnutils_uclient -v -u alice -w password \
  -g your-vps-ip -p 3478 -e your-vps-ip \
  -- your-vps-ip 3478
```

### Browser Testing

Use WebRTC testing tools:
- [Trickle ICE](https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/)
- [WebRTC diagnostic tool](https://test.webrtc.org/)

---

## Troubleshooting

### TURN Server Not Reachable

**Check:**
1. Firewall rules open (UDP 3478, TCP 3478, TCP 5349)
2. Server listening: `ss -ulnp | grep 3478`
3. Public IP correct and accessible

**Fix:**
```bash
# UFW (Ubuntu Firewall)
ufw allow 3478/udp
ufw allow 3478/tcp
ufw allow 5349/tcp
ufw allow 49152:65535/udp

# AWS Security Groups
# Inbound: UDP 3478, TCP 3478, TCP 5349, UDP 49152-65535
```

### Authentication Failures

**Check:**
1. TURN secret matches between server and client
2. Timestamp not expired (check client clock sync)
3. Username/password format correct

**Debug:**
```bash
# View auth attempts
grep "auth" /var/log/coturn/coturn.log | tail -20

# Test credentials locally
turnutils_uclient -v -u "1700000000:alice" \
  -w "base64-encoded-password" your-vps-ip 3478
```

### High Bandwidth Usage

**Optimize:**
1. Lower `bps-capacity` to limit per-user bandwidth
2. Disable video or reduce video bitrate
3. Monitor and cap total throughput
4. Check for relay loops (both peers using TURN)

**Check:**
```bash
# Bandwidth per connection
iftop -i eth0 -p

# Kill high-bandwidth connections if needed
kill -9 $(pgrep -f "turnserver.*high-bandwidth-client")
```

### Connection Timeouts

**Common Causes:**
1. NAT timeout (> 5 minutes inactivity)
2. Firewall blocking ephemeral port range
3. TURN credentials expired

**Fix:**
1. Enable keep-alive in client WebRTC code
2. Ensure all relay ports open (49152-65535)
3. Reduce TTL or refresh credentials more frequently

---

## Performance Tuning

### Increase File Descriptors

```bash
# Edit /etc/security/limits.conf
turnserver soft nofile 1000000
turnserver hard nofile 1000000

# Restart turnserver
systemctl restart coturn
```

### Optimize Network

```bash
# Increase socket buffers
sysctl -w net.core.rmem_max=134217728
sysctl -w net.core.wmem_max=134217728
sysctl -w net.ipv4.tcp_rmem="4096 87380 67108864"
sysctl -w net.ipv4.tcp_wmem="4096 65536 67108864"
```

### Scaling to Multiple TURN Servers

For large deployments, use regional TURN servers:

```javascript
// Client: Try multiple TURN servers
const iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'turn:turn-us.example.com:3478', username: '...', credential: '...' },
  { urls: 'turn:turn-eu.example.com:3478', username: '...', credential: '...' },
  { urls: 'turn:turn-asia.example.com:3478', username: '...', credential: '...' }
];
```

---

## Bandwidth Estimation

**Per-call bandwidth:**
- Audio (high quality): 50-100 kbps
- Video (720p): 1-3 Mbps
- Total relay (both directions): ~200 kbps audio + 2-6 Mbps video

**Server capacity:**
- 1 Mbps link: ~10 concurrent calls (audio only)
- 1 Mbps link: ~2-3 concurrent video calls
- 100 Mbps link: ~500 concurrent calls (audio)

**Storage for logs:**
- Typical log: 1-2 MB/day
- Keep 30 days: ~60 MB

---

## Cost Analysis

**Monthly Cost (Single TURN Server):**
- VPS: $6-12/month
- Bandwidth: $0-20/month (depends on traffic)
- Domain: $0-12/month
- Total: $6-44/month for MVP

**Scaling Costs:**
- 3 regional servers: $50-150/month
- 10 regional servers: $150-500/month
- CDN for signaling: $0-50/month

---

## Security Considerations

1. **Secret Key**: Store in environment variable, not in code
2. **TLS Certificate**: Use Let's Encrypt (free) for production
3. **Rate Limiting**: coTURN has built-in rate limiting
4. **Firewall**: Only open required ports
5. **Monitoring**: Alert on high bandwidth/connection counts

---

## References

- [coTURN Documentation](https://coturn.net/turnserver/)
- [TURN Protocol (RFC 5766)](https://tools.ietf.org/html/rfc5766)
- [WebRTC ICE Candidates](https://developer.mozilla.org/en-US/docs/Web/API/RTCIceCandidate)
