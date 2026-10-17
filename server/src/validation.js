import { z } from 'zod';

// Username: 3-20 chars, lowercase alphanumeric + underscore
export const usernameSchema = z.string()
  .min(3, 'Username must be at least 3 characters')
  .max(20, 'Username must be at most 20 characters')
  .regex(/^[a-z0-9_]+$/, 'Username must be lowercase letters, numbers, and underscores');

// Call request payload
export const callRequestSchema = z.object({
  callId: z.string().uuid('callId must be a valid UUID'),
  toUsername: z.string().min(1, 'toUsername is required'),
});

// WebRTC offer
export const offerSchema = z.object({
  callId: z.string().uuid('callId must be a valid UUID'),
  offer: z.object({
    type: z.literal('offer'),
    sdp: z.string(),
  }),
});

// WebRTC answer
export const answerSchema = z.object({
  callId: z.string().uuid('callId must be a valid UUID'),
  answer: z.object({
    type: z.literal('answer'),
    sdp: z.string(),
  }),
});

// ICE candidate
export const iceSchema = z.object({
  callId: z.string().uuid('callId must be a valid UUID'),
  candidate: z.object({
    candidate: z.string(),
    sdpMLineIndex: z.number().int(),
    sdpMid: z.string().optional(),
  }),
});

// Set username request
export const setUsernameSchema = z.object({
  username: usernameSchema,
});

// Contact request/response
export const contactActionSchema = z.object({
  username: usernameSchema,
});

export const contactResponseSchema = z.object({
  username: usernameSchema,
  action: z.enum(['accept', 'decline']),
});
