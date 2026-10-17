import { verifyToken } from '../middleware/auth.js';
import * as firebase from './firebase.js';
import { issueTurnCredentials } from './turn.js';
import {
  callRequestSchema,
  offerSchema,
  answerSchema,
  iceSchema,
} from '../validation.js';

// In-memory user presence map: Map<uid, { socket, username }>
const userPresence = new Map();

// Rate limiter: Map<uid:toUid, [timestamps]>
const callRateLimiter = new Map();

/**
 * Check rate limit for call requests (5 calls to same user in 60 seconds)
 * @returns {boolean} - true if allowed, false if rate limited
 */
function checkCallRateLimit(fromUid, toUid) {
  const key = `${fromUid}:${toUid}`;
  const now = Date.now();
  const windowMs = 60000; // 60 seconds
  const maxCalls = 5;

  if (!callRateLimiter.has(key)) {
    callRateLimiter.set(key, [now]);
    return true;
  }

  const timestamps = callRateLimiter.get(key);
  const recentTimestamps = timestamps.filter(t => now - t < windowMs);

  if (recentTimestamps.length >= maxCalls) {
    return false;
  }

  recentTimestamps.push(now);
  callRateLimiter.set(key, recentTimestamps);
  return true;
}

/**
 * Register Socket.io event handlers
 */
