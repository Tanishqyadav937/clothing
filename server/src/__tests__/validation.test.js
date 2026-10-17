import {
  usernameSchema,
  callRequestSchema,
  offerSchema,
  answerSchema,
  iceSchema,
} from '../validation.js';

describe('Validation Schemas', () => {
  describe('usernameSchema', () => {
    it('should accept valid usernames', () => {
      expect(usernameSchema.parse('john_doe')).toBe('john_doe');
      expect(usernameSchema.parse('alice123')).toBe('alice123');
      expect(usernameSchema.parse('bob_2023')).toBe('bob_2023');
    });

    it('should reject short usernames', () => {
      expect(() => usernameSchema.parse('ab')).toThrow();
    });

    it('should reject long usernames', () => {
      expect(() => usernameSchema.parse('a'.repeat(21))).toThrow();
    });

    it('should reject uppercase letters', () => {
      expect(() => usernameSchema.parse('John_Doe')).toThrow();
    });

    it('should reject special characters', () => {
      expect(() => usernameSchema.parse('john-doe')).toThrow();
      expect(() => usernameSchema.parse('john.doe')).toThrow();
    });
  });

  describe('callRequestSchema', () => {
    it('should accept valid call requests', () => {
      const valid = {
        callId: '550e8400-e29b-41d4-a716-446655440000',
        toUsername: 'bob',
      };
      expect(callRequestSchema.parse(valid)).toEqual(valid);
    });

    it('should reject invalid UUID', () => {
      expect(() =>
        callRequestSchema.parse({
          callId: 'not-a-uuid',
          toUsername: 'bob',
        })
      ).toThrow();
    });

    it('should reject missing toUsername', () => {
      expect(() =>
        callRequestSchema.parse({
          callId: '550e8400-e29b-41d4-a716-446655440000',
        })
      ).toThrow();
    });
  });

  describe('offerSchema', () => {
    it('should accept valid offers', () => {
      const valid = {
        callId: '550e8400-e29b-41d4-a716-446655440000',
        offer: {
          type: 'offer',
          sdp: 'v=0\r\no=- ...',
        },
      };
      expect(offerSchema.parse(valid)).toEqual(valid);
    });

    it('should reject wrong type', () => {
      expect(() =>
        offerSchema.parse({
          callId: '550e8400-e29b-41d4-a716-446655440000',
          offer: {
            type: 'answer',
            sdp: 'v=0\r\no=- ...',
          },
        })
      ).toThrow();
    });
  });

  describe('answerSchema', () => {
    it('should accept valid answers', () => {
      const valid = {
        callId: '550e8400-e29b-41d4-a716-446655440000',
        answer: {
          type: 'answer',
          sdp: 'v=0\r\no=- ...',
        },
      };
      expect(answerSchema.parse(valid)).toEqual(valid);
    });

    it('should reject wrong type', () => {
      expect(() =>
        answerSchema.parse({
          callId: '550e8400-e29b-41d4-a716-446655440000',
          answer: {
            type: 'offer',
            sdp: 'v=0\r\no=- ...',
          },
        })
      ).toThrow();
    });
  });

  describe('iceSchema', () => {
    it('should accept valid ICE candidates', () => {
      const valid = {
        callId: '550e8400-e29b-41d4-a716-446655440000',
        candidate: {
          candidate: 'candidate:123 1 udp 123456789 ...',
          sdpMLineIndex: 0,
          sdpMid: 'audio',
        },
      };
      expect(iceSchema.parse(valid)).toEqual(valid);
    });

    it('should accept optional sdpMid', () => {
      const valid = {
        callId: '550e8400-e29b-41d4-a716-446655440000',
        candidate: {
          candidate: 'candidate:123 1 udp 123456789 ...',
          sdpMLineIndex: 0,
        },
      };
      expect(iceSchema.parse(valid)).toEqual(valid);
    });
  });
});
