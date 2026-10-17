# Implementation Plan: CallMe WebRTC MVP — React Web App & Infrastructure

This plan covers **FEAT-004** (React web app implementation) and **FEAT-005** (infrastructure & documentation) for the CallMe WebRTC calling application.

**Workflow:** Sequential implementation of FEAT-004 (web app), then FEAT-005 (infra/docs), followed by integration verification and review loop.

---

## Phase 1: React Web App (FEAT-004)

### Setup & Dependencies

- [ ] 1. **Add missing TypeScript and development dependencies to /apps/web/package.json**
      Missing packages: `zustand`, `react-hook-form`, `react-icons`, `@types/react`, `@types/react-dom`, `typescript`, `uuid`.
      Files: `apps/web/package.json`
      Verify: `cd apps/web && npm install` succeeds with no errors.

- [ ] 2. **Create TypeScript configuration and update Vite config for /apps/web.**
      Create `apps/web/tsconfig.json` with React 18 + Vite defaults; update `apps/web/vite.config.js` to `.ts`, add proper aliases for src/, enable env variable loading.
      Files: `apps/web/tsconfig.json`, `apps/web/vite.config.ts`
      Verify: `cd apps/web && npm run build` completes without TypeScript errors.

### TypeScript Types & Interfaces

- [ ] 3. **Create shared TypeScript type definitions in /apps/web/src/types/.**
      Define interfaces: `User`, `Contact`, `Call`, `CallState`, `CallStatus` (enum: idle, calling, ringing, connected, ended), `PresenceStatus` (online/offline), `ContactRequest`.
      Files: `apps/web/src/types/index.ts`
      Verify: `cd apps/web && npx tsc --noEmit` shows no errors.

### Services: Firebase Auth & Firestore

- [ ] 4. **Implement Firebase initialization and authentication service in /apps/web/src/services/.**
      Create `firebase.ts`: init Firebase with env variables, export `auth` object.
      Create `auth.ts`: wrapper functions `signup(email, password, username)`, `login(email, password)`, `logout()`, `getCurrentUser()`, `getIdToken()`, `onAuthStateChanged()`, `forgotPassword(email)`. Export React hook `useAuth()`.
      Files: `apps/web/src/services/firebase.ts`, `apps/web/src/services/auth.ts`
      Verify: Import and call `useAuth()` in a test component, confirm hook returns user and methods without errors.

- [ ] 5. **Implement Firestore CRUD service in /apps/web/src/services/firestore.ts.**
      Methods: `createUser(uid, email, username, displayName)`, `getUser(uid)`, `searchUser(username)`, `listContacts(uid)`, `addContact(fromUid, toUsername)`, `respondContact(fromUid, toUid, accept: boolean)`, `getCallHistory(uid, limit?, offset?)`, `addCallRecord(callData)`, `blockUser(uid, blockUid)`.
      Files: `apps/web/src/services/firestore.ts`
      Verify: Write unit tests in `apps/web/src/services/firestore.test.ts`; run `npm run test` and confirm tests pass.

### Services: Socket.io Signaling

- [ ] 6. **Implement Socket.io client wrapper in /apps/web/src/services/socket.ts.**
      Connect to `VITE_SIGNALING_SERVER_URL` (default: `http://localhost:3001`). Event handlers: `auth`, `call:request`, `call:accept`, `call:reject`, `call:end`, `webrtc:offer`, `webrtc:answer`, `webrtc:ice`. Auto-reconnect with exponential backoff. Export React hook `useSocket()` returning socket instance and connection state.
      Files: `apps/web/src/services/socket.ts`
      Verify: Create a test component using `useSocket()`, confirm connection logs appear in browser console when dev server starts.

### Services: WebRTC

