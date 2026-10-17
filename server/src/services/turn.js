import crypto from 'crypto';

/**
 * Issue time-limited TURN credentials valid for 1 hour
 * @param {string} uid - Firebase UID
 * @param {string} callId - Call ID
 * @returns {object} - { username, credential, iceServers }
 */
export function issueTurnCredentials(uid, callId) {
  const turnRealm = process.env.TURN_REALM || 'example.com';
  const turnSecret = process.env.TURN_SECRET || 'secret';
  const turnHost = process.env.TURN_HOST || 'turn.example.com';

  // TURN username: timestamp:uid (expires in 1 hour)
  const expiryTimestamp = Math.floor(Date.now() / 1000) + 3600; // 1 hour
  const username = `${expiryTimestamp}:${uid}`;

  // TURN credential: HMAC-SHA1(turnSecret, username)
  const credential = crypto
    .createHmac('sha1', turnSecret)
    .update(username)
    .digest('base64');

  return {
    username,
    credential,
    iceServers: [
      {
        urls: [
          `turn:${turnHost}:3478?transport=udp`,
          `turn:${turnHost}:3478?transport=tcp`,
          `turns:${turnHost}:5349?transport=tcp`,
        ],
        username,
        credential,
      },
    ],
  };
}
