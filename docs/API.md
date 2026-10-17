# CallMe REST API Reference

All endpoints require authentication with a Firebase ID token in the `Authorization` header.

```
Authorization: Bearer <Firebase ID Token>
```

---

## Health

### GET /health

Check server status.

**Request:**
```
GET /health HTTP/1.1
```

**Response (200 OK):**
```json
{
  "status": "ok"
}
```

---

## Users

### POST /api/users/username

Register or update username after Firebase signup.

**Request:**
```
POST /api/users/username HTTP/1.1
Content-Type: application/json
Authorization: Bearer <token>

{
  "username": "john_doe"
}
```

**Response (201 Created):**
```json
{
  "uid": "firebase-uid",
  "username": "john_doe"
}
```

**Errors:**
- `400` - Invalid username format
- `409` - Username already taken
- `401` - Unauthorized (invalid token)

---

### GET /api/users/search

Search for a user by exact username.

**Request:**
```
GET /api/users/search?username=alice HTTP/1.1
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "uid": "user-uid-123",
  "username": "alice",
  "displayName": "Alice Smith",
  "photoURL": "https://example.com/photo.jpg"
}
```

**Errors:**
- `404` - User not found
- `400` - Invalid query parameter
- `401` - Unauthorized

---

## Contacts

### GET /api/contacts

List all contacts (accepted status only).

**Request:**
```
GET /api/contacts HTTP/1.1
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
[
  {
    "uid": "contact-uid-1",
    "username": "bob",
    "displayName": "Bob Johnson",
    "status": "accepted",
    "isOnline": true
  },
  {
    "uid": "contact-uid-2",
    "username": "carol",
    "displayName": "Carol White",
    "status": "accepted",
    "isOnline": false
  }
]
```

**Errors:**
- `401` - Unauthorized

---

### POST /api/contacts/request

Send a contact request to another user.

**Request:**
```
POST /api/contacts/request HTTP/1.1
Content-Type: application/json
Authorization: Bearer <token>

{
  "toUid": "target-user-uid"
}
```

**Response (200 OK):**
```json
{
  "message": "Contact request sent"
}
```

**Errors:**
- `400` - Invalid user ID
- `404` - Target user not found
- `409` - Already contacts or request pending
- `401` - Unauthorized
- `429` - Rate limited (too many requests)

---

### POST /api/contacts/respond

Accept or decline a pending contact request.

**Request:**
```
POST /api/contacts/respond HTTP/1.1
Content-Type: application/json
Authorization: Bearer <token>

{
  "contactUid": "requester-uid",
  "action": "accept"
}
```

Parameters:
- `contactUid`: UID of the user who sent the request
- `action`: Either `"accept"` or `"reject"`

**Response (200 OK):**
```json
{
  "message": "Contact request accepted"
}
```

**Errors:**
- `400` - Invalid action
- `404` - Contact request not found
- `401` - Unauthorized

---

### POST /api/contacts/block

Block a user from calling or sending requests.

**Request:**
```
POST /api/contacts/block HTTP/1.1
Content-Type: application/json
Authorization: Bearer <token>

{
  "contactUid": "user-to-block-uid"
}
```

**Response (200 OK):**
```json
{
  "message": "User blocked"
}
```

**Errors:**
- `400` - Invalid user ID
- `404` - User not found
- `401` - Unauthorized

---

## Calls

### GET /api/calls/history

Retrieve paginated call history.

**Request:**
```
GET /api/calls/history?limit=20&offset=0 HTTP/1.1
Authorization: Bearer <token>
```

Query Parameters:
- `limit`: Number of records to return (default: 20, max: 100)
- `offset`: Number of records to skip (default: 0)

**Response (200 OK):**
```json
[
  {
    "callId": "uuid-v4",
    "fromUid": "alice-uid",
    "toUid": "bob-uid",
    "fromUsername": "alice",
    "toUsername": "bob",
    "status": "completed",
    "startedAt": 1700000000000,
    "answeredAt": 1700000005000,
    "endedAt": 1700000125000,
    "duration": 120
  }
]
```

Status values:
- `calling` - Call initiated, waiting for answer
- `ringing` - Recipient notified
- `answered` - Call answered
- `completed` - Call ended normally
- `rejected` - Recipient declined
- `missed` - Recipient did not answer in time

**Errors:**
- `401` - Unauthorized

---

## TURN Credentials

### GET /api/turn-credentials

Get time-limited TURN server credentials for a call.

**Request:**
```
GET /api/turn-credentials HTTP/1.1
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "username": "1234567890:alice",
  "credential": "credential-string-hmac",
  "ttl": 3600,
  "urls": [
    "turn:turn.example.com:3478",
    "turn:turn.example.com:3478?transport=tcp",
    "turns:turn.example.com:5349"
  ]
}
```

Fields:
- `username`: Temporary username for TURN auth
- `credential`: HMAC-based credential (expires)
- `ttl`: Time-to-live in seconds
- `urls`: TURN server URLs to use

**Errors:**
- `401` - Unauthorized
- `503` - TURN service unavailable

---

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### Common HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200  | Success |
| 201  | Created |
| 400  | Bad request (invalid parameters) |
| 401  | Unauthorized (invalid/missing token) |
| 403  | Forbidden (insufficient permissions) |
| 404  | Not found |
| 409  | Conflict (resource already exists) |
| 429  | Rate limited |
| 500  | Server error |
| 503  | Service unavailable |

---

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

- **Per user**: 100 requests per 15 minutes
- **Per IP**: 1000 requests per 15 minutes
- **Contact requests**: 10 per minute per user
- **Search**: 30 per minute per user

Rate limit information is included in response headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1700000000
```

When rate limited, the server responds with `429 Too Many Requests`.

---

## Authentication

All requests must include a valid Firebase ID token:

```bash
# Get token in client code:
const token = await firebase.auth().currentUser?.getIdToken();

# Use in API request:
curl -H "Authorization: Bearer $token" https://api.example.com/api/contacts
```

Tokens expire after 1 hour. The client SDK automatically handles refresh.

---

## Examples

### Complete Call Flow

```bash
# 1. Sign up (via Firebase SDK)
# Creates user in Firebase Auth

# 2. Register username
curl -X POST https://api.example.com/api/users/username \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"alice"}'

# 3. Search for contact
curl "https://api.example.com/api/users/search?username=bob" \
  -H "Authorization: Bearer $TOKEN"

# 4. Send contact request
curl -X POST https://api.example.com/api/contacts/request \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"toUid":"bob-uid"}'

# 5. (Bob accepts via app)

# 6. Get TURN credentials before calling
curl https://api.example.com/api/turn-credentials \
  -H "Authorization: Bearer $TOKEN"

# 7. Initiate call (via Socket.io)

# 8. Get call history
curl "https://api.example.com/api/calls/history?limit=20" \
  -H "Authorization: Bearer $TOKEN"
```
