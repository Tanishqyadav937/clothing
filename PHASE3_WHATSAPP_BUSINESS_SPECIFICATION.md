# Phase 3: WhatsApp Business Calling API Integration

## Overview

**Model:** Business-to-User (B2U) calling via WhatsApp Business Calling API
- **User → Business calls:** FREE (incoming calls to your business number)
- **Business → User calls:** PAID (per-minute charges on your Meta account)

This is NOT for personal WhatsApp accounts. It requires:
1. Verified WhatsApp Business Account
2. Business Phone Number registered on Meta Cloud API
3. Payment method added to Meta account
4. Proper webhook setup for receiving call events

---

## Architecture

### Components

```
┌─────────────────┐
│  CallMe App     │
│  (User A)       │
└────────┬────────┘
         │ signaling
         │ (WebRTC setup)
         │
┌────────▼─────────────────┐
│  Signaling Server        │
│  (Node.js + Socket.io)   │
└────────┬─────────────────┘
         │
         │ Call routing
         │
┌────────▼──────────────────────┐
│  Channel Gateway Service      │
│  (WhatsApp bridge)            │
└────────┬──────────────────────┘
         │ REST API calls
         │
┌────────▼──────────────────────────────┐
│  Meta Cloud API (WhatsApp Business)   │
│  /v18.0/{BUSINESS_PHONE_NUMBER_ID}/   │
│  calls                                │
└──────┬───────────────────────────┬────┘
       │ Webhook events            │ REST responses
       │                           │
┌──────▼─────────────────────────────────┐
│  WhatsApp User (on normal WhatsApp)    │
│  (Business → User call incoming)       │
└────────────────────────────────────────┘
```

### Call Flow (Business → User)

```
1. App user taps "Call WhatsApp contact" in dialer
2. Signaling server checks:
   - Is user's spend limit remaining?
   - Does target have permission granted?
3. Signaling server → Channel Gateway: "initiate WhatsApp call to {phone_number}"
4. Channel Gateway → Meta API: POST /calls with SDP offer
5. Meta rings the WhatsApp user
6. WhatsApp user accepts on their WhatsApp app
7. Meta → Channel Gateway (webhook): Call accepted, SDP answer received
8. Channel Gateway → Signaling server: "call connected"
9. App and WhatsApp user audio stream established (VoIP over WebRTC)
10. Either side hangs up → Meta webhook notifies → billing recorded

```

---

## WhatsApp Business API Setup

### Prerequisites (One-time Setup)

1. **Create/Verify Business Account on Meta**
   - Go to: https://business.facebook.com
   - Create or link existing business account

2. **Add Phone Number**
   - Verify a business phone number (WhatsApp will use this)
   - Get `PHONE_NUMBER_ID` from Meta

3. **Create System User with API Token**
   - Generate `WHATSAPP_API_ACCESS_TOKEN` with scope: `whatsapp_business_messaging`, `whatsapp_business_calls`
   - Get `BUSINESS_ACCOUNT_ID`

4. **Add Payment Method**
   - Payment method REQUIRED for Business → User calls (per-minute charges)
   - Add card to Meta Billing

5. **Set Up Webhook**
   - Endpoint: `https://your-domain.com/webhooks/whatsapp`
   - Verify token: Generate a random string, store as `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
   - Subscribe to: `calls` and `messages` webhooks

### Environment Variables

```env
# WhatsApp Business API Credentials (from Meta)
WHATSAPP_BUSINESS_ACCOUNT_ID=123456789  # From Meta Business Settings
WHATSAPP_BUSINESS_PHONE_NUMBER_ID=987654321  # Your verified business number ID
WHATSAPP_API_ACCESS_TOKEN=EABsxxx...  # System User token (never share!)
WHATSAPP_API_VERSION=v18.0  # Check Meta docs for latest stable version
WHATSAPP_WEBHOOK_VERIFY_TOKEN=super_secret_token_you_generate  # For webhook verification

