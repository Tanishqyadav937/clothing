# CallMe Phase 3 Design: External Call Channels (WhatsApp + PSTN)

**Document Version:** 1.0  
**Date:** 2024  
**Phase:** 3 (External Channels Extension)  
**Status:** Design Review

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Decision](#architecture-decision)
3. [Channel Gateway Internal Design](#channel-gateway-internal-design)
4. [WhatsApp Integration Design](#whatsapp-integration-design)
5. [PSTN Integration Design](#pstn-integration-design)
6. [Data Model Extensions](#data-model-extensions)
7. [API Contract](#api-contract)
8. [Socket.io Events for External Channels](#socketio-events-for-external-channels)
9. [Redis Cache Strategy](#redis-cache-strategy)
10. [Billing Service Design](#billing-service-design)
11. [Security Design](#security-design)
12. [UI Component Breakdown](#ui-component-breakdown)
13. [Migration Path](#migration-path)
14. [Testing Strategy](#testing-strategy)

---

## Overview

Phase 3 extends CallMe with two external call channels on top of the existing WebRTC app (Phase 1):

1. **WhatsApp Business Calling API** (Meta Cloud API): Call WhatsApp users with explicit permission; receive calls from WhatsApp users for free.
2. **PSTN (Telecom Provider)**: Call regular mobile and landline numbers (paid per minute).

**Key design principles:**
- Channels are optional and pluggable; existing WebRTC app-to-app functionality is unaffected.
- A new **Channel Gateway** service translates between the app's WebRTC signaling and external provider APIs.
- All external calls require permission tracking, spending limit enforcement, and billing.
- Webhook receivers verify provider signatures for event authenticity.
- Media runs over WebRTC between the gateway and WhatsApp; SIP/REST between gateway and PSTN provider.

**Tech stack locked for Phase 3:**
- **Server additions:** Node.js module within `server/src/services/gateway/` (not a separate microservice at MVP scale)
- **WhatsApp:** Meta Cloud API v18.0+ (REST)
- **PSTN provider:** Twilio (SIP trunking + REST; chosen over Exotel for global reach; easily replaceable)
- **Billing:** Firestore + background scheduler (Cloud Tasks or Node.js interval job)
- **Caching:** Redis (production; optional in-memory Map for testing)
- **Webhook signature verification:** HMAC-SHA256 (Meta), Twilio token-based (provider)

---

## Architecture Decision

### Option 1: Integrated Module in `server/src/services/gateway/`

**Pros:**
- Single Node.js process, simpler deployment (no inter-service communication).
- Shared Firebase Admin SDK and auth context with main signaling server.
- Lower latency for internal calls (no network hops between gateway and signaling).
- Easier debugging and monitoring.

**Cons:**
- Cannot scale gateway independently from signaling server.
- If gateway crashes (e.g., provider API hangs), signaling server is affected.

### Option 2: Separate Microservice

**Pros:**
- Independent scaling and failure isolation.
- Can run in a different region for PSTN provider latency optimization.

**Cons:**
- Requires inter-process communication (gRPC, REST, or message queue).
- More operational complexity for MVP.
- Needs shared state (Redis) for presence and call routing.

### **RECOMMENDATION: Option 1 (Integrated Module)**

**Reasoning:** For Phase 3 MVP, integrated is pragmatic. The gateway is relatively stateless (it only translates calls); it doesn't manage presence or user contacts like the signaling server does. We can isolate gateway failures with process-level error handling and circuit breakers. If external channels prove heavy, Phase 4 can split into a microservice with async messaging (Bull/RabbitMQ).

**File structure:**
```
server/src/
├── services/
│   ├── gateway/
│   │   ├── index.js              # Exports gateway module
│   │   ├── state.js              # Call state machine
│   │   ├── whatsapp/
│   │   │   ├── client.js         # Meta Cloud API wrapper
│   │   │   ├── webhook.js        # Webhook receiver + signature verification
│   │   │   └── permission.js     # Permission tracking
│   │   ├── pstn/
│   │   │   ├── client.js         # Twilio SIP/REST wrapper
│   │   │   └── webhook.js        # Webhook receiver
│   │   └── billing.js            # Per-minute cost recording
│   ├── signaling.js              # (existing, unchanged except for external call routing)
│   └── firebase.js               # (extended with external_contacts, calls additions)
├── routes/
│   ├── external.js               # New: POST /api/external/* endpoints
│   └── webhooks.js               # New: POST /webhooks/* endpoints
└── middleware/
    └── webhookVerification.js    # New: Signature verification middleware
```

---

## Channel Gateway Internal Design

### Call State Machine

Each external call progresses through states:

```
                    ┌─────────────┐
                    │   CREATED   │  (initiated by app or provider)
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   RINGING   │  (waiting for answer)
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐      ┌──────▼──────┐    ┌─────▼─────┐
   │ REJECTED │      │  CONNECTED  │    │  FAILED   │
   └─────────┘      └──────┬──────┘    └───────────┘
                           │
                    ┌──────▼──────┐
                    │   ENDED     │  (call completed)
                    └─────────────┘
```

**State transitions and actions:**

| From | To | Trigger | Actions |
|------|----|---------|----|
| CREATED | RINGING | Call initiated | Send to provider, record start_time, set ringing_timeout |
| RINGING | CONNECTED | Answer event from provider | Send offer to app client, store provider_call_id, start billing |
| RINGING | REJECTED | Reject event from provider | Emit call:external-status rejected, no billing |
| RINGING | FAILED | Timeout (30s) or provider error | Emit call:external-status failed, no billing |
| CONNECTED | ENDED | End event from provider or app | Record end_time, compute cost, increment unanswered_count if needed, close call |
| CONNECTED | FAILED | Network error, provider disconnect | Emit reconnecting, attempt recovery for 10s, then fail |

**Implementation:** `server/src/services/gateway/state.js`

```javascript
// Enum and tracker
const CallState = {
  CREATED: 'created',
  RINGING: 'ringing',
  CONNECTED: 'connected',
  REJECTED: 'rejected',
  FAILED: 'failed',
  ENDED: 'ended',
};

// In-memory call tracker: Map<callId, { state, channel, provider_call_id, start_time, cost, ... }>
const externalCalls = new Map();

// State transitions with validation
async function transitionCall(callId, newState, context = {}) {
  const call = externalCalls.get(callId);
  if (!call) throw new Error('Call not found');

  const valid = isValidTransition(call.state, newState);
  if (!valid) throw new Error(`Invalid transition: ${call.state} -> ${newState}`);

  // Execute state-specific logic
  if (newState === 'connected') {
    call.start_time = Date.now();
    call.billing_started = true;
  }
  if (newState === 'ended') {
    call.end_time = Date.now();
    call.duration_sec = (call.end_time - call.start_time) / 1000;
    await recordBillingEvent(callId, call);
  }

  call.state = newState;
  call.updated_at = Date.now();
  return call;
}
```

### Permission Enforcement Flow

Before initiating a business-initiated WhatsApp call:

1. **Check permission exists:** Query Redis cache or Firestore `permissions` collection.
2. **Check permission current:** If expiry timestamp ≤ now, reject with "Permission expired".
3. **Check country availability:** Lookup destination country (via WhatsApp ID format or E.164 country code); if blocked by Meta, reject with "Calling not available in this country".
4. **Check spending limit:** Sum all call costs this month; if total + estimated_cost_for_this_call > limit, reject with "Monthly spending limit reached".
5. **Check rate limit:** If > 10 unanswered calls to this WhatsApp ID in past 7 days, reject with "Too many unanswered attempts to this contact".

**Implementation:** `server/src/services/gateway/whatsapp/permission.js`

```javascript
async function checkPermissionBeforeCall(uid, whatsappId, callId) {
  // 1. Get permission from Redis (TTL = permission expiry)
  const permKey = `perm:${uid}:${whatsappId}`;
  let perm = await redis.get(permKey);
  
  if (!perm) {
    // Cache miss, check Firestore
    const permDoc = await db.collection('permissions')
      .where('ownerUid', '==', uid)
      .where('whatsappId', '==', whatsappId)
      .get();
    
    if (permDoc.empty || permDoc.docs[0].data().status !== 'granted') {
      throw new PermissionError('Call permission not granted');
    }
    perm = permDoc.docs[0].data();
  }

  // 2. Check expiry
  if (perm.expiresAt && perm.expiresAt.toDate() <= new Date()) {
    throw new PermissionError('Permission expired');
  }

  // 3. Check country availability
  const countryCode = extractCountryCode(whatsappId);
  if (isCountryBlocked(countryCode)) {
    throw new CountryBlockedError(`Calling not available in ${countryCode}`);
  }

  // 4. Check spending limit
  const monthlySpent = await getMonthlySpent(uid, 'whatsapp');
  const estimatedCost = estimateCallCost('whatsapp', 1); // 1 minute estimate
  if (monthlySpent + estimatedCost > user.spending_limit_whatsapp) {
    throw new SpendingLimitError('Monthly limit reached');
  }

  // 5. Check unanswered call rate
  const unansweredCount = await getRecentUnansweredCount(uid, whatsappId, 7);
  if (unansweredCount >= 10) {
    throw new RateLimitError('Too many unanswered calls to this contact');
  }

  return { valid: true };
}
```

### Billing Tracking

**Recording a call:**

1. When call enters CONNECTED state, start a billing timer.
2. Every minute, record a billing event: `{ uid, channel, provider_call_id, duration_sec, cost_usd }`.
3. When call ends, final billing event includes total duration and total cost.
4. Firestore transaction ensures idempotency (prevent double-billing on retry).

**Implementation:** `server/src/services/gateway/billing.js`

```javascript
async function recordBillingEvent(callId, callMetadata) {
  const { uid, channel, duration_sec, cost } = callMetadata;

  // Firestore transaction for idempotency
  await db.runTransaction(async (transaction) => {
    const billingRef = db.collection('billing').doc();
    transaction.set(billingRef, {
      uid,
      channel,
      callId,
      provider_call_id: callMetadata.provider_call_id,
      duration_sec,
      cost_usd: cost,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Update daily aggregate
    const today = new Date().toISOString().split('T')[0];
    const dailyRef = db.collection('billing_daily').doc(`${uid}:${today}:${channel}`);
    transaction.update(dailyRef, {
      total_duration_sec: admin.firestore.FieldValue.increment(duration_sec),
      total_cost_usd: admin.firestore.FieldValue.increment(cost),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}
```

---

## WhatsApp Integration Design

### Meta Cloud API Overview

- **Endpoint:** `https://graph.instagram.com/v18.0/`
- **Authentication:** Bearer token (generated from Meta Business Account)
- **Calling operations:**
  - `POST /{PHONE_NUMBER_ID}/calls` — Initiate a call
  - `POST /{PHONE_NUMBER_ID}/mark_call_ended` — End a call
  - Webhooks receive call events: `call:incoming`, `call:status`

### Call Initiation Flow (Business-Initiated)

**App → Signaling Server → Gateway → Meta Cloud API → WhatsApp User**

```
1. User in app taps WhatsApp contact → call:external (socket.io)
2. Server calls gateway.whatsAppCall(uid, whatsappId, callId)
3. Gateway checks permission (see §3.3)
4. Gateway calls Meta API: POST /calls
   Request: { waId, offer (SDP), type: 'voice' }
   Response: { waId, callId, offer (SDP) }
5. Gateway stores call state: CREATED
6. Gateway emits call:external-status RINGING to app socket
7. WhatsApp user receives ring
8. Gateway receives webhook call:incoming with answer (SDP)
9. Gateway transitions call to CONNECTED
10. Gateway emits call:external-status CONNECTED to app socket
11. App and gateway exchange ICE candidates via relay
12. Media flows WebRTC P2P between app and WhatsApp
13. User hangs up → webhook call:ended
14. Gateway records billing and closes call
```

### SDP Offer/Answer Exchange

**Important:** Meta does NOT do SDP offer/answer inline. Instead:

- Gateway sends SDP offer in the `POST /calls` request body as `{ offer: "<full SDP string>" }`.
- Meta relays the offer to WhatsApp user's device (signaling protocol is proprietary).
- WhatsApp device generates answer and Meta sends it back to gateway via webhook event `call:incoming` with `{ answer: "<full SDP string>" }`.
- Gateway extracts answer and sends it to app client via socket.io event `webrtc:answer`.
- Both sides then exchange ICE candidates via whichever signaling channel (socket.io for app, Meta webhook for WhatsApp).

**File:** `server/src/services/gateway/whatsapp/client.js`

```javascript
async function initiateCall(waId, sdpOffer, callId) {
  const metaCallId = generateUUID();
  
  const response = await axios.post(
    `${META_GRAPH_URL}/${PHONE_NUMBER_ID}/calls`,
    {
      waId,
      offer: sdpOffer,  // Full SDP string
      type: 'voice',
      callId,  // Your internal call ID for tracking
    },
    {
      headers: {
        'Authorization': `Bearer ${process.env.META_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  );

  // Response: { waId, callId: metaCallId, status }
  // Store metaCallId for later reference
  externalCalls.get(callId).meta_call_id = response.data.callId;
  
  return response.data;
}
```

### Webhook Event Handling

**Webhook endpoint:** `POST /webhooks/whatsapp`

**Signature verification:** Meta sends `X-Hub-Signature-256: sha256=<hex_hmac_sha256>` header. We verify:

```javascript
function verifyMetaSignature(req, secret) {
  const signature = req.get('X-Hub-Signature-256');
  const body = req.rawBody;  // Raw request body (before JSON parsing)
  const hash = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  
  return signature === `sha256=${hash}`;
}
```

**Events:**

| Event | Payload | Action |
|-------|---------|--------|
| `call:incoming` | `{ callId, waId, offer, answer }` | If answer exists: transition CONNECTED, relay to app |
| `call:status` | `{ callId, status, reason? }` | Status: ringing, connected, ended, failed; update state |
| `call:permission_changed` | `{ waId, status }` | Status: granted, revoked; update permission in Redis/Firestore |

**Implementation:** `server/src/services/gateway/whatsapp/webhook.js`

```javascript
router.post('/whatsapp', webhookVerificationMiddleware, async (req, res) => {
  const { entry } = req.body;
  
  for (const { changes } of entry) {
    const { value } = changes[0];  // Meta wraps data in nested structure
    
    if (value.event === 'call:incoming') {
      const { callId, waId, answer } = value;
      const call = externalCalls.get(callId);
      
      if (!call) return res.status(404).json({ error: 'Call not found' });
      
      if (answer) {
        // WhatsApp user answered
        await transitionCall(callId, 'connected');
        
        // Relay answer to app via socket.io
        const appSocket = userPresence.get(call.uid).socket;
        appSocket.emit('webrtc:answer', {
          callId,
          answer,  // SDP answer from WhatsApp
          fromUid: 'gateway',  // Identify as gateway
        });
        
        startBilling(callId);
      }
    }
    
    if (value.event === 'call:status') {
      const { callId, status } = value;
      if (status === 'ended') {
        await transitionCall(callId, 'ended');
        // Cleanup, billing already recorded
      }
    }
  }
  
  res.status(200).json({ received: true });
});
```

### Permission Request Flow

User taps "Request call permission" on WhatsApp contact card → app sends `POST /api/external/whatsapp/permission-request`:

1. Gateway sends a WhatsApp template message with an interactive button "Grant call permission".
2. WhatsApp delivers message to user's phone.
3. User taps button → WhatsApp sends webhook `call:permission_changed { status: 'granted' }`.
4. Gateway updates `permissions` collection with `status: 'granted'`, `expiresAt: now + 30 days` (per Meta policy).
5. Redis cache invalidated/updated.

**Implementation:** `server/src/routes/external.js`

```javascript
router.post('/external/whatsapp/permission-request', authMiddleware, async (req, res) => {
  const { uid } = req.user;
  const { whatsappId } = req.body;
  
  try {
    // Send template message with permission CTA
    const templateId = 'call_permission_request';
    await whatsappClient.sendMessage(whatsappId, {
      type: 'template',
      template: {
        name: templateId,
        language: { code: 'en' },
      },
    });
    
    // Record permission request
    await db.collection('permissions').add({
      ownerUid: uid,
      whatsappId,
      status: 'requested',
      requested_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    res.json({ status: 'request_sent' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## PSTN Integration Design

### Provider Choice: Twilio

**Why Twilio over Exotel:**
- Global presence (works in India + 180+ countries).
- Mature SIP trunking (RFC-compliant).
- Better documentation and SDK support.
- India-specific compliance (TRAI regulation support).

**How PSTN calling works:**

1. App → Gateway: `POST /api/external/pstn/call { phoneNumber, callId }`
2. Gateway → Twilio: Create SIP session or REST call.
3. Twilio → Phone network: Routes call to the destination number.
4. Destination phone rings.
5. User picks up → Twilio sends webhook `call.initiated`.
6. Gateway creates WebRTC offer, sends to Twilio.
7. Twilio answers with WebRTC answer.
8. Media flows WebRTC between app and Twilio SIP gateway.
9. Either side hangs up → webhook `call.completed`.

### Twilio Integration: Two Approaches

#### Approach A: SIP Trunking (Preferred for TRAI compliance)

- Twilio provides SIP credentials and trunk endpoint.
- Gateway acts as SIP User Agent Client (UAC).
- Media: RTP/SRTP over SIP.

**Pros:** More control, TRAI-friendly (direct SIP), lower latency.  
**Cons:** More complex SIP stack integration.

#### Approach B: Twilio REST API + Programmable Voice

- Gateway calls `POST /2010-04-01/Accounts/{AccountSid}/Calls` to initiate.
- Twilio calls webhook for call status.
- Media: TwiML-controlled (no WebRTC on Twilio side).

**Pros:** Simpler (REST only), no SIP library needed.  
**Cons:** Less flexible, not WebRTC-native, higher latency (Twilio relays media).

**RECOMMENDATION: Approach A (SIP Trunking)**

Reasoning: CallMe's UX expects WebRTC for app-side media (low latency, end-to-end visibility). SIP trunking is standard telecom practice.

### SIP Integration

**File:** `server/src/services/gateway/pstn/client.js`

```javascript
import SipJs from 'sip.js';

class TwilioSIPClient {
  constructor(config) {
    this.userAgent = new SipJs.UserAgent({
      uri: SipJs.UserAgent.makeURI(`sip:${config.username}@${config.sipDomain}`),
      transportOptions: {
        server: `wss://${config.sipDomain}:443`,
      },
      authorizationUsername: config.username,
      authorizationPassword: config.password,
    });
    this.mediaStream = null;
  }

  async initiateCall(phoneNumber, sdpOffer, callId) {
    const target = `sip:+${phoneNumber}@${this.sipDomain}`;
    
    // Invite SIP session
    const inviter = new SipJs.Inviter(this.userAgent, {
      toBUri: SipJs.UserAgent.makeURI(target),
      sessionDescriptionHandlerOptions: {
        offer: sdpOffer,
      },
    });

    inviter.stateChange.addListener((state) => {
      if (state === 'Accepted') {
        const answer = inviter.sessionDescriptionHandler.answer;
        externalCalls.get(callId).sip_session = inviter;
        transitionCall(callId, 'connected', { answer });
      }
      if (state === 'Terminated') {
        transitionCall(callId, 'ended');
      }
    });

    await inviter.invite();
    externalCalls.get(callId).sip_session = inviter;
  }

  async endCall(callId) {
    const call = externalCalls.get(callId);
    if (call.sip_session) {
      call.sip_session.bye();
    }
  }
}
```

### Webhook Event Handling

**Twilio webhook endpoint:** `POST /webhooks/pstn`

**Signature verification:** Twilio uses X-Twilio-Signature (HMAC-SHA1 of request URL + params).

```javascript
function verifyTwilioSignature(req, authToken) {
  const signature = req.get('X-Twilio-Signature');
  const url = `${process.env.SIGNALING_SERVER_URL}/webhooks/pstn`;
  
  // Collect all POST params in sorted order
  const data = Object.keys(req.body)
    .sort()
    .map(key => key + req.body[key])
    .join('');

  const hash = crypto
    .createHmac('sha1', authToken)
    .update(url + data)
    .digest('base64');

  return signature === hash;
}
```

**Events:**

| Event | Data | Action |
|-------|------|--------|
| `CallStatusCallback` | `{ CallSid, CallStatus }` | Status: ringing, in-progress, completed, failed |
| `DialStatus` | `{ DialCallSid, DialStatus }` | Dialed call state |

**Implementation:** `server/src/services/gateway/pstn/webhook.js`

```javascript
router.post('/pstn', webhookVerificationMiddleware, async (req, res) => {
  const { CallSid, CallStatus } = req.body;
  const callId = lookupCallIdByProviderCallId(CallSid);

  if (!callId) return res.status(404).json({ error: 'Call not found' });

  if (CallStatus === 'in-progress') {
    await transitionCall(callId, 'connected');
  }
  if (CallStatus === 'completed' || CallStatus === 'failed') {
    await transitionCall(callId, 'ended');
  }

  res.status(200).send('OK');
});
```

### TRAI Compliance (India PSTN Calls)

For calls originating from India or to India, TRAI rules require:

1. **Registered caller ID:** Only use phone numbers registered with the telecom provider. No spoofing.
2. **Do Not Call Registry check:** Query NDNC (National Do Not Call) database before calling; abort if listed.
3. **Consent recording:** Log timestamp, IP, user consent for each external call.

**Implementation:** `server/src/services/gateway/pstn/trai.js`

```javascript
async function checkTRAICompliance(phoneNumber, uid, callId) {
  // 1. Check NDNC registry
  const isOnNDNC = await ndncAPI.check(phoneNumber);
  if (isOnNDNC) {
    throw new Error('Destination is on NDNC Do-Not-Call list');
  }

  // 2. Log consent
  const consentLog = {
    uid,
    callId,
    destination: phoneNumber,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    ip: req.ip,
    caller_id_used: process.env.REGISTERED_CALLER_ID,
  };
  await db.collection('consent_logs').add(consentLog);

  return { compliant: true };
}
```

---

## Data Model Extensions

### New Firestore Collections

#### `external_contacts`

Stores metadata about contacts reachable via external channels.

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Auto-generated document ID |
| `ownerUid` | string | Firebase UID of contact owner |
| `channel` | enum | `whatsapp` or `pstn` |
| `identifier` | string | WhatsApp user ID (format: `1234567890@c.us`) or E.164 phone number (`+11234567890`) |
| `displayName` | string | Optional friendly name |
| `permissionStatus` | enum | `none`, `requested`, `granted`, `revoked` (WhatsApp only; null for PSTN) |
| `permissionExpiresAt` | timestamp | Null for permanent PSTN; < 30 days for WhatsApp |
| `unansweredCount` | number | Consecutive unanswered calls (WhatsApp auto-revokes after 10) |
| `lastUnansweredAt` | timestamp | When the last unanswered call occurred |
| `createdAt` | timestamp | When contact was added |
| `updatedAt` | timestamp | Last modified |

**Indexes:**
- `(ownerUid, channel)` for filtering by channel.
- `(ownerUid, permissionStatus)` for permission UI.

#### `permissions`

Detailed permission tracking for WhatsApp calling.

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Auto-generated |
| `ownerUid` | string | |
| `whatsappId` | string | `1234567890@c.us` |
| `status` | enum | `requested`, `granted`, `revoked`, `expired` |
| `requestedAt` | timestamp | When permission was requested |
| `grantedAt` | timestamp | When user tapped the CTA button |
| `expiresAt` | timestamp | 30 days from grant (per Meta policy) |
| `revokedAt` | timestamp | If manually revoked by user or auto-revoked by our system |
| `revokeReason` | enum | `user`, `auto_unanswered`, `manual` |
| `consentIp` | string | IP when permission was granted (for audit) |
| `consentUserAgent` | string | Device info when granted |

**Indexes:**
- `(ownerUid, whatsappId, status)` for permission checks.

#### `calls` (Additions)

Extend existing `calls` collection with external channel data.

**New fields to add:**

| Field | Type | Notes |
|-------|------|-------|
| `channel` | enum | `app`, `whatsapp`, `pstn` |
| `direction` | enum | `inbound` (incoming), `outbound` (outgoing) |
| `providerCallId` | string | Meta callId or Twilio CallSid |
| `costAmount` | number | Cost in currency (0 for app calls) |
| `costCurrency` | string | `USD` or `INR` |
| `externalContactId` | string | Reference to external_contacts doc (for analytics) |

#### `billing`

Per-call billing records.

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Auto-generated |
| `uid` | string | |
| `channel` | enum | `whatsapp`, `pstn` |
| `callId` | string | Our internal call ID |
| `providerCallId` | string | Meta callId or Twilio CallSid |
| `duration_sec` | number | Call duration in seconds |
| `cost_usd` | number | Cost in USD |
| `cost_local` | number | Cost in local currency (for display) |
| `ratePerMinute` | number | Rate used for this call |
| `startedAt` | timestamp | Call start time |
| `endedAt` | timestamp | Call end time |
| `createdAt` | timestamp | When billing record was created |

**Indexes:**
- `(uid, createdAt desc)` for billing reports.
- `(uid, channel, createdAt desc)` for per-channel reports.

#### `billing_daily`

Daily aggregates for dashboard.

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | `${uid}:${date}:${channel}` (e.g., `user123:2024-01-15:whatsapp`) |
| `uid` | string | |
| `channel` | enum | `whatsapp`, `pstn` |
| `date` | string | ISO date string (YYYY-MM-DD) |
| `total_duration_sec` | number | Sum of all call durations that day |
| `total_cost_usd` | number | Sum of costs |
| `call_count` | number | Number of calls |
| `updatedAt` | timestamp | Last update |

#### `spending_limits`

Per-user spending configuration.

| Field | Type | Notes |
|-------|------|-------|
| `uid` | string | Primary key |
| `monthlyLimitUsd` | number | Max spend per month (default: $50) |
| `dailyLimitUsd` | number | Max spend per day (default: $10) |
| `whatsappOnlyUsd` | number | WhatsApp-specific limit (default: $100) |
| `pstnOnlyUsd` | number | PSTN-specific limit (default: $200) |
| `alertThresholdPercent` | number | Warn when % of limit reached (default: 80) |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

---

## API Contract

### REST Endpoints for External Channels

#### `POST /api/external/whatsapp/permission-request`

Request calling permission from a WhatsApp user.

**Request:**
```json
{
  "whatsappId": "1234567890@c.us",
  "displayName": "John Doe"
}
```

**Response (200):**
```json
{
  "status": "request_sent",
  "permissionStatus": "requested",
  "requestedAt": "2024-01-15T10:30:00Z"
}
```

**Errors:**
- `400`: Invalid whatsappId format
- `409`: Permission request already sent to this contact
- `429`: Rate limited (max 5 requests per contact per day)
- `500`: Gateway or Meta API error

---

#### `POST /api/external/whatsapp/call`

Initiate a business-initiated WhatsApp call.

**Request:**
```json
{
  "callId": "uuid-call-id",
  "whatsappId": "1234567890@c.us",
  "sdpOffer": "<full SDP offer string>"
}
```

**Response (200):**
```json
{
  "callId": "uuid-call-id",
  "metaCallId": "call-id-from-meta",
  "status": "ringing",
  "estimatedCostPerMinute": 0.017
}
```

**Errors:**
- `400`: Invalid format or missing SDP offer
- `403`: Permission not granted for this WhatsApp ID
- `402`: Spending limit exceeded or monthly budget exhausted
- `429`: Rate limit exceeded (too many unanswered calls to this contact)
- `500`: Meta API or gateway error

**Business logic:**
1. Permission check (see §3.3).
2. Country availability check.
3. Spending limit enforcement.
4. Call rate limiting.
5. Create call in CREATED state.
6. Transition to RINGING, call Meta API.
7. Start ringing timeout (30s).

---

#### `POST /api/external/pstn/call`

Initiate a PSTN call to a phone number.

**Request:**
```json
{
  "callId": "uuid-call-id",
  "phoneNumber": "+11234567890",
  "sdpOffer": "<full SDP offer string>"
}
```

**Response (200):**
```json
{
  "callId": "uuid-call-id",
  "providerCallSid": "CA1234567890abcdef",
  "status": "ringing",
  "estimatedCostPerMinute": 0.02,
  "taiCompliant": true
}
```

**Errors:**
- `400`: Invalid phone number or format
- `402`: Spending limit exceeded
- `403`: Destination on NDNC registry (India PSTN)
- `429`: Rate limit exceeded
- `500`: Provider or gateway error

**Business logic:**
1. E.164 validation.
2. TRAI compliance check (if destination in India).
3. Spending limit check.
4. Call rate limiting.
5. Create call in CREATED state.
6. Transition to RINGING, initiate SIP/REST call.
7. Start ringing timeout (30s).

---

#### `GET /api/billing/report?channel=whatsapp&startDate=2024-01-01&endDate=2024-01-31`

Get billing report for authenticated user.

**Response (200):**
```json
{
  "period": {
    "startDate": "2024-01-01",
    "endDate": "2024-01-31"
  },
  "summary": {
    "totalCostUsd": 12.50,
    "totalMinutes": 615,
    "callCount": 23
  },
  "byChannel": {
    "whatsapp": {
      "costUsd": 8.50,
      "minutes": 500,
      "callCount": 18
    },
    "pstn": {
      "costUsd": 4.00,
      "minutes": 115,
      "callCount": 5
    }
  },
  "daily": [
    {
      "date": "2024-01-15",
      "channel": "whatsapp",
      "costUsd": 0.50,
      "minutes": 30,
      "callCount": 1
    }
  ],
  "limit": {
    "monthlyUsd": 50,
    "remainingUsd": 37.50,
    "percentUsed": 25
  }
}
```

**Query parameters:**
- `channel` (optional): Filter by `whatsapp`, `pstn`, or all.
- `startDate` (required): ISO date string.
- `endDate` (required): ISO date string.

**Errors:**
- `400`: Invalid date format or date range > 90 days
- `401`: Not authenticated

---

#### `POST /api/external/whatsapp/permission-revoke`

Manually revoke calling permission for a WhatsApp contact.

**Request:**
```json
{
  "whatsappId": "1234567890@c.us"
}
```

**Response (200):**
```json
{
  "status": "revoked",
  "revokedAt": "2024-01-15T10:35:00Z"
}
```

---

#### `GET /api/external/contacts`

List all external contacts (WhatsApp and PSTN) for the authenticated user.

**Response (200):**
```json
{
  "contacts": [
    {
      "id": "doc-id-123",
      "channel": "whatsapp",
      "identifier": "1234567890@c.us",
      "displayName": "Alice",
      "permissionStatus": "granted",
      "permissionExpiresAt": "2024-02-15T00:00:00Z",
      "unansweredCount": 0,
      "lastUnansweredAt": null,
      "createdAt": "2024-01-15T10:00:00Z"
    },
    {
      "id": "doc-id-456",
      "channel": "pstn",
      "identifier": "+11234567890",
      "displayName": "Bob",
      "permissionStatus": null,
      "permissionExpiresAt": null,
      "createdAt": "2024-01-10T08:00:00Z"
    }
  ]
}
```

---

### Webhook Endpoints

#### `POST /webhooks/whatsapp`

Receive events from Meta Cloud API.

**Verification:**
- X-Hub-Signature-256 header must match HMAC-SHA256(request_body, app_secret).
- If verification fails, return 403 Forbidden.

**Example webhook payload:**
```json
{
  "entry": [
    {
      "changes": [
        {
          "value": {
            "event": "call:incoming",
            "callId": "ca-meta-call-id-123",
            "waId": "1234567890@c.us",
            "offer": "<SDP offer>",
            "answer": "<SDP answer>"
          }
        }
      ]
    }
  ]
}
```

**Response:** Always `200 OK { "received": true }` if signature is valid.

---

#### `POST /webhooks/pstn`

Receive events from Twilio.

**Verification:**
- X-Twilio-Signature header must match HMAC-SHA1 per Twilio spec.

**Example webhook payload:**
```
CallSid=CA1234567890abcdef&CallStatus=in-progress&From=+11112223333&To=+14445556666
```

**Response:** Always `200 OK` if signature is valid.

---

## Socket.io Events for External Channels

New events pushed to the app client for external call state updates:

### Client to Server

| Event | Payload | Purpose |
|-------|---------|---------|
| `call:external` | `{ callId, channel, targetIdentifier, sdpOffer }` | Initiate external call |
| `call:external:end` | `{ callId }` | End external call |

### Server to Client

| Event | Payload | Purpose |
|-------|---------|---------|
| `call:external-status` | `{ callId, status, channel }` | State change: ringing, connected, ended, failed |
| `call:external:cost` | `{ callId, costUsd, durationSec }` | Live cost update (every 10 sec during call) |
| `call:external:permission-granted` | `{ whatsappId }` | Permission was granted (user tapped CTA) |
| `call:external:permission-revoked` | `{ whatsappId, reason }` | Permission was revoked |

**Example event flow:**

```javascript
// App initiates call
socket.emit('call:external', {
  callId: 'call-123',
  channel: 'whatsapp',
  targetIdentifier: '1234567890@c.us',
  sdpOffer: '<SDP offer>'
});

// Server responds
socket.on('call:external-status', (data) => {
  console.log(data); // { callId, status: 'ringing', channel: 'whatsapp' }
});

// During call, cost updates
socket.on('call:external:cost', (data) => {
  console.log(data); // { callId, costUsd: 0.25, durationSec: 15 }
});

// Call ends
socket.on('call:external-status', (data) => {
  console.log(data); // { callId, status: 'ended', channel: 'whatsapp' }
});
```

---

## Redis Cache Strategy

### Purpose

Cache permission status, spending limits, and call rate limits to avoid Firestore queries on every call.

### TTL and Invalidation

**Permission cache key:** `perm:${uid}:${whatsappId}`  
**TTL:** Until permission expiry (from `permissions.expiresAt`).  
**Invalidation:** On permission grant/revoke via webhook.

**Spending limit cache key:** `limit:${uid}`  
**TTL:** 1 hour (regenerated hourly).  
**Invalidation:** On manual limit update via API.

**Monthly spend cache key:** `spend:${uid}:${year}-${month}`  
**TTL:** Until month ends.  
**Invalidation:** On new billing record or month rollover.

### Implementation

**File:** `server/src/services/gateway/cache.js`

```javascript
import redis from 'redis';

const client = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

async function getCachedPermission(uid, whatsappId) {
  const key = `perm:${uid}:${whatsappId}`;
  const cached = await client.get(key);
  
  if (cached) {
    return JSON.parse(cached);
  }
  
  // Cache miss, fetch from Firestore
  const perm = await db.collection('permissions')
    .where('ownerUid', '==', uid)
    .where('whatsappId', '==', whatsappId)
    .get();
  
  if (!perm.empty) {
    const data = perm.docs[0].data();
    const ttl = Math.floor(
      (data.expiresAt.toDate() - Date.now()) / 1000
    );
    await client.setex(key, Math.max(ttl, 60), JSON.stringify(data));
    return data;
  }
  
  return null;
}

async function invalidatePermissionCache(uid, whatsappId) {
  await client.del(`perm:${uid}:${whatsappId}`);
}

async function getMonthlySpend(uid) {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const key = `spend:${uid}:${yearMonth}`;
  
  const cached = await client.get(key);
  if (cached) return parseFloat(cached);
  
  // Aggregate from billing collection
  const snapshot = await db.collection('billing')
    .where('uid', '==', uid)
    .where('createdAt', '>=', new Date(now.getFullYear(), now.getMonth(), 1))
    .where('createdAt', '<', new Date(now.getFullYear(), now.getMonth() + 1, 1))
    .get();
  
  const total = snapshot.docs.reduce((sum, doc) => sum + (doc.data().cost_usd || 0), 0);
  
  // Cache until end of month
  const daysRemaining = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
  const ttl = daysRemaining * 86400;
  await client.setex(key, ttl, total.toString());
  
  return total;
}
```

### Fallback for Testing

For development/testing without Redis:

```javascript
class InMemoryCache {
  constructor() {
    this.data = new Map();
  }
  
  async get(key) {
    return this.data.get(key);
  }
  
  async setex(key, ttl, value) {
    this.data.set(key, value);
    setTimeout(() => this.data.delete(key), ttl * 1000);
  }
  
  async del(key) {
    this.data.delete(key);
  }
}

const cache = process.env.REDIS_URL ? redisClient : new InMemoryCache();
```

---

## Billing Service Design

### Per-Minute Cost Recording

**Twilio pricing (as of 2024):** ~$0.02-0.05 USD per minute (varies by destination country).  
**WhatsApp Business Calling:** ~$0.017 USD per minute (varies by region).

**Architecture:**

1. When call enters CONNECTED state, start a billing loop (interval = 10 seconds).
2. Every 10 seconds, estimate cost based on elapsed time and rate.
3. When call ends, record final billing event with total cost.
4. Firestore transactions ensure idempotency.

**Implementation:** `server/src/services/gateway/billing.js`

```javascript
const billingRates = {
  whatsapp: 0.017, // USD per minute
  pstn: {
    default: 0.02,
    'IN': 0.015, // India-specific rate
    'GB': 0.01,
  },
};

async function startBillingTimer(callId, channel, destination) {
  const call = externalCalls.get(callId);
  
  const rate = channel === 'whatsapp'
    ? billingRates.whatsapp
    : billingRates.pstn[extractCountry(destination)] || billingRates.pstn.default;
  
  call.billing_rate = rate;
  call.billing_interval = setInterval(async () => {
    const elapsed = (Date.now() - call.start_time) / 1000 / 60; // minutes
    const estimatedCost = elapsed * rate;
    
    // Push cost update to app
    const appSocket = userPresence.get(call.uid).socket;
    appSocket.emit('call:external:cost', {
      callId,
      costUsd: estimatedCost.toFixed(4),
      durationSec: Math.floor(elapsed * 60),
    });
  }, 10000); // Update every 10 seconds
}

async function recordFinalBilling(callId) {
  const call = externalCalls.get(callId);
  const durationSec = (call.end_time - call.start_time) / 1000;
  const durationMin = durationSec / 60;
  const costUsd = (durationMin * call.billing_rate).toFixed(4);

  await db.runTransaction(async (transaction) => {
    // Record billing event
    const billingRef = db.collection('billing').doc();
    transaction.set(billingRef, {
      uid: call.uid,
      channel: call.channel,
      callId,
      providerCallId: call.meta_call_id || call.sip_session?.call_id,
      duration_sec: durationSec,
      cost_usd: parseFloat(costUsd),
      ratePerMinute: call.billing_rate,
      startedAt: new Date(call.start_time),
      endedAt: new Date(call.end_time),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Update daily aggregate
    const today = new Date().toISOString().split('T')[0];
    const dailyKey = `${call.uid}:${today}:${call.channel}`;
    const dailyRef = db.collection('billing_daily').doc(dailyKey);
    
    transaction.set(dailyRef, {
      uid: call.uid,
      channel: call.channel,
      date: today,
      total_duration_sec: admin.firestore.FieldValue.increment(durationSec),
      total_cost_usd: admin.firestore.FieldValue.increment(parseFloat(costUsd)),
      call_count: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  });

  clearInterval(call.billing_interval);
}
```

### Daily Aggregation Job

**Scheduled task (Cloud Tasks or Node.js cron):** Run at end of day (23:59 UTC).

**Purpose:** Pre-compute daily summaries for dashboard performance.

```javascript
async function dailyAggregationJob() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0];

  // Already pre-aggregated during call recording
  // This job is mostly a safety net to recalculate if missed
  console.log(`[Billing] Daily aggregation for ${dateStr} already done during call recording`);
}
```

### Spending Limit Enforcement

Before each call:

```javascript
async function checkSpendingLimit(uid, channel, estimatedCostUsd) {
  const limit = await getSpendingLimitForUser(uid);
  const monthlySpend = await getMonthlySpend(uid);

  if (monthlySpend + estimatedCostUsd > limit.monthlyLimitUsd) {
    throw new SpendingLimitError('Monthly limit exceeded');
  }

  const todaySpend = await getTodaySpend(uid);
  if (todaySpend + estimatedCostUsd > limit.dailyLimitUsd) {
    throw new SpendingLimitError('Daily limit exceeded');
  }

  if (channel === 'whatsapp' && monthlySpend + estimatedCostUsd > limit.whatsappOnlyUsd) {
    throw new SpendingLimitError('WhatsApp channel limit exceeded');
  }

  if (channel === 'pstn' && monthlySpend + estimatedCostUsd > limit.pstnOnlyUsd) {
    throw new SpendingLimitError('PSTN channel limit exceeded');
  }

  // Alert if threshold reached
  const percentUsed = ((monthlySpend + estimatedCostUsd) / limit.monthlyLimitUsd) * 100;
  if (percentUsed >= limit.alertThresholdPercent) {
    // Send notification to app
    socket.emit('billing:alert', {
      type: 'approaching_limit',
      percentUsed,
      limitUsd: limit.monthlyLimitUsd,
    });
  }

  return { allowed: true };
}
```

---

## Security Design

### Webhook Signature Verification

**File:** `server/src/middleware/webhookVerification.js`

```javascript
// Meta (X-Hub-Signature-256)
export function verifyMetaSignature(secret) {
  return (req, res, next) => {
    const signature = req.get('X-Hub-Signature-256');
    if (!signature) return res.status(403).json({ error: 'Missing signature' });

    const hash = crypto
      .createHmac('sha256', secret)
      .update(req.rawBody || JSON.stringify(req.body))
      .digest('hex');

    const expectedSig = `sha256=${hash}`;
    if (signature !== expectedSig) {
      return res.status(403).json({ error: 'Invalid signature' });
    }

    next();
  };
}

// Twilio (X-Twilio-Signature)
export function verifyTwilioSignature(authToken) {
  return (req, res, next) => {
    const signature = req.get('X-Twilio-Signature');
    if (!signature) return res.status(403).json({ error: 'Missing signature' });

    const url = req.originalUrl;
    const data = Object.keys(req.body)
      .sort()
      .map(key => key + req.body[key])
      .join('');

    const hash = crypto
      .createHmac('sha1', authToken)
      .update(url + data)
      .digest('base64');

    if (signature !== hash) {
      return res.status(403).json({ error: 'Invalid signature' });
    }

    next();
  };
}
```

### Permission Lifecycle

**Granted by user:** User taps CTA button in WhatsApp → permission expires 30 days later (Meta policy).

**Auto-revoked:** After 10 unanswered calls to a single WhatsApp contact in 7 days, the system auto-revokes permission.

```javascript
async function handleUnansweredCall(uid, whatsappId) {
  const externalContact = await db.collection('external_contacts')
    .where('ownerUid', '==', uid)
    .where('identifier', '==', whatsappId)
    .limit(1)
    .get();

  if (!externalContact.empty) {
    const contactDoc = externalContact.docs[0];
    const newCount = (contactDoc.data().unansweredCount || 0) + 1;

    if (newCount >= 10) {
      // Auto-revoke
      await db.collection('permissions')
        .where('ownerUid', '==', uid)
        .where('whatsappId', '==', whatsappId)
        .get()
        .then(snap => {
          snap.docs[0].ref.update({
            status: 'revoked',
            revokedAt: admin.firestore.FieldValue.serverTimestamp(),
            revokeReason: 'auto_unanswered',
          });
        });

      await invalidatePermissionCache(uid, whatsappId);
      
      // Notify user
      userPresence.get(uid)?.socket.emit('call:external:permission-revoked', {
        whatsappId,
        reason: 'auto_unanswered',
      });
    } else {
      // Update count
      await contactDoc.ref.update({
        unansweredCount: newCount,
        lastUnansweredAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }
}
```

### Rate Limiting

**Per-channel rate limits (enforced in gateway):**

- **WhatsApp:** Max 10 unanswered calls to same contact in 7 days.
- **PSTN:** Max 5 calls per minute per user; max 100 calls per day per user.

```javascript
async function checkRateLimit(uid, channel, destination) {
  const key = `ratelimit:${uid}:${channel}:${destination}`;
  const count = await redis.incr(key);
  
  if (count === 1) {
    // Set expiry for the first request
    const ttl = channel === 'whatsapp' ? 604800 : 60; // 7 days or 1 minute
    await redis.expire(key, ttl);
  }
  
  const limit = channel === 'whatsapp' ? 10 : 5;
  if (count > limit) {
    throw new RateLimitError(`Rate limit exceeded for ${channel}`);
  }
}
```

### Spending Limit Enforcement

Checked before every call (see §8.2). Prevents unexpected charges.

### Firestore Security Rules

```javascript
// external_contacts: only owner can read/write
match /external_contacts/{document=**} {
  allow read, write: if request.auth.uid == resource.data.ownerUid;
}

// permissions: only owner can read
match /permissions/{document=**} {
  allow read: if request.auth.uid == resource.data.ownerUid;
  allow write: if false; // Written only by backend
}

// billing: only owner can read
match /billing/{document=**} {
  allow read: if request.auth.uid == resource.data.uid;
  allow write: if false; // Written only by backend
}

// calls: updated with channel/direction/cost fields
match /calls/{document=**} {
  allow read, write: if request.auth.uid in [resource.data.callerUid, resource.data.calleeUid];
}
```

---

## UI Component Breakdown

### Flutter Mobile App

#### New Screens

**1. Dialer with tabs**

```dart
class DialerScreen extends StatefulWidget {
  @override
  State<DialerScreen> createState() => _DialerScreenState();
}

class _DialerScreenState extends State<DialerScreen> with TickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    _tabController = TabController(length: 3, vsync: this);
    super.initState();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Dialer'),
        bottom: TabBar(
          controller: _tabController,
          tabs: [
            Tab(text: 'App Contact'),
            Tab(text: 'WhatsApp'),
            Tab(text: 'Phone'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          AppContactDialer(),    // Existing: search app contacts
          WhatsAppContactDialer(), // New: WhatsApp dialer
          PStnPhoneDialer(),      // New: Phone number dialer
        ],
      ),
    );
  }
}
```

**2. WhatsApp Contact Dialer**

```dart
class WhatsAppContactDialer extends StatefulWidget {
  @override
  State<WhatsAppContactDialer> createState() => _WhatsAppContactDialerState();
}

class _WhatsAppContactDialerState extends State<WhatsAppContactDialer> {
  List<ExternalContact> whatsappContacts = [];
  bool loading = true;

  @override
  void initState() {
    _loadWhatsAppContacts();
    super.initState();
  }

  Future<void> _loadWhatsAppContacts() async {
    final contacts = await externalService.getExternalContacts('whatsapp');
    setState(() {
      whatsappContacts = contacts;
      loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return Center(child: CircularProgressIndicator());

    return ListView.builder(
      itemCount: whatsappContacts.length,
      itemBuilder: (context, index) {
        final contact = whatsappContacts[index];
        
        return ListTile(
          leading: CircleAvatar(child: Icon(Icons.phone)),
          title: Text(contact.displayName),
          subtitle: Text(contact.identifier),
          trailing: _buildPermissionBadge(contact.permissionStatus),
          onTap: () {
            if (contact.permissionStatus == 'granted') {
              _initiateCall(contact);
            } else if (contact.permissionStatus == 'none') {
              _requestPermission(contact);
            }
          },
        );
      },
    );
  }

  Widget _buildPermissionBadge(String? status) {
    const Map<String, Color> colors = {
      'granted': Colors.green,
      'pending': Colors.orange,
      'requested': Colors.blue,
      'revoked': Colors.red,
    };
    
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: colors[status] ?? Colors.grey,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        status ?? 'Not requested',
        style: TextStyle(color: Colors.white, fontSize: 12),
      ),
    );
  }

  Future<void> _requestPermission(ExternalContact contact) async {
    await externalService.requestWhatsAppPermission(contact.identifier);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Permission request sent')),
    );
    _loadWhatsAppContacts();
  }

  Future<void> _initiateCall(ExternalContact contact) async {
    // Generate SDP offer
    final offer = await webrtcService.createOffer();
    
    // Call API
    await callService.callWhatsApp(
      callId: generateUUID(),
      whatsappId: contact.identifier,
      sdpOffer: offer,
    );

    // Navigate to in-call screen
    Navigator.push(context, MaterialPageRoute(
      builder: (context) => ExternalInCallScreen(
        channel: 'whatsapp',
        contact: contact,
      ),
    ));
  }
}
```

**3. PSTN Phone Dialer**

```dart
class PStnPhoneDialer extends StatefulWidget {
  @override
  State<PStnPhoneDialer> createState() => _PStnPhoneDialerState();
}

class _PStnPhoneDialerState extends State<PStnPhoneDialer> {
  final phoneController = TextEditingController();
  String selectedCountry = '+1'; // Default US

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.all(16),
      child: Column(
        children: [
          // Country code selector
          DropdownButton<String>(
            value: selectedCountry,
            items: ['United States (+1)', 'India (+91)', 'UK (+44)']
              .map((e) => DropdownMenuItem(value: e, child: Text(e)))
              .toList(),
            onChanged: (val) => setState(() => selectedCountry = val ?? '+1'),
          ),
          
          // Phone number input
          TextField(
            controller: phoneController,
            keyboardType: TextInputType.phone,
            decoration: InputDecoration(
              hintText: 'Enter phone number',
              prefixText: selectedCountry,
            ),
          ),

          // Estimated cost
          FutureBuilder<double>(
            future: callService.estimateCost('pstn', 1), // 1 min
            builder: (context, snapshot) {
              if (snapshot.hasData) {
                return Text('Est. cost: \$${snapshot.data?.toStringAsFixed(3)}');
              }
              return SizedBox.shrink();
            },
          ),

          // Call button
          ElevatedButton(
            onPressed: _initiateCall,
            child: Text('Call'),
          ),
        ],
      ),
    );
  }

  Future<void> _initiateCall() async {
    final phoneNumber = selectedCountry.replaceAll(RegExp(r'[^0-9+]'), '') +
        phoneController.text;

    try {
      final offer = await webrtcService.createOffer();
      
      await callService.callPSTN(
        callId: generateUUID(),
        phoneNumber: phoneNumber,
        sdpOffer: offer,
      );

      Navigator.push(context, MaterialPageRoute(
        builder: (context) => ExternalInCallScreen(
          channel: 'pstn',
          contact: ExternalContact(identifier: phoneNumber),
        ),
      ));
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: ${e.toString()}')),
      );
    }
  }
}
```

**4. In-Call Screen (External)**

```dart
class ExternalInCallScreen extends StatefulWidget {
  final String channel;
  final ExternalContact contact;

  const ExternalInCallScreen({
    required this.channel,
    required this.contact,
  });

  @override
  State<ExternalInCallScreen> createState() => _ExternalInCallScreenState();
}

class _ExternalInCallScreenState extends State<ExternalInCallScreen> {
  bool isMuted = false;
  bool isSpeaker = false;
  int durationSec = 0;
  double costUsd = 0.0;

  @override
  void initState() {
    _startDurationTimer();
    _listenToCostUpdates();
    super.initState();
  }

  void _startDurationTimer() {
    Timer.periodic(Duration(seconds: 1), (timer) {
      setState(() => durationSec++);
    });
  }

  void _listenToCostUpdates() {
    socket.on('call:external:cost', (data) {
      setState(() {
        costUsd = data['costUsd'];
        durationSec = data['durationSec'];
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Channel badge
            Container(
              padding: EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: widget.channel == 'whatsapp' ? Colors.green : Colors.blue,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                widget.channel.toUpperCase(),
                style: TextStyle(color: Colors.white),
              ),
            ),
            SizedBox(height: 20),
            
            // Contact name
            Text(
              widget.contact.displayName ?? widget.contact.identifier,
              style: TextStyle(color: Colors.white, fontSize: 24),
            ),
            SizedBox(height: 40),

            // Timer
            Text(
              _formatDuration(durationSec),
              style: TextStyle(color: Colors.white70, fontSize: 18),
            ),

            // Cost (for paid channels)
            if (widget.channel != 'app') ...[
              SizedBox(height: 10),
              Text(
                'Cost: \$${costUsd.toStringAsFixed(3)}',
                style: TextStyle(color: Colors.orange, fontSize: 16),
              ),
            ],

            SizedBox(height: 40),

            // Controls
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                FloatingActionButton(
                  onPressed: () => setState(() => isMuted = !isMuted),
                  backgroundColor: isMuted ? Colors.red : Colors.grey,
                  child: Icon(isMuted ? Icons.mic_off : Icons.mic),
                ),
                FloatingActionButton(
                  onPressed: () => setState(() => isSpeaker = !isSpeaker),
                  backgroundColor: isSpeaker ? Colors.blue : Colors.grey,
                  child: Icon(isSpeaker ? Icons.speaker_phone : Icons.phone),
                ),
                FloatingActionButton(
                  onPressed: _endCall,
                  backgroundColor: Colors.red,
                  child: Icon(Icons.call_end),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _endCall() async {
    socket.emit('call:external:end', { 'callId': widget.contact.id });
    Navigator.pop(context);
  }

  String _formatDuration(int seconds) {
    final minutes = seconds ~/ 60;
    final secs = seconds % 60;
    return '${minutes.toString().padLeft(2, '0')}:${secs.toString().padLeft(2, '0')}';
  }
}
```

**5. Billing Dashboard Screen**

```dart
class BillingDashboardScreen extends StatefulWidget {
  @override
  State<BillingDashboardScreen> createState() => _BillingDashboardScreenState();
}

class _BillingDashboardScreenState extends State<BillingDashboardScreen> {
  late Future<BillingReport> report;

  @override
  void initState() {
    final now = DateTime.now();
    final startDate = DateTime(now.year, now.month, 1);
    final endDate = DateTime(now.year, now.month + 1, 0);
    
    report = callService.getBillingReport(
      startDate: startDate,
      endDate: endDate,
    );
    super.initState();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Billing')),
      body: FutureBuilder<BillingReport>(
        future: report,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return Center(child: CircularProgressIndicator());
          }

          if (snapshot.hasError) {
            return Center(child: Text('Error: ${snapshot.error}'));
          }

          final data = snapshot.data!;

          return ListView(
            padding: EdgeInsets.all(16),
            children: [
              // Monthly summary
              Card(
                child: Padding(
                  padding: EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('This Month', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                      SizedBox(height: 10),
                      Text('Total: \$${data.summary.totalCostUsd.toStringAsFixed(2)}'),
                      Text('Minutes: ${data.summary.totalMinutes}'),
                      Text('Calls: ${data.summary.callCount}'),
                    ],
                  ),
                ),
              ),
              SizedBox(height: 20),

              // Spending limit progress
              Card(
                child: Padding(
                  padding: EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Limit Progress', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                      SizedBox(height: 10),
                      LinearProgressIndicator(
                        value: data.limit.percentUsed / 100,
                        minHeight: 8,
                      ),
                      SizedBox(height: 5),
                      Text('\$${data.limit.remainingUsd.toStringAsFixed(2)} of \$${data.limit.monthlyUsd.toStringAsFixed(2)} remaining'),
                    ],
                  ),
                ),
              ),
              SizedBox(height: 20),

              // Per-channel breakdown
              Card(
                child: Padding(
                  padding: EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('By Channel', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                      SizedBox(height: 10),
                      ..._buildChannelRows(data.byChannel),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  List<Widget> _buildChannelRows(Map<String, ChannelStats> stats) {
    return stats.entries.map((entry) {
      return Padding(
        padding: EdgeInsets.symmetric(vertical: 8),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(entry.key),
            Text(
              '\$${entry.value.costUsd.toStringAsFixed(2)} (${entry.value.minutes}m)',
            ),
          ],
        ),
      );
    }).toList();
  }
}
```

### React Web App

Similar component structure in `apps/web/src/components/external/`:

```
apps/web/src/components/external/
├── DialerTabs.tsx           # Tabs: App / WhatsApp / Phone
├── WhatsAppDialer.tsx       # WhatsApp contact dialer
├── PStnDialer.tsx           # Phone number dialer
├── ExternalInCall.tsx       # In-call screen
├── BillingDashboard.tsx     # Billing report
└── PermissionBadge.tsx      # Permission status indicator
```

---

## Migration Path

### Phase 1 MVP Code (Unchanged)

Existing modules remain unaffected:
- `server/src/services/firebase.js` — No changes to existing functions; only additions.
- `server/src/services/signaling.js` — No changes; gateway is separate service.
- `server/src/routes/users.js`, `contacts.js`, `calls.js` — Unchanged.

### Phase 3 Additions

**New files added under `server/src/`:**

```
server/src/
├── services/gateway/
│   ├── index.js
│   ├── state.js
│   ├── billing.js
│   ├── cache.js
│   ├── whatsapp/
│   │   ├── client.js
│   │   ├── webhook.js
│   │   └── permission.js
│   └── pstn/
│       ├── client.js
│       └── webhook.js
├── routes/
│   ├── external.js           # NEW
│   └── webhooks.js           # NEW
└── middleware/
    └── webhookVerification.js # NEW
```

**Modified files:**

- `server/src/index.js` — Register new routes (external.js, webhooks.js)
- `server/src/services/firebase.js` — Add new collections + fields to existing schema (extensions, not breaking changes)
- `server/package.json` — Add dependencies: `redis`, `axios`, `sip.js`

**Client additions:**

- `apps/mobile/lib/screens/DialerScreen.dart` — Tab-based dialer
- `apps/mobile/lib/services/external_service.dart` — WhatsApp/PSTN API calls
- `apps/web/src/components/external/` — React components

### Backward Compatibility

- Existing app-to-app calls unaffected (channel defaults to 'app').
- New `calls.channel` field is nullable; existing calls have null (treated as 'app').
- Firestore security rules additive (new collections have own rules).
- New Socket.io events (`call:external-*`) do not conflict with existing events.

---

## Testing Strategy

### Unit Tests

**WhatsApp permission checks** (`server/src/services/gateway/whatsapp/permission.js`)

```javascript
describe('WhatsApp Permission Checks', () => {
  it('should reject call without permission', async () => {
    const result = await checkPermissionBeforeCall('uid1', 'wa-id-123', 'call-1');
    expect(result).rejects.toThrow('Call permission not granted');
  });

  it('should reject expired permission', async () => {
    // Create permission with past expiresAt
    await db.collection('permissions').add({
      ownerUid: 'uid1',
      whatsappId: 'wa-id-123',
      status: 'granted',
      expiresAt: new Date(Date.now() - 86400000), // 1 day ago
    });

    const result = await checkPermissionBeforeCall('uid1', 'wa-id-123', 'call-1');
    expect(result).rejects.toThrow('Permission expired');
  });

  it('should allow valid permission', async () => {
    await db.collection('permissions').add({
      ownerUid: 'uid1',
      whatsappId: 'wa-id-123',
      status: 'granted',
      expiresAt: new Date(Date.now() + 2592000000), // 30 days from now
    });

    const result = await checkPermissionBeforeCall('uid1', 'wa-id-123', 'call-1');
    expect(result).resolves.toEqual({ valid: true });
  });
});
```

**Spending limit enforcement** (`server/src/services/gateway/billing.js`)

```javascript
describe('Spending Limit Enforcement', () => {
  it('should block call exceeding monthly limit', async () => {
    // Pre-populate billings to reach 45 USD
    await recordBillingEvent('call-1', {
      uid: 'uid1',
      channel: 'whatsapp',
      duration_sec: 2700, // 45 min at 0.017/min = 45 USD
      cost: 45,
    });

    // Set limit to 50 USD
    await db.collection('spending_limits').doc('uid1').set({
      uid: 'uid1',
      monthlyLimitUsd: 50,
    });

    // Try to call 10 USD (would total 55 USD)
    const result = await checkSpendingLimit('uid1', 'whatsapp', 10);
    expect(result).rejects.toThrow('Monthly limit exceeded');
  });
});
```

### Integration Tests

**Full WhatsApp call flow (using Meta sandbox)**

```javascript
describe('WhatsApp Call Flow', () => {
  it('should initiate and receive call from start to end', async () => {
    // 1. Grant permission
    await db.collection('permissions').add({
      ownerUid: 'uid1',
      whatsappId: 'wa-id-test@c.us',
      status: 'granted',
      expiresAt: new Date(Date.now() + 2592000000),
    });

    // 2. Call WhatsApp contact
    const callResponse = await request(app)
      .post('/api/external/whatsapp/call')
      .set('Authorization', `Bearer ${token}`)
      .send({
        callId: 'call-123',
        whatsappId: 'wa-id-test@c.us',
        sdpOffer: mockSdpOffer,
      });

    expect(callResponse.status).toBe(200);
    expect(callResponse.body.status).toBe('ringing');

    // 3. Simulate Meta webhook: call accepted
    const webhookPayload = {
      entry: [
        {
          changes: [
            {
              value: {
                event: 'call:incoming',
                callId: 'call-123',
                waId: 'wa-id-test@c.us',
                answer: mockSdpAnswer,
              },
            },
          ],
        },
      ],
    };

    const webhookResponse = await request(app)
      .post('/webhooks/whatsapp')
      .set('X-Hub-Signature-256', `sha256=${generateSignature(webhookPayload)}`)
      .send(webhookPayload);

    expect(webhookResponse.status).toBe(200);

    // 4. Verify call state transitioned to connected
    const callState = externalCalls.get('call-123');
    expect(callState.state).toBe('connected');

    // 5. Simulate end call
    const endPayload = {
      entry: [
        {
          changes: [
            {
              value: {
                event: 'call:status',
                callId: 'call-123',
                status: 'ended',
              },
            },
          ],
        },
      ],
    };

    await request(app)
      .post('/webhooks/whatsapp')
      .set('X-Hub-Signature-256', `sha256=${generateSignature(endPayload)}`)
      .send(endPayload);

    // 6. Verify billing recorded
    const billing = await db.collection('billing').where('callId', '==', 'call-123').get();
    expect(billing.docs.length).toBe(1);
    expect(billing.docs[0].data().cost_usd).toBeGreaterThan(0);
  });
});
```

**Full PSTN call flow (using Twilio sandbox)**

```javascript
describe('PSTN Call Flow', () => {
  it('should initiate, connect, and end PSTN call', async () => {
    // 1. Call phone number
    const callResponse = await request(app)
      .post('/api/external/pstn/call')
      .set('Authorization', `Bearer ${token}`)
      .send({
        callId: 'pstn-call-123',
        phoneNumber: '+12025551234',
        sdpOffer: mockSdpOffer,
      });

    expect(callResponse.status).toBe(200);
    expect(callResponse.body.status).toBe('ringing');

    // 2. Simulate Twilio webhook: call in progress
    const inProgressPayload = new URLSearchParams({
      CallSid: 'CA1234567890abcdef',
      CallStatus: 'in-progress',
    });

    const webhookResponse = await request(app)
      .post('/webhooks/pstn')
      .set('X-Twilio-Signature', generateTwilioSignature(inProgressPayload))
      .send(inProgressPayload.toString());

    expect(webhookResponse.status).toBe(200);

    // 3. Simulate end call
    const completedPayload = new URLSearchParams({
      CallSid: 'CA1234567890abcdef',
      CallStatus: 'completed',
    });

    await request(app)
      .post('/webhooks/pstn')
      .set('X-Twilio-Signature', generateTwilioSignature(completedPayload))
      .send(completedPayload.toString());

    // 4. Verify billing recorded
    const billing = await db.collection('billing')
      .where('callId', '==', 'pstn-call-123')
      .get();
    expect(billing.docs.length).toBe(1);
  });
});
```

### Network/Device Tests

| Test | Approach |
|------|----------|
| NAT traversal with external calls | Force TURN relay; verify call connects through gateway |
| Network switching (WiFi ↔ mobile data) during external call | Use Twilio Network Debug Toolkit to simulate network changes |
| Background app state + incoming external call | Simulate push notification + app wake-up; verify call appears in active call screen |
| Rate limiting | Send 11 calls to same WhatsApp ID within window; verify 11th rejected |

### Security Tests

| Test | Approach |
|------|----------|
| Webhook signature verification | Send webhook with invalid signature; expect 403 |
| Permission enforcement | Try to call without permission; expect 403 |
| Spending limit | Create pre-populated billing; call with low remaining balance; expect 402 |
| NDNC check (India PSTN) | Call number on test NDNC registry; expect rejection |

### Sandbox Credentials

**Meta (WhatsApp Business Calling API):**
- Sandbox phone number: 16505551234
- Test WhatsApp ID: 1234567890@c.us
- Webhook URL (ngrok tunnel for local testing): https://tunnel-id.ngrok.io/webhooks/whatsapp

**Twilio (SIP Trunking):**
- Test SIP domain: sip.twilio.com
- Test phone number: +12025551234
- Webhook URL: https://tunnel-id.ngrok.io/webhooks/pstn

---

## Environment Variables

Add to `server/.env`:

```plaintext
# WhatsApp Business Calling API (Meta)
META_ACCESS_TOKEN=<Business Account token>
META_APP_SECRET=<Webhook verification secret>
META_PHONE_NUMBER_ID=<Business phone number ID>

# PSTN Provider (Twilio)
TWILIO_ACCOUNT_SID=<Account SID>
TWILIO_AUTH_TOKEN=<Auth token>
TWILIO_SIP_DOMAIN=<SIP domain>
TWILIO_SIP_USERNAME=<SIP username>
TWILIO_SIP_PASSWORD=<SIP password>

# Redis (caching)
REDIS_URL=redis://localhost:6379

# Billing
WHATSAPP_RATE_PER_MINUTE=0.017
PSTN_RATE_PER_MINUTE_DEFAULT=0.02
PSTN_RATE_PER_MINUTE_INDIA=0.015

# Spending limits
DEFAULT_MONTHLY_LIMIT_USD=50
DEFAULT_DAILY_LIMIT_USD=10
```

---

## Implementation Roadmap

| Phase | Tasks | Estimated Time |
|-------|-------|---|
| Phase 3a | Data model + permission tracking + Redis setup | 1 week |
| Phase 3b | WhatsApp integration (Meta API + webhooks) | 1.5 weeks |
| Phase 3c | PSTN integration (Twilio SIP + webhooks) | 1.5 weeks |
| Phase 3d | Billing service + spending limits | 1 week |
| Phase 3e | UI screens (Flutter + React) | 2 weeks |
| Phase 3f | Testing + compliance checks | 1 week |
| Phase 3g | Deployment + monitoring | 0.5 week |
| **Total** | | **~9 weeks** |

---

## Assumptions & Open Questions

1. **Meta Sandbox:** We assume access to Meta WhatsApp Business Calling API sandbox for testing. Production requires verified business profile and payment method.

2. **Twilio Sandbox:** Twilio provides free sandbox for testing SIP trunking. Production deployment requires account verification and number registration.

3. **India PSTN compliance:** Design assumes Exotel or equivalent provider with TRAI-compliant number registration. Implementation details may vary by provider.

4. **Redis requirement:** Phase 3 MVP requires Redis for permission caching. Can be optional/in-memory for MVP if Redis unavailable.

5. **User consent recording:** Design logs IP + timestamp on permission grant. Legal review recommended before launch for GDPR/regional compliance.

6. **Rate limits tunability:** All rate limits (e.g., 10 unanswered WhatsApp calls) are configurable via environment or Firestore; no hard-coded limits.

---

## Design Review Notes

*(Reserved for reviewer feedback and responses)*

---

**Document prepared for Phase 3 implementation.**  
**Next step: Code implementation following this design.**