- [ ] 7. **Implement browser WebRTC peer connection wrapper in /apps/web/src/services/webrtc.ts.**
      Class `WebRTCClient`: methods `createPeerConnection(onRemoteStream, onIceCandidate)`, `getUserMedia(constraints)`, `createOffer()`, `createAnswer(offerSdp)`, `setLocalDescription(sdp)`, `addIceCandidate(candidate)`, `getStats()` (for connection quality), `close()`.
      STUN servers: `stun:stun.l.google.com:19302`, `stun:stun1.l.google.com:19302`.
      Files: `apps/web/src/services/webrtc.ts`
      Verify: Unit tests in `apps/web/src/services/webrtc.test.ts`; test offer/answer creation without actual media.

### React Contexts

- [ ] 8. **Create AuthContext in /apps/web/src/context/AuthContext.tsx.**
      Provider exports: `user` (User | null), `loading`, `error`, `login()`, `signup()`, `logout()`, `checkUsername()`. Persists auth state via Firebase `onAuthStateChanged()`. Wrap app in this provider.
      Files: `apps/web/src/context/AuthContext.tsx`
      Verify: Create test component, confirm auth state updates when login/logout is called.

- [ ] 9. **Create CallContext in /apps/web/src/context/CallContext.tsx.**
      State: `activeCall` (Call | null), `incomingCall` (Call | null), `callHistory` (Call[]), `callStatus` (CallStatus), `callError` (string | null). Methods: `initiateCall(toUid)`, `acceptCall()`, `rejectCall()`, `endCall()`, `setRemoteStream()`, `updateCallStatus()`. Integrates with Socket.io events from useSocket().
      Files: `apps/web/src/context/CallContext.tsx`
      Verify: Test component checks callStatus updates on socket events.

### Pages: Authentication Flow

- [ ] 10. **Create Splash screen page in /apps/web/src/pages/SplashPage.tsx.**
       Display logo and loading spinner. On mount, check auth state via `useAuth()`: if authenticated, redirect to `/contacts`; if not, redirect to `/login`. Show spinner while checking.
       Files: `apps/web/src/pages/SplashPage.tsx`
       Verify: Navigate to `/`, confirm redirect to `/login` or `/contacts` depending on auth state.

- [ ] 11. **Create Login page in /apps/web/src/pages/LoginPage.tsx.**
       Form: email input, password input, login button, forgot password link. On submit, call `useAuth().login()`. On success, navigate to `/contacts`. Display error message if login fails. Link to `/signup` page.
       Files: `apps/web/src/pages/LoginPage.tsx`
       Verify: Enter valid credentials, confirm navigation to `/contacts`; enter invalid credentials, confirm error message.

- [ ] 12. **Create Signup page in /apps/web/src/pages/SignupPage.tsx.**
       Form: email, password, username inputs. Implement live username availability check via `firestore.searchUser(username)` as user types (debounced 300ms). On submit, call `useAuth().signup(email, password, username)`. On success, POST to `/api/users/username` to register username server-side, then navigate to `/contacts`. Handle duplicate username error.
       Files: `apps/web/src/pages/SignupPage.tsx`
       Verify: Sign up with new email and unique username, confirm Firestore user record created and server username registration succeeds.

### Pages: Contacts & Calls

- [ ] 13. **Create Contacts home page in /apps/web/src/pages/ContactsPage.tsx.**
       Layout: left sidebar with contact list, search bar, Add Contact button; main area shows selected contact profile or empty state. Fetch contacts via `firestore.listContacts(uid)` (accepted only). Show online indicator (green dot) via Socket.io presence. Tabs/buttons for Contacts / History / Settings. Click contact to view profile and Call button.
       Files: `apps/web/src/pages/ContactsPage.tsx`
       Verify: Log in, add a contact (via other test user), confirm accepted contact appears in list with online indicator.

- [ ] 14. **Create Add Contact page in /apps/web/src/pages/AddContactPage.tsx.**
       Search input for username. On type, call `firestore.searchUser(username)` (debounced). Display results below. Click result to send contact request via `firestore.addContact(currentUid, targetUsername)`. Show confirmation message. Link back to contacts page.
       Files: `apps/web/src/pages/AddContactPage.tsx`
       Verify: Search for another user, send request, confirm request appears in their pending contacts (via other browser tab).