# Cost Configuration
WHATSAPP_COST_PER_MINUTE=0.05  # Example: $0.05/min (check Meta current pricing)
MAX_USER_SPEND_PER_DAY=100  # INR or USD depending on your region
BILLING_CURRENCY=INR  # For India
```

---

## Data Model

### New Firestore Collections

#### `external_contacts` (Firestore)
```json
{
  "id": "user-123-whatsapp-9876543210",
  "ownerUid": "user-123",
  "channel": "whatsapp",
  "phoneNumber": "+919876543210",
  "permissionStatus": "granted",  // "none", "requested", "granted", "revoked"
  "permissionGrantedAt": 1698765432100,
  "permissionExpiresAt": 1798765432100,  // null = permanent
  "unansweredCallCount": 0,  // incremented on each unanswered call
  "lastCallAt": 1698765400000,
  "createdAt": 1698765000000,
  "updatedAt": 1698765432100
}
```

#### `billing_transactions` (Firestore)
```json
{
  "id": "txn-uuid",
  "userId": "user-123",
  "callId": "call-uuid",
  "channel": "whatsapp",
  "phoneNumber": "+919876543210",
  "durationSeconds": 180,  // call duration
  "costPerMinute": 0.05,
  "totalCost": 0.15,  // 3 min * $0.05
  "currency": "USD",
  "status": "completed",  // "pending", "completed", "failed"
  "metaCallId": "meta-provided-call-id",
  "createdAt": 1698765432100,
  "completedAt": 1698765612100
}
```

#### `whatsapp_permissions` (Firestore - for caching)
```json
{
  "id": "user-123-permissions",
  "userId": "user-123",
  "totalSpentToday": 45.50,  // Running total for today
  "maxSpendLimit": 100,
  "dailyResetAt": "2024-10-25T00:00:00Z",
  "updatedAt": 1698765432100
}
```

#### Updated `calls` collection - add fields
```json
{
  // existing fields...
  "channel": "whatsapp",  // "app", "whatsapp", "pstn"
  "externalPhoneNumber": "+919876543210",  // if channel is whatsapp/pstn
  "direction": "outbound",  // "inbound", "outbound"
  "metaCallId": "meta-call-id-from-api",
  "costAmount": 0.15,  // filled after call ends
  "costCurrency": "USD"
}
```

---

## API Endpoints (Channel Gateway)

### POST `/api/external/whatsapp/call`

**Request**
```json
{
  "phoneNumber": "+919876543210",
  "callType": "audio"
}
```

**Server-side checks**
1. Verify user's daily spend limit not exceeded
2. Verify phone number is in user's external_contacts with `permissionStatus: "granted"`
3. Create a call record
4. Call Meta API to initiate call

**Response (Success)**
```json
{
  "callId": "call-uuid",
  "metaCallId": "meta-call-id",
  "status": "ringing",
  "phoneNumber": "+919876543210",
  "estimatedCostPerMinute": 0.05
}
```

**Response (Error)**
```json
{
  "error": "SPEND_LIMIT_EXCEEDED" | "PERMISSION_NOT_GRANTED" | "INVALID_PHONE"
}
```

---

### POST `/webhooks/whatsapp`

**Webhook Event: Incoming Call (User → Business)**
```json
{
  "entry": [{
    "id": "business-account-id",
    "changes": [{
      "field": "calls",
      "value": {
        "from": {
          "id": "919876543210",  // Caller's WhatsApp ID
          "number": "+919876543210"
        },
        "call_id": "meta-call-id-xyz",
        "state": "INCOMING",
        "timestamp": 1698765432
      }
    }]
  }]
}
```

**Action:** Ring the user's app with `fromPhoneNumber: "+919876543210"` (if known contact). If not in contacts, show "Call from WhatsApp user".

---

### POST `/webhooks/whatsapp` (Call Status Change)

**Webhook Event: Call Accepted**
```json
{
  "entry": [{
    "changes": [{
      "field": "calls",
      "value": {
        "call_id": "meta-call-id-xyz",
        "state": "ACCEPTED",
        "sdp_answer": "v=0\n..."  // SDP answer to send to caller
      }
    }]
  }]
}
```

**Action:** Send SDP answer to app, start billing timer.

---

### POST `/webhooks/whatsapp` (Call Ended)

**Webhook Event: Call Disconnected**
```json
{
  "entry": [{
    "changes": [{
      "field": "calls",
      "value": {
        "call_id": "meta-call-id-xyz",
        "state": "DISCONNECT",
        "duration_seconds": 180,
        "disconnect_reason": "USER_HANGUP" | "NETWORK_ERROR"
      }
    }]
  }]
}
```

**Action:**
1. Stop billing timer
2. Calculate cost: `duration_seconds / 60 * WHATSAPP_COST_PER_MINUTE`
3. Create `billing_transactions` record
4. Deduct from user's daily spend in `whatsapp_permissions`
5. End call in app
6. Check if spend limit exceeded → notify user

---

## Channel Gateway Service Code Structure

### File: `/server/src/services/whatsapp/whatsapp-gateway.js`

```javascript
class WhatsAppGateway {
  
  // Authenticate with Meta
  async authenticate() {
    this.accessToken = process.env.WHATSAPP_API_ACCESS_TOKEN;
    this.phoneNumberId = process.env.WHATSAPP_BUSINESS_PHONE_NUMBER_ID;
    this.apiVersion = process.env.WHATSAPP_API_VERSION;
  }

