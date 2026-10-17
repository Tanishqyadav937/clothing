/**
 * Type definitions for CallMe WebRTC app
 */

export interface User {
  uid: string;
  username: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt?: number;
}

export interface Contact {
  uid: string;
  username: string;
  displayName: string;
  status: 'pending' | 'accepted' | 'blocked';
  isOnline: boolean;
}

export interface Call {
  callId: string;
  fromUid: string;
  toUid: string;
  fromUsername: string;
  toUsername: string;
  status: 'calling' | 'ringing' | 'answered' | 'completed' | 'rejected' | 'missed';
  startedAt?: number;
  answeredAt?: number;
  endedAt?: number;
  duration?: number;
}

export type CallStatus = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';

export interface ActiveCall {
  callId: string;
  contactUsername: string;
  contactDisplayName: string;
  status: CallStatus;
  isIncoming: boolean;
  startTime?: number;
}
