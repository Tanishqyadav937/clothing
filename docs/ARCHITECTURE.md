# CallMe Architecture

## System Overview

CallMe is a decentralized voice calling application that enables peer-to-peer communication over the internet. The system consists of several interconnected components working together to facilitate reliable, encrypted calls.

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Internet                            │
└────────────┬──────────────────┬──────────────────┬───────────┘
             │                  │                  │
      ┌──────▼──────┐    ┌──────▼──────┐    ┌─────▼─────┐
      │ Firebase    │    │  Signaling  │    │   TURN    │
      │ (Auth +     │    │  Server     │    │  Server   │
      │ Firestore)  │    │ (Node.js +  │    │(coturn)   │
      │             │    │ Socket.io)  │    │           │
      └─────────────┘    └─────────────┘    └───────────┘
             ▲                  ▲                   ▲
             │                  │                   │
      ┌──────┴──────────────────┴───────────────────┴────┐
      │                                                   │
   ┌──▼─────────┐  ┌──▼──────────┐  ┌──▼─────────────┐
   │   Web App  │  │ Mobile App  │  │  Mobile App   │
   │  (React)   │  │  (Flutter)  │  │  (Flutter)    │
   │            │  │             │  │               │
   │  - Auth    │  │  - Auth     │  │  - Auth       │
   │  - Contacts│  │  - Contacts │  │  - Contacts   │
   │  - Calls   │  │  - Calls    │  │  - Calls      │
   │  - WebRTC  │  │  - WebRTC   │  │  - WebRTC     │
   └────────────┘  └─────────────┘  └───────────────┘
```

## Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Frontend | React 18 + TypeScript | Web client UI, state management, WebRTC peer connection |
| Mobile | Flutter | iOS/Android client, native media access |
| Backend | Node.js + Express + Socket.io | Signaling server, presence management, call routing |
| Database | Firestore | Users, contacts, call history |
| Authentication | Firebase Auth | Email/password signup and login |
| WebRTC | Browser APIs + flutter_webrtc | P2P media streaming, encryption |
| TURN | coturn | NAT/firewall traversal relay |
| Hosting | Render/Railway/Fly.io | Backend deployment |

## Call Flow Sequence

```
User A              Signaling            User B
  │                 Server               │
  │────────auth───────────────────────────│
  │◄───────auth:ok──────────────────────│
  │                                      │
  │────────call:request─────────────────►│
  │                                      │
  │                  call:incoming───────►
  │                                      │
  │                  call:accept────────◄│
  │◄──────call:accepted────────────────│
  │                                      │
  │────webrtc:offer──────────────────────│
  │                                      │
  │                webrtc:offer─────────►│
  │                                      │
  │◄────webrtc:answer─────────────────│
  │                                      │
  │◄───────webrtc:answer───────────────│
  │                                      │
  │────webrtc:ice───────────────────────►│
  │◄───webrtc:ice────────────────────────│
  │                                      │
  │         [Media Stream via P2P or TURN]
  │◄════════════════audio════════════►│
  │                                      │
  │────────call:end───────────────────────│
  │                                      │