export function registerSignalingHandlers(io) {
  io.on('connection', async socket => {
    console.log(`[Socket] New connection: ${socket.id}`);

    let currentUid = null;

    // ===== Auth Event =====
    socket.on('auth', async data => {
      try {
        const { token } = data;
        currentUid = await verifyToken(token);

        // Get user info and store presence
        const user = await firebase.getUser(currentUid);
        userPresence.set(currentUid, { socket, username: user?.username });

        socket.emit('auth:success', { uid: currentUid, username: user?.username });
        console.log(`[Auth] User authenticated: ${currentUid}`);

        // Notify other clients that this user is online
        socket.broadcast.emit('presence:update', {
          uid: currentUid,
          username: user?.username,
          status: 'online',
        });
      } catch (error) {
        socket.emit('auth:error', { message: error.message });
        console.error(`[Auth] Error: ${error.message}`);
      }
    });

    // ===== Call Request Event =====
    socket.on('call:request', async data => {
      try {
        if (!currentUid) {
          return socket.emit('auth:error', { message: 'Not authenticated' });
        }

        const validatedData = callRequestSchema.parse(data);
        const { callId, toUsername } = validatedData;

        // Find target user
        const targetUser = await firebase.getUserByUsername(toUsername);
        if (!targetUser) {
          return socket.emit('call:unavailable', {
            callId,
            reason: 'User not found',
          });
        }

        const toUid = targetUser.uid;

        // Check rate limit
        if (!checkCallRateLimit(currentUid, toUid)) {
          return socket.emit('call:error', {
            callId,
            message: 'Rate limit exceeded: too many calls to this user',
          });
        }

        // Check if target user is online
        const targetPresence = userPresence.get(toUid);
        if (!targetPresence) {
          return socket.emit('call:unavailable', {
            callId,
            reason: 'User is offline',
          });
        }

        // Create call record in Firestore
        await firebase.createCall(callId, currentUid, toUid);

        // Get caller info
        const callerUser = await firebase.getUser(currentUid);

        // Emit call:incoming to callee
        targetPresence.socket.emit('call:incoming', {
          callId,
          fromUid: currentUid,
          fromUsername: callerUser?.username,
          fromDisplayName: callerUser?.displayName,
        });

        socket.emit('call:request:sent', { callId, toUid });
        console.log(
          `[Call] Request from ${currentUid} to ${toUid}: ${callId}`
        );
      } catch (error) {
        socket.emit('call:error', { message: error.message });
        console.error(`[Call Request] Error: ${error.message}`);
      }
    });

    // ===== Call Accept Event =====
    socket.on('call:accept', async data => {
      try {
        if (!currentUid) {
          return socket.emit('auth:error', { message: 'Not authenticated' });
        }

        const { callId } = data;

        // Update call status
        await firebase.updateCall(callId, {
          answeredAt: new Date(),
          status: 'answered',
        });

        // Find caller in user presence
        // Note: In a real app, we'd query Firestore to find caller's socket
        // For now, we'll use a broadcast approach
        socket.broadcast.emit('call:accepted', { callId, acceptedByUid: currentUid });

        console.log(`[Call] Accepted: ${callId}`);
      } catch (error) {
        socket.emit('call:error', { message: error.message });
        console.error(`[Call Accept] Error: ${error.message}`);
      }
    });

    // ===== Call Reject Event =====
    socket.on('call:reject', async data => {
      try {
        if (!currentUid) {
          return socket.emit('auth:error', { message: 'Not authenticated' });
        }

        const { callId } = data;

        // Update call status
        await firebase.updateCall(callId, {
          endedAt: new Date(),
          status: 'rejected',
        });

        socket.broadcast.emit('call:rejected', { callId, rejectedByUid: currentUid });

        console.log(`[Call] Rejected: ${callId}`);
      } catch (error) {
        socket.emit('call:error', { message: error.message });
        console.error(`[Call Reject] Error: ${error.message}`);
      }
    });

    // ===== Call End Event =====
    socket.on('call:end', async data => {
      try {
        if (!currentUid) {
          return socket.emit('auth:error', { message: 'Not authenticated' });
        }

        const { callId } = data;

        // Update call status
        await firebase.updateCall(callId, {
          endedAt: new Date(),
          status: 'completed',
        });

        socket.broadcast.emit('call:ended', { callId });

        console.log(`[Call] Ended: ${callId}`);
      } catch (error) {
        socket.emit('call:error', { message: error.message });
        console.error(`[Call End] Error: ${error.message}`);
      }
    });

    // ===== WebRTC Offer Event =====
    socket.on('webrtc:offer', async data => {
      try {
        if (!currentUid) {
          return socket.emit('auth:error', { message: 'Not authenticated' });
        }

        const validatedData = offerSchema.parse(data);
        const { callId, offer } = validatedData;

        // Relay offer to all connected clients (will be filtered by callId on client)
        socket.broadcast.emit('webrtc:offer', {
          callId,
          offer,
          fromUid: currentUid,
        });

        console.log(`[WebRTC] Offer sent for call: ${callId}`);
      } catch (error) {
        socket.emit('webrtc:error', { message: error.message });
        console.error(`[WebRTC Offer] Error: ${error.message}`);
      }
    });

    // ===== WebRTC Answer Event =====
    socket.on('webrtc:answer', async data => {
      try {
        if (!currentUid) {
          return socket.emit('auth:error', { message: 'Not authenticated' });
        }

        const validatedData = answerSchema.parse(data);
        const { callId, answer } = validatedData;

        // Relay answer to all connected clients (will be filtered by callId on client)
        socket.broadcast.emit('webrtc:answer', {
          callId,
          answer,
          fromUid: currentUid,
        });

        console.log(`[WebRTC] Answer sent for call: ${callId}`);
      } catch (error) {
        socket.emit('webrtc:error', { message: error.message });
        console.error(`[WebRTC Answer] Error: ${error.message}`);
      }
    });

    // ===== WebRTC ICE Candidate Event =====
    socket.on('webrtc:ice', async data => {
      try {
        if (!currentUid) {
          return socket.emit('auth:error', { message: 'Not authenticated' });
        }

        const validatedData = iceSchema.parse(data);
        const { callId, candidate } = validatedData;

        // Relay ICE candidate to all connected clients
        socket.broadcast.emit('webrtc:ice', {
          callId,
          candidate,
          fromUid: currentUid,
        });

        console.log(`[WebRTC] ICE candidate sent for call: ${callId}`);
      } catch (error) {
        socket.emit('webrtc:error', { message: error.message });
        console.error(`[WebRTC ICE] Error: ${error.message}`);
      }
    });

    // ===== Disconnect Event =====
    socket.on('disconnect', () => {
      if (currentUid) {
        userPresence.delete(currentUid);
        socket.broadcast.emit('presence:update', {
          uid: currentUid,
          status: 'offline',
        });
        console.log(`[Disconnect] User offline: ${currentUid}`);
      }
    });
  });
}

/**
 * Get user presence (used for testing and debugging)
 */
export function getUserPresence(uid) {
  return userPresence.get(uid);
}

/**
 * Get all online users (used for testing)
 */
export function getOnlineUsers() {
  return Array.from(userPresence.entries()).map(([uid, data]) => ({
    uid,
    username: data.username,
  }));
}