- [ ] 15. **Create Call pages in /apps/web/src/pages/CallPage.tsx and /apps/web/src/components/.**
       Page variants:
       - **Outgoing Call** (`CallPage.tsx` with mode="outgoing"): Display callee name, "Calling..." status, End button. Listen for `call:accepted` or `call:rejected` socket event.
       - **Incoming Call** (`IncomingCallOverlay.tsx`): Full-screen overlay with caller name, Accept (green) / Reject (red) buttons. Listen for `call:incoming` socket event.
       - **In-Call** (`CallInProgressPage.tsx`): Timer (elapsed), remote audio element, local audio on (mute visual only), control buttons (Mute toggle microphone, Speaker toggle speaker if supported, End closes connection). Display connection quality indicator (bandwidth, RTT).
       Files: `apps/web/src/pages/CallPage.tsx`, `apps/web/src/components/IncomingCallOverlay.tsx`, `apps/web/src/components/CallInProgressPage.tsx`
       Verify: Initiate call between two browser tabs, confirm outgoing/incoming screens appear, accept call, confirm audio negotiation, end call, confirm UI returns to contacts.

- [ ] 16. **Create Call History page in /apps/web/src/components/CallHistory.tsx.**
       Paginated list of past calls fetched from `firestore.getCallHistory(uid)`. Each entry: status icon (missed/received/dialed), contact name, time, duration. Click to call back. Limit 20 per page, load more button.
       Files: `apps/web/src/components/CallHistory.tsx`
       Verify: Complete a call, check History tab, confirm call entry appears with correct status and duration.

- [ ] 17. **Create Settings panel in /apps/web/src/components/SettingsPanel.tsx.**
       Display: username and email (read-only), logout button, notifications toggle, blocked users list (with unblock option). Implement logout via `useAuth().logout()`.
       Files: `apps/web/src/components/SettingsPanel.tsx`
       Verify: Log in, click Settings, confirm user info displayed, click logout, confirm redirect to login.

### App Routing & Layout

- [ ] 18. **Create main App.tsx with React Router v6 setup in /apps/web/src/App.tsx.**
       Routes: `/` (Splash), `/login`, `/signup`, `/contacts`, `/add-contact`, `/call`, `/settings`. Wrap routes in AuthContext and CallContext providers. Implement route guards: unauthenticated users redirected to `/login`, authenticated users see call overlay if incoming call exists.
       Files: `apps/web/src/App.tsx`
       Verify: Navigate to `/login` without auth, confirm page loads; log in, confirm `/contacts` loads; log out, confirm redirect to `/login`.

- [ ] 19. **Update main.tsx entry point in /apps/web/src/main.tsx.**
       Initialize Firebase (via `firebase.ts`), render App with providers (AuthContext, CallContext), mount to `#root` in index.html.
       Files: `apps/web/src/main.tsx`, `apps/web/index.html`
       Verify: `npm run dev` starts dev server, navigate to `http://localhost:5173`, confirm Splash page loads.

### Styling & Build Config

- [ ] 20. **Configure Tailwind CSS for /apps/web.**
       Create `tailwind.config.js`: configure for responsive design (mobile-first), dark mode optional, custom theme colors. Create `postcss.config.js` with Tailwind and Autoprefixer. Update `index.css` with Tailwind directives (@tailwind base, components, utilities).
       Files: `apps/web/tailwind.config.js`, `apps/web/postcss.config.js`, `apps/web/src/index.css`
       Verify: `npm run dev`, confirm styles apply (check browser inspector).