```

## Data Models

### User
```typescript
{
  uid: string;           // Firebase UID (primary key)
  username: string;      // Unique username
  email: string;         // Email address
  displayName: string;   // Display name
  photoURL?: string;     // Profile picture URL
  createdAt: number;     // Timestamp
  lastSeen?: number;     // Last activity timestamp
}
```

### Contact
```typescript
{
  uid: string;           // Contact's UID
  ownerUid: string;      // User who owns this contact
  status: 'pending' | 'accepted' | 'blocked';
  createdAt: number;
}
```

### Call
```typescript
{
  callId: string;        // Unique call identifier (UUID)
  fromUid: string;       // Caller's UID
  toUid: string;         // Callee's UID
  status: 'calling' | 'ringing' | 'answered' | 'completed' | 'rejected' | 'missed';
  startedAt: number;     // When call was initiated
  answeredAt?: number;   // When call was answered
  endedAt?: number;      // When call ended
  duration?: number;     // Call duration in seconds
}
```

## Security Model

### Authentication
- Firebase ID tokens used for all API and WebSocket requests
- Tokens expire after 1 hour; refresh tokens handled transparently
- Server validates every incoming message's token

### Media Encryption
- WebRTC enforces DTLS-SRTP for all media streams
- Media never flows through signaling server
- P2P connections preferred, TURN fallback only when necessary

### Authorization
- Contacts-only calling: users can only call accepted contacts
- Server-side permission checks on every call attempt
- Blocked users cannot send calls or contact requests

### Rate Limiting
- 100 API requests per user per 15 minutes
- 10 calls per user per minute
- Contact request throttling to prevent spam

### Data Privacy
- Email stored in Firestore but never exposed to other users
- User profiles show only username, displayName, photoURL
- Call history visible only to call participants

## Deployment Topology

```
┌─ CDN ─────────────────┐
│   (Web app bundle)    │
└────────────┬──────────┘
             │
             ▼
   ┌─────────────────┐
   │ Render/Railway  │
   │ (Signaling Srv) │
   │ Node.js + S.io  │
   └────────┬────────┘
            │
      ┌─────┴──────┬──────────┐
      │            │          │
      ▼            ▼          ▼
   Firestore  Firestore   coTURN VPS
   (Auth)     (Database)  (Public IP)
   (Google)   (Google)    (DigitalOcean)
```

### Scaling Considerations

**Stage 1: MVP (1-1,000 users)**
- Single signaling server instance
- Single TURN server
- Firestore auto-scaling

**Stage 2: Growth (1,000-10,000 users)**
- Multiple signaling instances behind load balancer (sticky sessions)
- Redis adapter for Socket.io state sharing
- Multiple regional TURN servers
- Firestore sharding

**Stage 3: Production (10,000+ users)**
- Kubernetes orchestration for signaling servers
- CDN for static assets
- Database read replicas
- Dedicated TURN server farms per region
- Monitoring and alerting system

## Reliability

### Fallback Mechanisms
- **STUN/TURN**: If P2P fails, relay through TURN server
- **ICE Restart**: If connection degrades, clients can restart ICE gathering
- **Automatic Reconnection**: Socket.io reconnects with exponential backoff

### Call Failure Handling
- Missed call notifications if recipient offline
- Automatic end after 30 seconds of ringing with no answer
- Network interruption during call shows "reconnecting" state

### Monitoring Points
- Call success rate (target: >95%)
- Call setup time (target: <3 seconds)
- TURN relay usage percentage
- WebSocket connection errors
- API endpoint response times

## API Surface

### REST Endpoints
- `POST /api/users/username` - Register username
- `GET /api/users/search?username=` - Search users
- `GET /api/contacts` - List contacts
- `POST /api/contacts/request` - Send contact request
- `POST /api/contacts/respond` - Accept/reject request
- `GET /api/calls/history` - Call history
- `GET /api/turn-credentials` - Get TURN credentials

### WebSocket Events (Socket.io)
- `auth` / `auth:ok` / `auth:error` - Authentication
- `call:request` / `call:incoming` - Incoming call notification
- `call:accept` / `call:reject` - Call response
- `call:end` / `call:ended` - Call termination
- `webrtc:offer` / `webrtc:answer` / `webrtc:ice` - WebRTC negotiation
- `presence:update` - Online/offline status

## Security Checklist

- [x] HTTPS/WSS only
- [x] Firebase token validation on all requests
- [x] DTLS-SRTP media encryption
- [x] Contacts-only calling enforced
- [x] Rate limiting on API/signaling
- [x] No phone number collection
- [x] Terms of Service covering acceptable use
- [ ] GDPR compliance documentation
- [ ] Regular security audit
