# WebRTC Calling App: Project Document

This document has three parts:

1. [PRD (Product Requirements Document)](#part-1-prd)
2. [Architecture](#part-2-architecture)
3. [Design (UI, data, API, security)](#part-3-design)

---

# Part 1: PRD

## 1.1 Overview

**Product name (working title):** CallMe (placeholder)

**One-line summary:** A mobile and web app that lets people make free voice (and optionally video) calls over WiFi or mobile data, using a username or user ID instead of a phone number.

## 1.2 Problem Statement

- Most calling apps require a phone number to sign up, which creates privacy concerns and ties the account to a SIM.
- People sometimes want to call without sharing their real number.
- Normal calls cost money; internet calls over WiFi are effectively free.

## 1.3 Goals

| # | Goal |
|---|------|
| G1 | Users can sign up with email and pick a unique username, with no phone number required. |
| G2 | Users can call another registered user by username over the internet. |
| G3 | Call quality is good on WiFi and acceptable on mobile data. |
| G4 | Calls are encrypted in transit. |
| G5 | The MVP can be built with free-tier services. |

## 1.4 Non-Goals (Out of Scope)

- Calling normal mobile or landline numbers (PSTN) in the MVP. This needs a paid telecom provider such as Twilio / Exotel and is planned for Phase 3 (see FR17).
- Calling personal WhatsApp accounts. WhatsApp only allows calls through its official Business Calling API (business to user, with user permission). This is planned for Phase 3 (see FR19 to FR22). Unofficial WhatsApp hacks or bots are not supported because they violate Meta's terms.
- Using fake, virtual, or random numbers, or spoofing caller ID. This is fraud and illegal in India and many other countries, so it is **not supported**.
- Group calls with more than 4 participants (future phase).
- Call recording (future phase, needs consent flows).

## 1.5 Target Users

| Persona | Description | Need |
|---------|-------------|------|
| Privacy-minded user | Does not want to share a phone number | Anonymous-friendly username login |
| Student / traveller | Often on WiFi, avoids call charges | Free calls over WiFi |
| Small team / friends | Wants quick calls with people who have the app | Simple add-contact and call flow |

## 1.6 User Stories

1. As a new user, I want to sign up with my email and choose a username so that people can find me without a phone number.
2. As a user, I want to search for a friend by username and send a contact request.
3. As a user, I want to tap a contact and start a voice call.
4. As a user, I want to see an incoming call screen with Accept and Reject buttons, even when the app is in the background.
5. As a user, I want to mute, use speaker, and end the call.
6. As a user, I want to see my call history.
7. As a user, I want to block another user.

## 1.7 Functional Requirements

### MVP (Phase 1)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1 | Email + password signup and login (Firebase Auth) | Must |
| FR2 | Unique username selection and validation | Must |
| FR3 | Search users by exact username | Must |
| FR4 | Contacts list (add / remove) | Must |
| FR5 | 1-to-1 voice call over WebRTC | Must |
| FR6 | Incoming call screen with accept / reject | Must |
| FR7 | In-call controls: mute, speaker, end call | Must |
| FR8 | Online / offline presence indicator | Should |
| FR9 | Call history (missed, received, dialed) | Should |
| FR10 | Push notification for incoming calls when app is closed | Must (mobile) |

### Phase 2

| ID | Requirement |
|----|-------------|
| FR11 | Video calling with camera switch |
| FR12 | Call via shareable link (room-based) |
| FR13 | Block / report user |
| FR14 | Profile picture and display name |
| FR15 | Group calls (up to 4) |

### Phase 3

| ID | Requirement |
|----|-------------|
| FR16 | In-app text chat |
| FR17 | Calls to real phone numbers via a telecom provider (paid) |
| FR18 | Screen sharing |
| FR19 | WhatsApp Business Calling API integration: receive calls from WhatsApp users (user-initiated, free) |
| FR20 | WhatsApp Business Calling API: call WhatsApp users who granted call permission (business-initiated, paid per minute) |
| FR21 | Call-permission request flow (template / interactive message with a Calling CTA button) and permission status tracking |
| FR22 | Admin dashboard for call logs, costs, and permission status of external channels |

## 1.8 Non-Functional Requirements

| Area | Requirement |
|------|-------------|
| Performance | Call setup time under 3 seconds on a normal connection |
| Latency | One-way audio latency under 300 ms |
| Reliability | At least 95% of calls connect successfully (with TURN fallback) |
| Security | DTLS-SRTP encryption for media, HTTPS/WSS for signaling, token-based auth |
| Privacy | No phone number required; minimal personal data stored |
| Scalability | MVP supports about 1,000 concurrent users on a single signaling server |
| Compatibility | Android 8+, iOS 13+, latest Chrome / Safari / Firefox / Edge |
| Accessibility | Screen-reader labels, large tap targets on call controls |

## 1.9 Success Metrics

- Call connection success rate (target: 95% or higher)
- Average call setup time (target: under 3 s)
- Day-7 retention
- Calls per active user per week
- Crash-free session rate (target: 99% or higher)

## 1.10 Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Strict NAT / firewall blocks P2P | Calls fail | Deploy TURN server as fallback |
| TURN bandwidth cost grows | Cost | Use P2P first; monitor relay usage; set per-user limits |
| Spam or harassment calls | Trust | Contact-only calling, block and report, rate limits |
| Incoming calls not delivered in background (iOS/Android) | Poor UX | FCM + APNs (CallKit / ConnectionService) |
| Misuse for fraud | Legal | Terms of Service, abuse reporting, no number spoofing |
| Single signaling server failure | Downtime | Health checks, auto-restart, later Redis-backed multi-instance |

## 1.11 Milestones (Suggested)

| Week | Milestone |
|------|-----------|
| 1 | Setup, Firebase Auth, user profile + username |
| 2 | Signaling server + web 1-to-1 call prototype |
| 3 | Mobile app (Flutter / React Native), contacts, call UI |
| 4 | Push notifications, TURN server, call history |
| 5 | Testing, bug fixes, beta release |
| 6+ | Phase 2 features |

## 1.12 Calling Modes Summary

| Mode | Needs SIM? | Other side needs the app? | Cost | Phase |
|------|-----------|---------------------------|------|-------|
| App to App (WebRTC) | No | Yes | Free (only server / TURN costs) | MVP |
| App to WhatsApp user (official Business Calling API) | No | No, but the user needs WhatsApp and must grant call permission | User-initiated: free. Business-initiated: per minute | Phase 3 |
| App to normal mobile / landline (PSTN via Twilio / Exotel etc.) | No (for the caller) | No | Per minute | Phase 3 |

**Important constraints for external channels**

- WhatsApp calling needs a verified business profile and a business number registered on the Cloud API (not the regular WhatsApp Business app).
- Business-initiated WhatsApp calls need explicit user permission. Permission is revoked automatically after repeated unanswered calls.
- Business-initiated WhatsApp calls are not available in some countries (for example USA, Canada, Egypt, Vietnam, Nigeria). Check Meta's current documentation before launch.
- PSTN calls in India need a verified number from the provider and must follow TRAI / DoT rules. Caller ID must be the registered number; spoofing is not allowed.
- Pricing and limits change over time. Verify on the official Meta and provider pages before building.

---

# Part 2: Architecture

## 2.1 High-Level Diagram

```mermaid
flowchart TB
    Auth["Firebase Auth<br/>(email / username login)"]
    SIG["Signaling Server<br/>(Node.js + Socket.io)"]
    A["User A App<br/>(Flutter / React Native / Web)"]
    B["User B App<br/>(Flutter / React Native / Web)"]
    STUN["STUN / TURN Server<br/>(coturn)"]
    DB[("Firestore / PostgreSQL<br/>users, contacts, call logs")]
    PUSH["FCM / APNs<br/>(push notifications)"]

    A -->|login| Auth
    B -->|login| Auth
    Auth -.->|verify token| SIG
    A <-->|signaling over WSS| SIG
    B <-->|signaling over WSS| SIG
    A -->|discover public IP / relay| STUN
    B -->|discover public IP / relay| STUN
    A <==>|"audio / video (P2P, encrypted)"| B
    SIG --> DB
    SIG --> PUSH
    PUSH -.->|incoming call alert| B
```

## 2.2 Components

| Component | Technology | Responsibility |
|-----------|------------|----------------|
| Client app | Flutter or React Native (mobile), React / plain JS (web) | UI, microphone / camera access, WebRTC peer connection |
| Auth service | Firebase Authentication | Signup, login, issue ID tokens |
| Signaling server | Node.js, Express, Socket.io | Presence, call routing, exchange of SDP offer / answer and ICE candidates |
| STUN server | Google public STUN (`stun:stun.l.google.com:19302`) | Tell each client its public IP / port |
| TURN server | coturn (self-hosted) or Metered / Twilio | Relay media when direct P2P fails |
| Database | Firestore (easy) or PostgreSQL | Users, contacts, call history |
| Push service | Firebase Cloud Messaging (+ APNs for iOS) | Wake the device for incoming calls |

## 2.3 Call Flow (Sequence)

```mermaid
sequenceDiagram
    participant A as User A
    participant S as Signaling Server
    participant B as User B
    participant T as STUN / TURN

    A->>S: connect (auth token)
    B->>S: connect (auth token)
    A->>S: call-request(to: "bob")
    S->>B: incoming-call(from: "alice")
    B->>S: call-accept
    S->>A: call-accepted
    A->>T: gather ICE candidates
    B->>T: gather ICE candidates
    A->>S: offer (SDP)
    S->>B: offer (SDP)
    B->>S: answer (SDP)
    S->>A: answer (SDP)
    A->>S: ice-candidate
    S->>B: ice-candidate
    B->>S: ice-candidate
    S->>A: ice-candidate
    A-->>B: encrypted audio/video (P2P or via TURN)
    A->>S: call-end
    S->>B: call-ended
```

## 2.4 Step-by-Step Explanation

1. **Login:** The client signs in with Firebase Auth and receives an ID token.
2. **Connect:** The client opens a secure WebSocket to the signaling server and sends the token. The server verifies it and marks the user online.
3. **Call request:** User A selects a contact. The server checks that B is online and not blocked, then notifies B (via WebSocket, or via push if B is offline or in the background).
4. **Accept:** B accepts. The server tells A.
5. **Negotiation:** A creates an SDP offer, B replies with an SDP answer, and both exchange ICE candidates through the server.
6. **Connectivity:** WebRTC tries a direct P2P path using STUN-discovered addresses. If that fails, it falls back to the TURN relay.
7. **Media:** Audio (and video) flows encrypted with DTLS-SRTP. The signaling server is no longer involved in media.
8. **End:** Either side ends the call. The server records call history.

## 2.4.1 Why TURN Matters

Around 10 to 20% of connections cannot be established peer-to-peer (symmetric NAT, corporate firewalls, some mobile carriers). Without TURN those calls simply fail. Plan for TURN from the start, even if you begin with a free tier.

## 2.5 Tech Stack Summary

| Layer | Choice | Alternative |
|-------|--------|-------------|
| Mobile | Flutter + `flutter_webrtc` | React Native + `react-native-webrtc` |
| Web | React + browser WebRTC APIs | Plain HTML / JS |
| Backend | Node.js + Express + Socket.io | Go, Python (FastAPI + websockets) |
| Auth | Firebase Auth | Auth0, custom JWT |
| Database | Firestore | PostgreSQL, MongoDB |
| TURN | coturn on a small VPS | Metered, Twilio Network Traversal |
| Push | FCM + APNs | OneSignal |
| Hosting | Render / Railway / Fly.io (free tiers) | AWS, GCP, DigitalOcean |
| Shortcut | Agora, ZegoCloud, Daily.co, Stream SDKs | Replaces signaling + TURN with a managed service |

## 2.6 Deployment

```
                  Internet
                     |
        +------------+-------------+
        |                          |
   [HTTPS / WSS]              [UDP/TCP 3478, 5349]
        |                          |
  Signaling server            coturn (TURN)
  (Node.js, 1 instance)       (small VPS, public IP)
        |
   Firestore / Postgres
```

- Signaling server behind HTTPS (TLS terminated by the host or by Nginx).
- TURN server needs a public IP and open UDP / TCP ports (3478, 5349 and a relay port range).
- Secrets (Firebase service account, TURN credentials) stored as environment variables.

## 2.7 Scaling Path

| Stage | Change |
|-------|--------|
| 0 to 1k users | Single signaling instance, single TURN server |
| 1k to 10k users | Multiple signaling instances with Redis adapter for Socket.io, load balancer with sticky sessions |
| 10k+ users | Multiple TURN servers by region, time-limited TURN credentials, monitoring and autoscaling |
| Group calls | Add an SFU (mediasoup, LiveKit, Janus) instead of mesh P2P |

## 2.8 Extended Channels (Phase 3): WhatsApp and PSTN

```mermaid
flowchart TB
    APP["CallMe App<br/>(WebRTC client)"]
    SIG["Signaling Server<br/>(Node.js)"]
    GW["Channel Gateway Service<br/>(bridges WebRTC to external calls)"]
    WA["WhatsApp Business<br/>Calling API (Meta Cloud API)"]
    PSTN["Telecom Provider<br/>(Twilio / Exotel / Plivo)"]
    WAU["WhatsApp User"]
    MOB["Normal Mobile / Landline"]

    APP <-->|signaling| SIG
    SIG <--> GW
    GW <-->|"REST calls + webhooks<br/>(SDP offer / answer)"| WA
    WA <-->|VoIP| WAU
    GW <-->|"SIP / REST"| PSTN
    PSTN <-->|phone network| MOB
```

**How it works**

- A new **Channel Gateway** service sits next to the signaling server. It translates between the app's WebRTC session and the external provider's call API.
- **WhatsApp:** the gateway calls the Meta Cloud API `POST /<PHONE_NUMBER_ID>/calls` endpoint to start, accept, or end calls, and receives call events on a webhook (`calls` field) that carry the SDP offer / answer. Media runs over WebRTC between your gateway and WhatsApp.
- **PSTN:** the gateway connects to the telecom provider using SIP trunking or the provider's voice SDK. The provider converts internet audio to a normal phone call.
- The mobile and web apps stay unchanged: the user just picks "Call WhatsApp contact" or "Call phone number" in the UI.

**New components**

| Component | Technology | Responsibility |
|-----------|------------|----------------|
| Channel Gateway | Node.js service | Bridge WebRTC to WhatsApp / PSTN, manage call state |
| Webhook endpoint | HTTPS endpoint with signature verification | Receive WhatsApp call events |
| Permission manager | DB table + service | Track WhatsApp call permissions per user |
| Billing tracker | DB table + dashboard | Track per-minute cost of external calls |

---

# Part 3: Design

## 3.1 Screens (UI Design)

| # | Screen | Key Elements |
|---|--------|--------------|
| 1 | Splash | Logo, loading indicator |
| 2 | Sign up | Email, password, username (live availability check) |
| 3 | Login | Email, password, forgot password |
| 4 | Home / Contacts | Search bar, contact list with online dot, Add button |
| 5 | Add contact | Search by username, Send request |
| 6 | Call history | List with missed / received / dialed icons, tap to call back |
| 7 | Outgoing call | Contact name, "Calling...", End button |
| 8 | Incoming call | Caller name, Accept (green), Reject (red) |
| 9 | In-call | Timer, Mute, Speaker, (Video), End |
| 10 | Settings | Profile, blocked users, notifications, logout |

**Navigation:** Bottom tabs (Contacts, History, Settings). Call screens open as full-screen overlays.

**UX notes:**
- Show clear states: Connecting, Ringing, Connected, Reconnecting, Ended.
- Request microphone permission at the moment of the first call, with a short explanation.
- Show a network quality indicator during calls.

## 3.2 Data Model

### `users`

| Field | Type | Notes |
|-------|------|-------|
| `uid` | string | Firebase UID (primary key) |
| `username` | string | Unique, lowercase, 3 to 20 chars |
| `displayName` | string | Optional |
| `email` | string | Private, never shown to other users |
| `photoUrl` | string | Optional |
| `fcmToken` | string | For push notifications |
| `createdAt` | timestamp | |
| `lastSeen` | timestamp | |

### `contacts`

| Field | Type | Notes |
|-------|------|-------|
| `ownerUid` | string | |
| `contactUid` | string | |
| `status` | enum | `pending`, `accepted`, `blocked` |
| `createdAt` | timestamp | |

### `calls`

| Field | Type | Notes |
|-------|------|-------|
| `callId` | string | UUID |
| `callerUid` | string | |
| `calleeUid` | string | |
| `type` | enum | `audio`, `video` |
| `status` | enum | `missed`, `rejected`, `completed`, `failed` |
| `startedAt` | timestamp | |
| `answeredAt` | timestamp | Null if not answered |
| `endedAt` | timestamp | |
| `durationSec` | number | |

## 3.3 Signaling Protocol (Socket.io Events)

### Client to server

| Event | Payload | Purpose |
|-------|---------|---------|
| `auth` | `{ token }` | Authenticate the socket |
| `call:request` | `{ toUsername, type }` | Start a call |
| `call:accept` | `{ callId }` | Accept incoming call |
| `call:reject` | `{ callId }` | Reject incoming call |
| `call:end` | `{ callId }` | Hang up |
| `webrtc:offer` | `{ callId, sdp }` | Send SDP offer |
| `webrtc:answer` | `{ callId, sdp }` | Send SDP answer |
| `webrtc:ice` | `{ callId, candidate }` | Send ICE candidate |

### Server to client

| Event | Payload | Purpose |
|-------|---------|---------|
| `auth:ok` / `auth:error` | `{ uid }` / `{ reason }` | Auth result |
| `call:incoming` | `{ callId, fromUsername, type }` | Notify callee |
| `call:accepted` | `{ callId }` | Notify caller |
| `call:rejected` | `{ callId }` | Notify caller |
| `call:ended` | `{ callId, reason }` | Remote hang up or failure |
| `call:unavailable` | `{ reason }` | Offline, busy, or blocked |
| `webrtc:offer` / `webrtc:answer` / `webrtc:ice` | same as above | Relayed to the other peer |
| `presence:update` | `{ uid, online }` | Contact online status |

## 3.4 REST API (Optional, for non-realtime actions)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/users/username` | Set username (checks uniqueness) |
| GET | `/api/users/search?username=` | Find a user by exact username |
| GET | `/api/contacts` | List contacts |
| POST | `/api/contacts/request` | Send contact request |
| POST | `/api/contacts/respond` | Accept or decline request |
| POST | `/api/contacts/block` | Block a user |
| GET | `/api/calls/history` | Paginated call history |
| GET | `/api/turn-credentials` | Short-lived TURN username and password |

All endpoints require `Authorization: Bearer <Firebase ID token>`.

## 3.5 WebRTC Client Logic (Reference)

```js
const pc = new RTCPeerConnection({
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "turn:YOUR_TURN_HOST:3478", username: "<temp-user>", credential: "<temp-pass>" }
  ]
});

// 1. Get microphone
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
stream.getTracks().forEach(track => pc.addTrack(track, stream));

// 2. Send ICE candidates through signaling
pc.onicecandidate = e => e.candidate && socket.emit("webrtc:ice", { callId, candidate: e.candidate });

// 3. Play remote audio
pc.ontrack = e => { remoteAudio.srcObject = e.streams[0]; };

// 4. Caller creates offer
const offer = await pc.createOffer();
await pc.setLocalDescription(offer);
socket.emit("webrtc:offer", { callId, sdp: offer });
```

## 3.6 Security Design

| Area | Measure |
|------|---------|
| Authentication | Firebase ID token verified on every socket connection and API call |
| Transport | HTTPS and WSS only |
| Media encryption | WebRTC mandatory DTLS-SRTP |
| TURN abuse | Time-limited credentials issued per call by the server |
| Spam / harassment | Only accepted contacts can call; block list enforced server-side |
| Rate limiting | Limit call requests, search, and signup attempts per user / IP |
| Input validation | Username regex, payload size limits, ignore malformed events |
| Privacy | Email never exposed to other users; no phone number collected |
| Abuse | Report button, Terms of Service, account suspension process |
| Legal | No caller ID spoofing, no fake number generation |

## 3.7 Error Handling and Edge Cases

| Case | Behavior |
|------|----------|
| Callee offline | Send push notification; ring for 30 s; log as missed |
| Callee busy | Return `call:unavailable (busy)` |
| Caller cancels before answer | Callee sees "Missed call" |
| Network drops mid-call | Show "Reconnecting...", attempt ICE restart for 10 s, then end call |
| Microphone permission denied | Show instructions to enable in settings |
| Switch WiFi to mobile data | ICE restart to keep the call alive |
| Duplicate login on two devices | Ring on all devices; first to accept wins, others dismissed |

## 3.8 Suggested Project Structure

```
callme/
├── apps/
│   ├── mobile/                # Flutter or React Native app
│   │   ├── lib/ (or src/)
│   │   │   ├── screens/
│   │   │   ├── services/      # auth, signaling, webrtc
│   │   │   ├── models/
│   │   │   └── widgets/
│   └── web/                   # Optional web client
├── server/
│   ├── src/
│   │   ├── index.js           # Express + Socket.io bootstrap
│   │   ├── auth.js            # Firebase token verification
│   │   ├── signaling.js       # Socket event handlers
│   │   ├── routes/            # REST endpoints
│   │   ├── services/          # presence, calls, push, turn credentials
│   │   └── middleware/        # rate limit, validation
│   ├── package.json
│   └── .env.example
├── infra/
│   └── coturn/turnserver.conf
└── docs/
    └── this-file.md
```

## 3.9 Testing Plan

| Type | What to test |
|------|--------------|
| Unit | Username validation, token verification, signaling handlers |
| Integration | Full call flow between two test clients |
| Network | WiFi to WiFi, WiFi to mobile data, behind strict NAT (force TURN) |
| Device | Multiple Android versions, iOS, major browsers |
| Background | Incoming call when the app is closed or the screen is locked |
| Load | Simulate several hundred concurrent socket connections |
| Security | Invalid tokens, spoofed events, rate-limit checks |

## 3.10 Phase 3 Design: WhatsApp and PSTN Channels

### UI additions

| Screen | Elements |
|--------|----------|
| Dialer | Tabs: App contact, WhatsApp, Phone number; number input with country code |
| WhatsApp contact card | Permission status badge: Not requested, Pending, Granted, Revoked; "Request call permission" button |
| In-call (external) | Channel badge (WhatsApp / Phone), live timer, estimated cost for paid calls |
| Cost summary | Minutes used and cost per channel this month |

### Data model additions

**`external_contacts`**

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | |
| `ownerUid` | string | |
| `channel` | enum | `whatsapp`, `pstn` |
| `identifier` | string | WhatsApp user ID or E.164 phone number |
| `permissionStatus` | enum | `none`, `requested`, `granted`, `revoked` (WhatsApp only) |
| `permissionExpiresAt` | timestamp | Null for permanent permission |
| `unansweredCount` | number | Consecutive unanswered calls |

**`calls` table: new fields**

| Field | Type | Notes |
|-------|------|-------|
| `channel` | enum | `app`, `whatsapp`, `pstn` |
| `direction` | enum | `inbound`, `outbound` |
| `providerCallId` | string | Meta or telecom provider call ID |
| `costAmount` | number | Cost charged for the call |
| `costCurrency` | string | |

### Gateway endpoints and events

| Method / Event | Purpose |
|----------------|---------|
| `POST /api/external/whatsapp/permission-request` | Send a message asking the user for call permission |
| `POST /api/external/whatsapp/call` | Start a business-initiated WhatsApp call (only if permission is granted) |
| `POST /api/external/pstn/call` | Start a call to a phone number via the telecom provider |
| `POST /webhooks/whatsapp` | Receive WhatsApp events (incoming call, call status, permission updates). Verify the request signature. |
| `POST /webhooks/pstn` | Receive provider call status events |
| Socket event `call:external-status` | Push call state (ringing, connected, ended, failed) to the app |

### Rules enforced by the gateway

1. Never start a business-initiated WhatsApp call without a valid, current permission.
2. Respect daily per-user call limits and stop after repeated unanswered calls; do not retry in a loop.
3. Check the destination country against the list of supported countries before calling.
4. Apply per-user spending limits and rate limits to paid channels.
5. Store only the data needed for call logs and billing, and follow data-protection law.
6. For PSTN, always use the registered caller ID. No spoofing.

### Compliance checklist

- [ ] Verified business profile with Meta
- [ ] Business number registered on Cloud API (not the regular Business app)
- [ ] Payment method added on the Meta account
- [ ] Telecom provider account and verified number (India: follow TRAI / DoT rules)
- [ ] User consent and opt-in recorded for each external contact
- [ ] Terms of Service and privacy policy updated for external calling
- [ ] Re-check country availability and pricing before launch

## 3.11 Open Questions

1. Mobile only, web only, or both for the MVP?
2. Voice only first, or include video from day one?
3. Self-host TURN (cheaper, more setup) or use a managed service (easier, paid beyond free tier)?
4. Build signaling yourself or use Agora / ZegoCloud to ship faster?
5. Do contacts need approval before calling, or can any user call any username?
6. Is the WhatsApp channel for calling your own customers (business use) or for general users? The official API is meant for businesses.
7. Which telecom provider for PSTN calling in India (Twilio, Exotel, Plivo, Knowlarity), and what is the per-minute budget?

---

*Note: The MVP connects users of the app itself (app to app, no SIM needed). WhatsApp calling (official Business Calling API) and normal phone number calling (telecom provider) are Phase 3 additions and are paid, permission-based, and subject to local regulations.*
