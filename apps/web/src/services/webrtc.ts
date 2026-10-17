/**
 * WebRTC peer connection wrapper
 */

export interface WebRTCConfig {
  iceServers: RTCIceServer[];
}

export class WebRTCService {
  private peerConnection: RTCPeerConnection;
  private localStream: MediaStream | null = null;
  private remoteStreamCallback: ((stream: MediaStream) => void) | null = null;
  private iceCandidateCallback: ((candidate: RTCIceCandidateInit | null) => void) | null = null;

  constructor(config?: WebRTCConfig) {
    const iceServers = config?.iceServers || [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];

    this.peerConnection = new RTCPeerConnection({
      iceServers,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.iceCandidateCallback?.(event.candidate);
      }
    };

    this.peerConnection.ontrack = (event) => {
      console.log('[WebRTC] Remote stream received');
      if (event.streams && event.streams.length > 0) {
        this.remoteStreamCallback?.(event.streams[0]);
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', this.peerConnection.connectionState);
    };

    this.peerConnection.onicegatheringstatechange = () => {
      console.log('[WebRTC] ICE gathering state:', this.peerConnection.iceGatheringState);
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE connection state:', this.peerConnection.iceConnectionState);
    };
  }

  async getUserMedia(constraints: MediaStreamConstraints = { audio: true }): Promise<MediaStream> {
    this.localStream = await navigator.mediaDevices.getUserMedia(constraints);

    // Add local stream tracks to peer connection
    this.localStream.getTracks().forEach((track) => {
      if (this.localStream) {
        this.peerConnection.addTrack(track, this.localStream);
      }
    });

    return this.localStream;
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false,
    });
    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }

  async createAnswer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    return answer;
  }

  async setRemoteDescription(answer: RTCSessionDescriptionInit): Promise<void> {
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (candidate) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.warn('[WebRTC] Failed to add ICE candidate:', error);
      }
    }
  }

  onRemoteStream(callback: (stream: MediaStream) => void): void {
    this.remoteStreamCallback = callback;
  }

  onIceCandidate(callback: (candidate: RTCIceCandidateInit | null) => void): void {
    this.iceCandidateCallback = callback;
  }

  async getStats(): Promise<RTCStatsReport> {
    return this.peerConnection.getStats();
  }

  getConnectionState(): RTCPeerConnectionState {
    return this.peerConnection.connectionState;
  }

  close(): void {
    // Stop all local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    // Close peer connection
    this.peerConnection.close();
  }
}

/**
 * Create a new WebRTC service instance
 */
export function createWebRTCService(config?: WebRTCConfig): WebRTCService {
  return new WebRTCService(config);
}