- [ ] 21. **Update Vite config to handle environment variables and API proxy in /apps/web/vite.config.ts.**
       Add env prefix `VITE_` for client-side env vars. Proxy `/api` requests to `http://localhost:3001/api` for local development. Ensure build output is `dist/`.
       Files: `apps/web/vite.config.ts`
       Verify: `npm run build`, confirm `dist/` created with production build artifacts, no errors.

### State Management & Call Flow Integration

- [ ] 22. **Integrate Socket.io call events with CallContext in /apps/web/src/context/CallContext.tsx (update from step 9).**
       Listen to `call:incoming`, `call:accepted`, `call:rejected`, `call:ended`, `webrtc:offer`, `webrtc:answer`, `webrtc:ice` events. Update call state, trigger WebRTC negotiation. On `call:accepted`, create offer and send `webrtc:offer`. On `webrtc:offer` (incoming), create answer and send `webrtc:answer`. Exchange ICE candidates.
       Files: `apps/web/src/context/CallContext.tsx` (enhancement)
       Verify: Full call cycle in two browser tabs: call initiated → offer/answer exchange → ICE gathering → audio flows → end call. Check browser console for socket events.

- [ ] 23. **Implement audio stream management in call components.**
       In `CallInProgressPage.tsx`: attach remote stream to audio element with `autoplay`. Handle stream end (remote user closes call or network fails). Implement Mute by stopping local audio track (`track.enabled = false`). Implement Speaker button (browser-dependent, may be UI-only on some browsers).
       Files: `apps/web/src/components/CallInProgressPage.tsx`
       Verify: During active call, toggle Mute button, confirm microphone LED toggles (if system shows it). End call, confirm audio element stops.

- [ ] 24. **Add connection quality indicator to in-call UI.**
       Use `RTCPeerConnection.getStats()` API (Chrome, Firefox, Safari 11+). Display signal strength indicator (bars) based on bandwidth (incoming-bitrate, outgoing-bitrate) and round-trip time (currentRoundTripTime). Update every 1 second during active call.
       Files: `apps/web/src/components/CallInProgressPage.tsx`
       Verify: During call, check stats display updates; simulate poor network, confirm indicator changes.

### Error Handling & Edge Cases

- [ ] 25. **Implement error boundaries and error handling throughout /apps/web.**
       Add React Error Boundary component in `App.tsx` to catch rendering errors. Firestore errors: display toast/alert with user-friendly message. Socket connection errors: show reconnecting state. WebRTC errors: display "Audio not available" if getUserMedia fails due to permission denial or no microphone.
       Files: `apps/web/src/components/ErrorBoundary.tsx`, updates to error handling in context and services.
       Verify: Trigger error scenarios (deny microphone permission, disconnect network), confirm UI shows appropriate error message.

- [ ] 26. **Handle offline and reconnection scenarios in /apps/web.**
       Socket.io `disconnect` event: set `callStatus` to "reconnecting", show UI indicator. On `connect`, emit auth again and resume call state if applicable. Firestore operations: catch network errors, show retry button.
       Files: `apps/web/src/services/socket.ts`, `apps/web/src/context/CallContext.tsx`
       Verify: Disconnect network, confirm reconnecting state shown; reconnect, confirm socket re-authenticates.

### Build & Verification

- [ ] 27. **Build and verify React web app production build.**
       Run `npm run build` in `/apps/web`. Confirm `dist/` created, no TypeScript or build errors. Check for missing dependencies or import errors.
       Files: `/apps/web/` (all source files)
       Verify: `cd apps/web && npm run build` exits with code 0, `ls -la dist/` shows index.html and assets.

---

## Phase 2: Infrastructure & Documentation (FEAT-005)

### TURN Server Configuration

