# CallMe Socket.io Signaling Protocol

This document describes all Socket.io events used by CallMe for signaling and presence management.

---

## Authentication

### Client → Server: `auth`

Authenticate the socket connection with Firebase ID token.

**Payload:**
```json
{
  "token": "firebase-id-token"
}
```

**Server Response:**
```json
{
  "uid": "user-uid",
  "online": true
}
```

---

### Server → Client: `auth:ok`

Confirmation that authentication succeeded.

**Payload:**
```json
{
  "uid": "user-uid",
  "message": "Authenticated"
}
```

### Server → Client: `auth:error`

Authentication failed.

**Payload:**
```json
{
  "reason": "Invalid token"
}
```

---

## Call Signaling

### Client → Server: `call:request`

Initiate a call to another user.

**Payload:**
```json
{
  "callId": "uuid-v4",
  "toUsername": "bob"
}
```

---

### Server → Client: `call:incoming`

Notify that an incoming call is received.

**Payload:**
```json
{
  "callId": "uuid-v4",
  "fromUid": "alice-uid",
  "fromUsername": "alice",
  "fromDisplayName": "Alice Smith"
}
```

---

### Client → Server: `call:accept`

Accept an incoming call.

**Payload:**
```json
{
  "callId": "uuid-v4"
}
```

---

### Server → Client: `call:accepted`

Confirm that the call was accepted by the recipient.

**Payload:**
```json
{
  "callId": "uuid-v4"
}
```

---

### Client → Server: `call:reject`

Decline an incoming call.

**Payload:**
```json
{
  "callId": "uuid-v4"
}
```

---

### Server → Client: `call:rejected`

Notify that the call was rejected.

**Payload:**
```json
{
  "callId": "uuid-v4"
}
```

---

### Server → Client: `call:unavailable`

Call cannot be completed (user offline, blocked, busy, etc.).

**Payload:**
```json
{
  "callId": "uuid-v4",
  "reason": "offline|busy|blocked|not_found"
}
```

---

### Client → Server: `call:end`

Terminate the call.

**Payload:**
```json
{
  "callId": "uuid-v4"
}
```

---

### Server → Client: `call:ended`

Notify that the remote peer ended the call.

**Payload:**
```json
{
  "callId": "uuid-v4",
  "reason": "normal|timeout|network_error"
}
```

---

## WebRTC Negotiation

### Client → Server: `webrtc:offer`

Send SDP offer to initiate WebRTC connection.

**Payload:**
```json
{
  "callId": "uuid-v4",
  "sdp": {
    "type": "offer",
    "sdp": "v=0\r\no=- ... (full SDP)"
  }
}
```

---

### Server → Client: `webrtc:offer`

Relay SDP offer to recipient.

**Payload:**
```json
{
  "callId": "uuid-v4",
  "sdp": {
    "type": "offer",
    "sdp": "v=0\r\no=- ... (full SDP)"
  }
}
```

---

### Client → Server: `webrtc:answer`

Send SDP answer to accept WebRTC connection.

**Payload:**
```json
{
  "callId": "uuid-v4",
  "sdp": {
    "type": "answer",
    "sdp": "v=0\r\no=- ... (full SDP)"
  }
}
```

---

### Server → Client: `webrtc:answer`

Relay SDP answer to caller.

**Payload:**
```json
{
  "callId": "uuid-v4",
  "sdp": {
    "type": "answer",
    "sdp": "v=0\r\no=- ... (full SDP)"
  }
}
```

---

### Client → Server: `webrtc:ice`

Send ICE candidate for connection establishment.

**Payload:**
```json
{
  "callId": "uuid-v4",
  "candidate": {
    "candidate": "candidate:... (full ICE candidate)",
    "sdpMLineIndex": 0,
    "sdpMid": "0"
  }
}
```

---

### Server → Client: `webrtc:ice`

Relay ICE candidate to peer.