  // Initiate a call to a WhatsApp user
  async initiateCall(userId, phoneNumber, callType) {
    // 1. Check spend limit
    const canSpend = await this.checkSpendLimit(userId);
    if (!canSpend) throw new Error("SPEND_LIMIT_EXCEEDED");

    // 2. Check permission
    const hasPermission = await this.checkPermission(userId, phoneNumber);
    if (!hasPermission) throw new Error("PERMISSION_NOT_GRANTED");

    // 3. Call Meta API
    const metaCallId = await this.callMetaAPI(phoneNumber, callType);

    // 4. Create call record
    const callId = await this.createCallRecord(userId, phoneNumber, metaCallId);

    return { callId, metaCallId, status: "ringing" };
  }

  // Handle incoming webhook
  async handleWebhook(event) {
    const callEvent = event.entry[0].changes[0].value;
    const state = callEvent.state;  // INCOMING, ACCEPTED, DISCONNECT

    if (state === "INCOMING") {
      await this.handleIncomingCall(callEvent);
    } else if (state === "ACCEPTED") {
      await this.handleCallAccepted(callEvent);
    } else if (state === "DISCONNECT") {
      await this.handleCallDisconnected(callEvent);
    }
  }

  // Calculate and record billing
  async recordBilling(userId, callId, durationSeconds, metaCallId) {
    const cost = (durationSeconds / 60) * parseFloat(process.env.WHATSAPP_COST_PER_MINUTE);
    
    // Create billing record
    await firestore.collection("billing_transactions").add({
      userId,
      callId,
      channel: "whatsapp",
      durationSeconds,
      totalCost: cost,
      status: "completed",
      metaCallId,
      createdAt: new Date()
    });

    // Update daily spend
    await this.updateDailySpend(userId, cost);
  }

  // Verify webhook signature
  static verifyWebhookSignature(req, token) {
    const signature = req.headers["x-hub-signature-256"];
    // Verify HMAC-SHA256 signature
    // This prevents fake webhook calls from attackers
  }
}
```

---

## Security Measures

### 1. Webhook Verification
- Meta includes `x-hub-signature-256` header
- Server verifies HMAC-SHA256(payload, verify_token) == signature
- Reject unsigned webhooks

### 2. Permission Enforcement
- Check `permissionStatus: "granted"` before initiating call
- Automatic revocation after N unanswered calls (set to 2-3)
- Permanent permission revocation for spam/abuse reports

### 3. Spend Limiting
- Check daily limit before every Business → User call
- Update `whatsapp_permissions` collection on every transaction
- Notify user when approaching limit
- Block calls if limit exceeded

### 4. Rate Limiting
- Limit call requests per user per minute (e.g., 5 calls/min max)
- Limit permission requests per user per day
- Return 429 Too Many Requests

### 5. Data Privacy
- Store only phone number (hashed option available)
- Never log full SDP/credentials
- Comply with Meta's data handling agreement
- Comply with WhatsApp user privacy

---

## Testing

### Meta Sandbox
1. Use Meta's WhatsApp API sandbox environment for testing
2. Registered test phone numbers available
3. No real charges in sandbox

### Test Cases
1. **Permission Flow:** Request permission → Receive approval via webhook
2. **Incoming Call:** Incoming call from test WhatsApp number → App receives notification
3. **Outgoing Call:** App initiates call → User rings on WhatsApp → Accept → Audio flows → Hang up → Billing recorded
4. **Spend Limit:** Call repeatedly until limit hit → 6th call rejected with error
5. **Permission Revocation:** Unanswered calls → Auto-revoke after N attempts
6. **Webhook Verification:** Fake webhook rejected, real webhook accepted

---

## Compliance & Deployment Checklist

- [ ] Verified WhatsApp Business Account created
- [ ] Business phone number verified on Meta
- [ ] System User created with API token
- [ ] Payment method added to Meta account
- [ ] Webhook endpoint HTTPS-enabled and publicly accessible
- [ ] Webhook signature verification implemented
- [ ] Rate limiting and spend limits configured
- [ ] Billing tracking tested and logging working
- [ ] Terms of Service updated (paid calling feature disclosed)
- [ ] Privacy Policy updated (WhatsApp number storage)
- [ ] Support process for permission revocation and disputes
- [ ] Monitoring set up for API errors and webhook failures
- [ ] Rollback plan if API quota exceeded

---

## Cost Estimation

**Meta WhatsApp Business Calling API Pricing** (as of Oct 2024, verify on Meta docs)
- Business → User call: ~$0.05-$0.10 per minute (varies by country)
- User → Business call: Free (incoming)
- SMS: ~$0.01 per message

**Example Daily Cost** (100 active users, avg 5 min calls)
- 100 users × 5 min × $0.05/min = $25/day = ~$750/month

**Recommendation:** Use spending limits per user to control costs during beta.

---

## Next Steps (After MVP is Live)

1. Apply for WhatsApp Business Calling API access
2. Set up Meta sandbox for testing
3. Implement Channel Gateway service
4. Test end-to-end flow with real WhatsApp numbers
5. Deploy to production with spending limits
6. Monitor first 100 calls and costs
7. Adjust billing model based on usage patterns