- [ ] 28. **Create coturn configuration file at /infra/coturn/turnserver.conf.**
       Enable UDP listener on 3478, TCP listener on 3478, TLS listener on 5349 (use self-signed cert for local testing). Set realm from env (`TURN_REALM`, default: `example.com`). Set authentication secret from env (`TURN_SECRET`). Allocate relay port range (49152-65535). Enable fingerprinting (`fingerprint`). Disable file-based auth, use dynamic credentials. Set per-user bandwidth limit to 1 Mbps (`bps-capacity=1000000`). Disable built-in auth for time-limited token support.
       Files: `/infra/coturn/turnserver.conf`
       Verify: Syntax check: `turnserver -v -c /infra/coturn/turnserver.conf --dry-run` (if turnserver binary available) or visual inspection.

- [ ] 29. **Create coturn installation script at /infra/coturn/install-coturn.sh.**
       Bash script: `apt-get update && apt-get install -y coturn`, copy `turnserver.conf` to `/etc/coturn/`, set ownership to turnserver user, enable systemd service (`systemctl enable coturn`), open firewall ports using UFW (UDP 3478, TCP 3478, TCP 5349, UDP range 49152-65535 for relay).
       Files: `/infra/coturn/install-coturn.sh`
       Verify: Run on test Ubuntu/Debian VM: `bash install-coturn.sh`, confirm no errors, `systemctl status coturn` shows `active (running)`.

- [ ] 30. **Create coturn monitoring script at /infra/coturn/monitoring.sh.**
       Bash script: check `systemctl status coturn`, verify UDP/TCP port listeners (`netstat -ln | grep 3478`), log connection count, check disk space on relay temp directory. Output summary.
       Files: `/infra/coturn/monitoring.sh`
       Verify: `bash /infra/coturn/monitoring.sh`, confirm output shows status without errors.

### API Documentation

- [ ] 31. **Create comprehensive REST API documentation at /docs/API.md.**
       Document all endpoints:
       - **Authentication**: `POST /api/auth/verify` (Bearer token header, Firebase ID token required)
       - **Users**: `POST /api/users/username` (register username server-side after Firebase signup), `GET /api/users/search?username=<query>` (search by username, returns list of {uid, username, displayName})
       - **Contacts**: `GET /api/contacts` (list accepted contacts), `POST /api/contacts/request` (send contact request to username), `POST /api/contacts/respond` (accept/decline pending request), `POST /api/contacts/block` (block user by uid)
       - **Calls**: `GET /api/calls/history?limit=20&offset=0` (paginated call history)
       - **TURN**: `GET /api/turn-credentials` (return time-limited TURN credentials {username, password, ttl})
       Include: request/response JSON examples, error codes (400, 401, 404, 429 rate limit, 500), expected HTTP status.
       Files: `/docs/API.md`
       Verify: Manual check: grep each endpoint in `server/src/routes/*.js` and confirm it matches documentation.

- [ ] 32. **Create Socket.io event reference at /docs/SIGNALING.md.**
       Document all events:
       - **Client→Server**: `auth {idToken}`, `call:request {toUsername}`, `call:accept`, `call:reject`, `call:end`, `webrtc:offer {sdp}`, `webrtc:answer {sdp}`, `webrtc:ice {candidate}`
       - **Server→Client**: `auth:success`, `auth:error {reason}`, `call:incoming {fromUsername, fromUid}`, `call:accepted`, `call:rejected`, `call:ended`, `call:unavailable {reason}`, `webrtc:offer {sdp}`, `webrtc:answer {sdp}`, `webrtc:ice {candidate}`, `presence:update {uid, online}`
       Include: payload schemas, timing requirements (e.g., offer/answer must complete within 30s), error scenarios.
       Include: sequence flow diagram (ASCII or Mermaid) showing auth → call:request → call:incoming → call:accept → webrtc:offer/answer/ice → call:end.
       Files: `/docs/SIGNALING.md`
       Verify: Manual check: grep Socket.io event names in `server/src/services/signaling.js` and confirm documentation is complete.

