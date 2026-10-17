/**
 * Socket.io client wrapper for signaling
 */

import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const serverUrl = import.meta.env.VITE_SIGNALING_SERVER_URL || 'http://localhost:3001';

      this.socket = io(serverUrl, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: this.maxReconnectAttempts,
        auth: {
          token,
        },
      });

      this.socket.on('connect', () => {
        console.log('[Socket] Connected');
        this.reconnectAttempts = 0;
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('[Socket] Connection error:', error);
        if (this.reconnectAttempts === 0) {
          reject(error);
        }
        this.reconnectAttempts++;
      });

      this.socket.on('disconnect', (reason) => {
        console.log('[Socket] Disconnected:', reason);
      });
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  onEvent(event: string, handler: (...args: any[]) => void): void {
    if (this.socket) {
      this.socket.on(event, handler);
    }
  }

  offEvent(event: string, handler?: (...args: any[]) => void): void {
    if (this.socket) {
      this.socket.off(event, handler);
    }
  }

  emitCallRequest(callId: string, toUsername: string): void {
    if (this.socket) {
      this.socket.emit('call:request', { callId, toUsername });
    }
  }

  emitCallAccept(callId: string): void {
    if (this.socket) {
      this.socket.emit('call:accept', { callId });
    }
  }

  emitCallReject(callId: string): void {
    if (this.socket) {
      this.socket.emit('call:reject', { callId });
    }
  }

  emitCallEnd(callId: string): void {
    if (this.socket) {
      this.socket.emit('call:end', { callId });
    }
  }

  emitOffer(callId: string, offer: RTCSessionDescriptionInit): void {
    if (this.socket) {
      this.socket.emit('webrtc:offer', { callId, sdp: offer });
    }
  }

  emitAnswer(callId: string, answer: RTCSessionDescriptionInit): void {
    if (this.socket) {
      this.socket.emit('webrtc:answer', { callId, sdp: answer });
    }
  }

  emitIceCandidate(callId: string, candidate: RTCIceCandidateInit | null): void {
    if (this.socket) {
      this.socket.emit('webrtc:ice', { callId, candidate });
    }
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const socketService = new SocketService();
