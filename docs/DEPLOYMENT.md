# CallMe Deployment Guide

Complete step-by-step instructions for deploying CallMe to production.

---

## Prerequisites

- Git repository cloned locally
- Node.js 18+ installed
- Docker and Docker Compose (optional, for containerized deployment)
- Firebase project created
- Domain name (optional, but recommended)

---

## Part 1: Firebase Setup

### 1.1 Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Create a project"
3. Enter project name (e.g., "CallMe")
4. Accept terms and continue
5. Skip Google Analytics (optional)

### 1.2 Enable Authentication

1. In Firebase console, go to **Authentication** > **Sign-in method**
2. Enable **Email/Password**
3. Go to **Settings** > **Users and permissions**
4. Copy the Firebase config from **Project Settings** > **Your apps** > **Web**

### 1.3 Enable Firestore Database

1. Go to **Firestore Database**
2. Create database in production mode
3. Set location (choose closest to your users)
4. Start in locked mode (we'll add rules)

### 1.4 Deploy Firestore Rules

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Deploy rules
firebase deploy --only firestore:rules
```

The rules file is at `/infra/firestore.rules`.

### 1.5 Create Service Account

1. Go to **Project Settings** > **Service Accounts**
2. Click "Generate new private key"
3. Save the JSON file securely
4. Copy `project_id`, `private_key`, and `client_email`

---

## Part 2: Signaling Server Deployment

### 2.1 Local Setup & Testing

```bash
# Navigate to server directory
cd server

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Fill in Firebase credentials (from Part 1)
# FIREBASE_PROJECT_ID=your-project-id
# FIREBASE_PRIVATE_KEY=your-private-key
# FIREBASE_CLIENT_EMAIL=your-service-account-email
# TURN_REALM=your-domain.com
# TURN_SECRET=your-secret-key
```

### 2.2 Deploy to Render (Free Tier)

1. Push your code to GitHub
2. Go to [render.com](https://render.com)
3. Click "New +" > "Web Service"
4. Connect GitHub repository
5. Configure:
   - **Name**: callme-signaling
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
6. Add environment variables from `.env`
7. Deploy

### 2.3 Deploy to Railway

1. Install Railway CLI: `npm install -g @railway/cli`
2. Login: `railway login`
3. Create project: `railway init`
4. Add environment variables:
   ```bash
   railway variables set FIREBASE_PROJECT_ID=your-project-id
   railway variables set FIREBASE_PRIVATE_KEY=your-private-key
   # ... etc
   ```
5. Deploy: `railway up`

### 2.4 Deploy to Fly.io

```bash
# Install Flyctl
# macOS: brew install flyctl
# Linux/Windows: see https://fly.io/docs/getting-started/installing-flyctl/

# Login
flyctl auth login

# Create app
flyctl apps create callme-signaling

# Deploy
flyctl deploy

# Set environment variables
flyctl secrets set FIREBASE_PROJECT_ID=your-project-id
# ... set others
```

### 2.5 Health Check

```bash
# Test endpoint
curl https://your-signaling-server.com/health

# Should return:
# {"status":"ok"}
```

---

## Part 3: TURN Server Deployment

### 3.1 Provision VPS

**Recommended Providers:**
- DigitalOcean (cheapest, $6/month)
- Linode
- Vultr
- AWS EC2

**Specifications:**
- OS: Ubuntu 20.04 LTS
- Memory: 1GB RAM minimum
- vCPU: 1 core
- Storage: 10GB
- Public IP: Required

### 3.2 Install coTURN

```bash
# SSH into VPS
ssh root@your-vps-ip

# Download and run installation script
wget https://your-repo/infra/coturn/install-coturn.sh
export TURN_REALM=example.com
export TURN_SECRET=$(openssl rand -base64 32)
bash install-coturn.sh
```

Save the `TURN_SECRET` value — you'll need it for the signaling server.

### 3.3 Configure Firewall

```bash
# UFW rules (if using UFW)
ufw allow 22/tcp
ufw allow 3478/tcp
ufw allow 3478/udp
ufw allow 5349/tcp
ufw allow 49152:65535/udp
ufw enable

# Or for AWS Security Groups:
# Inbound rules:
# - TCP 22 (SSH)
# - TCP 3478
# - UDP 3478
# - TCP 5349
# - UDP 49152-65535
```

### 3.4 Test TURN Server

```bash
# From your local machine
stunclient -v your-vps-ip 3478

# Should see:
# Binding test: success
# Mapped address: your-vps-ip:xxxxx
```

---

## Part 4: Web App Deployment

### 4.1 Build Web App

```bash
cd apps/web

# Create .env file
cat > .env << EOF
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_SIGNALING_SERVER_URL=https://your-signaling-server.com
EOF

# Build
npm install
npm run build

# Output in dist/
```

### 4.2 Deploy to Netlify

1. Go to [netlify.com](https://netlify.com)
2. Click "New site from Git"
3. Connect GitHub repository
4. Configure:
   - **Base directory**: `apps/web`
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
5. Add environment variables (from `.env`)
6. Deploy

### 4.3 Deploy to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Import project from GitHub
3. Select `apps/web` as root directory
4. Add environment variables
5. Deploy

### 4.4 Deploy to S3 + CloudFront

```bash
# Create S3 bucket
aws s3 mb s3://callme-app

# Upload build files
aws s3 sync apps/web/dist s3://callme-app \
  --delete \
  --cache-control "public, max-age=3600"

# Create CloudFront distribution pointing to S3
# (via AWS Console)
```

---

## Part 5: Environment Variables

### Server Environment Variables

```env
# Firebase
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-service-account-email

# TURN
TURN_REALM=example.com
TURN_SECRET=your-secret-key (use output from install-coturn.sh)

# Server
NODE_ENV=production
PORT=3001
LOG_LEVEL=info
```

### Web App Environment Variables

```env
# Firebase (public, safe to expose)
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_APP_ID=your-app-id

# Signaling Server
VITE_SIGNALING_SERVER_URL=https://your-signaling-server.com
```

---

## Part 6: Custom Domain Setup

### 6.1 Point Domain to Web App (Netlify/Vercel)

1. Buy domain from registrar (Namecheap, GoDaddy, etc.)
2. Go to Netlify/Vercel dashboard
3. **Domain settings** > **Add custom domain**
4. Follow instructions to point DNS to Netlify/Vercel nameservers

### 6.2 Point Domain to Signaling Server

```bash
# If using Render/Railway/Fly.io:
# Add DNS CNAME record:
# your-signaling-server.com CNAME app.your-platform.com

# Get CNAME target from deployment platform
```

### 6.3 SSL Certificates

- Netlify/Vercel: Automatic (Let's Encrypt)
- Render/Railway/Fly.io: Automatic (Let's Encrypt)
- S3 + CloudFront: Setup in AWS Certificate Manager

---

## Part 7: Testing Deployment

### 7.1 Health Checks

```bash
# Signaling server
curl https://your-signaling-server.com/health
# Expected: {"status":"ok"}

# TURN server
stunclient your-vps-ip 3478
# Expected: Binding test: success

# Web app
curl https://your-domain.com
# Expected: HTML with CallMe app
```

### 7.2 End-to-End Call Test

1. Open https://your-domain.com in two browser tabs
2. Sign up first user (email1@test.com, username: alice)
3. Sign up second user (email2@test.com, username: bob)
4. From alice: Search and add bob
5. From bob: Accept contact request
6. From alice: Initiate call to bob
7. From bob: Accept incoming call
8. Verify audio negotiation completes
9. End call and check call history

---

## Part 8: Monitoring and Logging

### 8.1 Signaling Server Logs

**Render:**
```bash
# In Render dashboard: Logs tab
```

**Railway:**
```bash
railway logs
```

**Fly.io:**
```bash
flyctl logs
```

### 8.2 TURN Server Logs

```bash
# SSH into VPS
tail -f /var/log/coturn/coturn.log

# Monitor script
bash /root/infra/coturn/monitoring.sh
```

### 8.3 Firebase Logs

- Go to Firebase Console > Cloud Functions > Logs
- Or use `firebase functions:log`

### 8.4 Error Tracking

**Recommended:**
- [Sentry](https://sentry.io) (error tracking)
- [LogRocket](https://logrocket.com) (session replay)
- [DataDog](https://www.datadoghq.com/) (monitoring)

---

## Part 9: Production Checklist

- [ ] Firebase project created and configured
- [ ] Firestore rules deployed
- [ ] Signaling server deployed (health check passing)
- [ ] TURN server running and reachable
- [ ] Web app deployed and accessible
- [ ] Custom domain setup (optional but recommended)
- [ ] SSL/TLS certificates valid
- [ ] Environment variables set correctly
- [ ] Firebase console monitoring setup
- [ ] Signaling server logs viewable
- [ ] TURN server logs configured
- [ ] End-to-end call test successful
- [ ] Rate limiting configured
- [ ] Error monitoring setup
- [ ] Backup strategy for Firestore data

---

## Troubleshooting

### Firebase Authentication Issues

**Problem**: "PERMISSION_DENIED: Missing or insufficient permissions"

**Solution**:
1. Check Firestore rules are deployed
2. Verify user is authenticated (check Firebase console > Authentication)
3. Check security rules match requirements

### Signaling Server Won't Start

**Problem**: Port already in use or environment variables missing

**Solution**:
```bash
# Check port
lsof -i :3001

# Verify environment variables
echo $FIREBASE_PROJECT_ID
echo $TURN_SECRET

# Restart
systemctl restart app (if systemd)
```

### TURN Server Not Working

**Problem**: Calls fail to connect, error in logs

**Solution**:
1. Verify firewall rules: `ufw status`
2. Check ports listening: `ss -ulnp | grep 3478`
3. Test connectivity: `stunclient your-vps-ip 3478`
4. Check credentials match between server and client

### Web App Shows "Connection Error"

**Problem**: Cannot connect to signaling server

**Solution**:
1. Check `VITE_SIGNALING_SERVER_URL` is correct
2. Verify signaling server is running
3. Check browser console for CORS errors
4. Verify SSL certificate valid

---

## Scaling for Production

**Phase 1: MVP (1k users)**
- Single signaling instance
- Single TURN server
- Firestore auto-scaling

**Phase 2: Growth (10k users)**
- Load balancer + multiple signaling instances
- Redis adapter for Socket.io state
- Multiple TURN servers by region

**Phase 3: Enterprise (100k+ users)**
- Kubernetes cluster for signaling
- Database sharding/replication
- CDN for static assets
- SFU (Selective Forwarding Unit) for group calls

---

## Support and Maintenance

- Monitor logs daily for errors
- Update dependencies monthly
- Run Firestore backups weekly
- Test TURN server monthly
- Review cost reports monthly
- Set up alerts for downtime
