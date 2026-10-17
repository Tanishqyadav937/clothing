import { issueTurnCredentials } from '../services/turn.js';

describe('TURN Credentials', () => {
  beforeEach(() => {
    process.env.TURN_REALM = 'test.example.com';
    process.env.TURN_SECRET = 'test-secret';
    process.env.TURN_HOST = 'turn.test.example.com';
  });

  describe('issueTurnCredentials', () => {
    it('should return credentials with correct structure', () => {
      const uid = 'user-123';
      const callId = 'call-456';

      const credentials = issueTurnCredentials(uid, callId);

      expect(credentials).toHaveProperty('username');
      expect(credentials).toHaveProperty('credential');
      expect(credentials).toHaveProperty('iceServers');
    });

    it('should generate username with timestamp and uid', () => {
      const uid = 'user-123';
      const credentials = issueTurnCredentials(uid, 'call-456');

      const [timestamp, extractedUid] = credentials.username.split(':');

      expect(extractedUid).toBe(uid);
      expect(Number(timestamp)).toBeGreaterThan(0);
    });

    it('should include multiple TURN server URLs', () => {
      const credentials = issueTurnCredentials('user-123', 'call-456');

      expect(credentials.iceServers).toHaveLength(1);
      expect(credentials.iceServers[0].urls).toContain(
        'turn:turn.test.example.com:3478?transport=udp'
      );
      expect(credentials.iceServers[0].urls).toContain(
        'turn:turn.test.example.com:3478?transport=tcp'
      );
      expect(credentials.iceServers[0].urls).toContain(
        'turns:turn.test.example.com:5349?transport=tcp'
      );
    });

    it('should include username and credential in iceServers', () => {
      const credentials = issueTurnCredentials('user-123', 'call-456');

      expect(credentials.iceServers[0].username).toBe(credentials.username);
      expect(credentials.iceServers[0].credential).toBe(credentials.credential);
    });

    it('should generate different credentials for different uids', () => {
      const creds1 = issueTurnCredentials('user-1', 'call-456');
      const creds2 = issueTurnCredentials('user-2', 'call-456');

      expect(creds1.username).not.toBe(creds2.username);
      expect(creds1.credential).not.toBe(creds2.credential);
    });
  });
});