- [ ] 33. **Create TURN server guide at /docs/TURN.md.**
       Explain: TURN purpose (NAT/firewall relay), credential generation (time-limited username/password), port allocation (ephemeral range), bandwidth limits. Include configuration options from `turnserver.conf`. Document stunclient testing (`stunclient -v <turn-host> 3478`). Provide credential generation formula (HMAC-based username, expiry timestamp). Include bandwidth monitoring via `bps-capacity` and connection limits.
       Files: `/docs/TURN.md`
       Verify: Manual review: confirm credential generation method matches server implementation.

- [ ] 34. **Create system architecture document at /docs/ARCHITECTURE.md.**
       Include:
       - Component diagram (text or Mermaid): Firebase (Auth + Firestore), Signaling Server (Node.js + Socket.io), TURN Server (coturn), Client Apps (Flutter + React Web)
       - Data flow: signup → username registration → login → socket auth → contacts search → call setup → offer/answer/ice exchange → media flow
       - Security model: Firebase token validation, contacts-only calling enforced server-side, DTLS-SRTP (implicit in WebRTC), rate limiting, CORS headers
       - Scaling considerations: Redis adapter for multi-instance signaling, regional TURN servers, database sharding for Firestore
       - Monitoring points: call success rate, call setup latency, TURN relay usage %, error rates
       Files: `/docs/ARCHITECTURE.md`
       Verify: Manual review: confirm architecture reflects FEAT-002, FEAT-003, FEAT-004 implementations.

### Deployment & Troubleshooting Docs

- [ ] 35. **Create deployment guide at /docs/DEPLOYMENT.md.**
       Step-by-step for deploying entire stack:
       1. **Signaling Server**: Clone repo, `cd server && npm install`, create `.env` from `.env.example` (add Firebase credentials, TURN credentials, NODE_ENV=production), run `npm start` or setup systemd service
       2. **coturn**: Run `bash /infra/coturn/install-coturn.sh` on Ubuntu/Debian VPS, verify status
       3. **Firebase**: Create Firebase project, enable Firestore, enable Authentication (Email/Password), enable Cloud Messaging (for FCM server key), download credentials
       4. **Web App**: `cd apps/web && npm install`, build `npm run build`, deploy `dist/` to Netlify / Vercel / S3 + CloudFront; set environment variables (VITE_FIREBASE_*, VITE_SIGNALING_SERVER_URL)
       5. **Mobile (Flutter)**: scaffold only for MVP, document `flutter build apk` command
       6. **Health checks**: curl `/health` endpoint, test socket connection, verify TURN reachability from client IP
       Include troubleshooting for common issues: Firestore permission denied (check rules), Socket auth fails (check token format), TURN not reachable (check firewall).
       Files: `/docs/DEPLOYMENT.md`
       Verify: Manual follow-through: confirm all steps are accurate and commands are exact.

- [ ] 36. **Create troubleshooting guide at /docs/TROUBLESHOOTING.md.**
       Common issues:
       - "Call fails to connect": check TURN server reachable, verify firewall rules, test with stunclient
       - "Audio not working": check microphone permissions (grant in browser), check media track initialized (check logs), check codec compatibility
       - "Incoming calls not received": check Socket.io connection active, check FCM/APNs setup (scaffold only for MVP), check network connectivity
       - "Server crashes": check Node.js memory (increase if needed), check rate limiting not blocking, check for stuck sockets (old connections not cleaned)
       - "High bandwidth usage": monitor per-user limits via TURN stats, check for relay overuse (P2P should be preferred)
       Include log locations, diagnostic commands, resolution steps.
       Files: `/docs/TROUBLESHOOTING.md`
       Verify: Manual review: confirm guidance is practical and matches architecture.