**Payload:**
```json
{
  "callId": "uuid-v4",
  "candidate": {
    "candidate": "candidate:... (full ICE candidate)",
    "sdpMLineIndex": 0,
    "sdpMid": "0"
  }
}
```

---

## Presence

### Server → Client: `presence:update`

Notify that a contact's online status changed.

**Payload:**
```json
{
  "uid": "user-uid",
  "online": true
}
```

---

## Complete Call Flow Sequence

```
Alice                          Signaling Server                      Bob
  │                                 │                                 │
  │──────────auth({token})──────────►                                 │
  │                                 │                                 │
  │                          ◄──auth:ok──────                          │
  │                                 │                                 │
  │                                 │                    auth({token})─►
  │                                 │◄──────────────auth:ok────────────│
  │                                 │                                 │
  │     call:request({callId,      │                                 │
  │     toUsername: "bob"})────────►                                 │
  │                                 │                                 │
  │                                 │      call:incoming──────────────►
  │                                 │                                 │
  │                                 │◄────call:accept({callId})────────│
  │                                 │                                 │
  │                          call:accepted                            │
  │                          ({callId})──                             │
  │◄────────────────────────────────                                 │
  │                                 │                                 │
  │  webrtc:offer({callId, sdp})───►                                 │
  │                                 │                                 │
  │                                 │    webrtc:offer({callId, sdp})─►
  │                                 │                                 │
  │                                 │◄──webrtc:answer({callId, sdp})──│
  │                                 │                                 │
  │           webrtc:answer         │                                 │
  │           ({callId, sdp})◄──────                                 │
  │                                 │                                 │
  │  webrtc:ice({callId, ...})──────┼─webrtc:ice({callId, ...})──────►
  │                                 │                                 │
  │◄──webrtc:ice({callId, ...})─────┼──webrtc:ice({callId, ...})      │
  │                                 │                                 │
  ├─────────audio/video (P2P or TURN)─────────────────────────────────►
  │                                 │                                 │
  │  call:end({callId})────────────►                                 │
  │                                 │                                 │
  │                                 │    call:ended({callId})────────►
  │                                 │                                 │
```

---

## Error Events

### Server → Client: `error`

Generic error event.

**Payload:**
```json
{
  "message": "Error description"
}
```

---

## Timing Requirements

- **Offer/Answer**: Must complete within 30 seconds of call initiation
- **ICE Gathering**: Completes within 5-10 seconds typically
- **Connection Establishment**: Should complete within 10 seconds
- **Missed Call**: Call rings for 30 seconds before auto-rejecting

---

## Event Transmission

### Reliable Delivery

Socket.io guarantees delivery by default. Lost events are re-sent.

### Event Queue

If a peer is temporarily disconnected:
1. Server queues incoming call notifications (up to 10 seconds)
2. Upon reconnection, queued events are delivered
3. If peer doesn't reconnect within timeout, call is auto-rejected

### Duplicate Protection

Clients should handle duplicate events (use callId for deduplication).

---

## Implementation Notes

### State Transitions

```
IDLE
  ├─ call:request ──► CALLING (caller side)
  │
RINGING (callee notified)
  ├─ call:accept ──► CONNECTING
  └─ call:reject ──► IDLE
  
CONNECTING (offer/answer exchange)
  ├─ webrtc negotiation complete ──► CONNECTED
  └─ timeout/error ──► ENDED
  
CONNECTED (media flowing)
  ├─ call:end ──► ENDED
  └─ connection failure ──► RECONNECTING ──► CONNECTED or ENDED
  
ENDED (call terminated)
```

### Retry Logic

- Socket disconnects: Auto-reconnect with exponential backoff
- Signaling event failure: Retry up to 3 times
- After 3 failures: Emit `call:ended` with `network_error`

---

## Security

- All events require authenticated socket connection
- Messages with invalid callId or non-participant uid are ignored
- Rate limiting: max 100 events per user per minute
- Signaling server never relays SDP containing sensitive data