- [ ] 37. **Create security guide at /docs/SECURITY.md.**
       Cover:
       - **Authentication**: Firebase ID token validation, token expiry (1 hour default), refresh flow
       - **Authorization**: Contacts-only calling enforced in signaling service, only accepted contacts can initiate calls, server-side permission checks
       - **Transport**: HTTPS/WSS for signaling, DTLS-SRTP for media (implicit in WebRTC), TLS for TURN (optional but recommended)
       - **Data Privacy**: Email stored in Firestore but not exposed in API responses (use UID), minimal PII collected, user can delete account (out of scope for MVP)
       - **Abuse Prevention**: Rate limiting on API endpoints (100/15min per IP), rate limiting on socket events (10 calls/min per user), contact request throttling, block list enforcement
       - **Headers**: Recommended CORS policy (only allow app origins), CSP (Content Security Policy), HSTS (strict transport security)
       Files: `/docs/SECURITY.md`
       Verify: Manual review: confirm recommendations are aligned with server implementation (rate limiting, CORS).

### Main Documentation

- [ ] 38. **Create main README at /docs/README.md (or update root README.md).**
       Quick start guide: clone repo, install dependencies (`npm install --workspaces`), Firebase setup (create project, enable services, get credentials), run server (`cd server && npm start`), run web app (`cd apps/web && npm run dev`), open http://localhost:5173. Include command to test two-browser call (open app in two tabs, create test accounts, call each other). Link to detailed docs (DEPLOYMENT.md, API.md, ARCHITECTURE.md).
       Files: `/docs/README.md`
       Verify: Manual follow-through: confirm all commands work as written.

### Environment Variables

- [ ] 39. **Update /root/.env.example with web client environment variables.**
       Add: 
       - `VITE_FIREBASE_API_KEY=...`
       - `VITE_FIREBASE_AUTH_DOMAIN=...`
       - `VITE_FIREBASE_PROJECT_ID=...`
       - `VITE_FIREBASE_APP_ID=...`
       - `VITE_SIGNALING_SERVER_URL=http://localhost:3001`
       Ensure instructions note that these are client-side and will be visible in browser (only put public Firebase config, not API keys or secrets).
       Files: `/.env.example`
       Verify: Diff `.env.example` against server `.env` to confirm consistency in shared vars (FIREBASE_PROJECT_ID, TURN_REALM, etc.).

---

## Phase 3: Integration & Verification

- [ ] 40. **Run full integration test: end-to-end call flow from web app.**
       1. Start signaling server: `cd server && npm start` (port 3001)
       2. Start web dev server: `cd apps/web && npm run dev` (port 5173)
       3. Open `http://localhost:5173` in two browser windows (different users or incognito tabs)
       4. Sign up first user (email1@test.com, username: alice)
       5. Sign up second user (email2@test.com, username: bob)
       6. From alice tab: search for bob, send contact request
       7. From bob tab: accept alice's request
       8. From alice tab: call bob
       9. From bob tab: accept incoming call
       10. Verify audio negotiation completes, both users see in-call UI
       11. End call, verify both return to contacts screen
       12. Check call history on both sides
       Files: Integration test documented in step output
       Verify: All 12 steps complete without errors; browser console shows socket events and no JS errors; audio negotiation logs appear.

---

## Summary

This plan sequences FEAT-004 (React web app, 27 steps) and FEAT-005 (infrastructure & docs, 12 steps), totaling **40 actionable items**. Each item is independently verifiable and leaves the codebase in a buildable state. The plan is ordered by dependency: services before pages, context before routing, build config before dev server, API docs before deployment guide.

**Key Integration Points:**
- Web app consumes signaling server's Socket.io events (FEAT-002)
- Web app uses Firebase Auth/Firestore (requires FEAT-001 server setup)
- Infrastructure docs reflect actual server, client, and TURN implementations
- All environment variables must be consistent across server, web, and mobile

**Recommended Execution:**
1. Developers build FEAT-004 (React web) in parallel with existing FEAT-002, FEAT-003 (server, Flutter)
2. FEAT-005 (infrastructure & docs) can start once server routes and Socket.io handlers are finalized
3. Integration testing (Phase 3) happens after both FEAT-004 and server are ready
4. Review loop verifies functionality, corrects any discrepancies in docs

