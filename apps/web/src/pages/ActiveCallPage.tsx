/**
 * Active call page (in-call screen)
 */

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPhoneOff, FiMicOff, FiMic, FiVolume2, FiVolume } from 'react-icons/fi';
import { useCallStore } from '../store/callStore';
import { createWebRTCService, WebRTCService } from '../services/webrtc';
import { socketService } from '../services/socket';

export const ActiveCallPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeCall, clearActiveCall } = useCallStore();
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [callTimer, setCallTimer] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [connectionState, setConnectionState] = useState('connecting');
  const [bitrate, setBitrate] = useState(0);
  const webrtcRef = useRef<WebRTCService | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!activeCall) {
      navigate('/contacts', { replace: true });
      return;
    }

    let webrtc: WebRTCService;

    const initializeWebRTC = async () => {
      try {
        webrtc = createWebRTCService();
        webrtcRef.current = webrtc;

        // Get user media
        await webrtc.getUserMedia();

        // Handle remote stream
        webrtc.onRemoteStream((stream) => {
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = stream;
          }
        });

        // Handle ICE candidates
        webrtc.onIceCandidate((candidate) => {
          if (activeCall) {
            socketService.emitIceCandidate(activeCall.callId, candidate);
          }
        });

        // Listen for WebRTC events
        const handleOffer = async (data: any) => {
          if (activeCall && data.callId === activeCall.callId) {
            try {
              const answer = await webrtc.createAnswer(data.sdp);
              socketService.emitAnswer(activeCall.callId, answer);
              setConnectionState('connected');
            } catch (err) {
              console.error('Error creating answer:', err);
            }
          }
        };

        const handleAnswer = async (data: any) => {
          if (activeCall && data.callId === activeCall.callId) {
            try {
              await webrtc.setRemoteDescription(data.sdp);
              setConnectionState('connected');
            } catch (err) {
              console.error('Error setting remote description:', err);
            }
          }
        };

        const handleIce = async (data: any) => {
          if (activeCall && data.callId === activeCall.callId && data.candidate) {
            try {
              await webrtc.addIceCandidate(data.candidate);
            } catch (err) {
              console.warn('Error adding ICE candidate:', err);
            }
          }
        };

        socketService.onEvent('webrtc:offer', handleOffer);
        socketService.onEvent('webrtc:answer', handleAnswer);
        socketService.onEvent('webrtc:ice', handleIce);

        // If this is the caller, create and send offer
        if (!activeCall.isIncoming) {
          const offer = await webrtc.createOffer();
          socketService.emitOffer(activeCall.callId, offer);
        }

        // Start timer
        timerIntervalRef.current = setInterval(() => {
          setCallTimer((prev) => prev + 1);
        }, 1000);

        // Start stats monitoring
        statsIntervalRef.current = setInterval(async () => {
          try {
            const stats = await webrtc.getStats();
            let outgoingBitrate = 0;

            stats.forEach((report) => {
              if (report.type === 'inbound-rtp' && report.kind === 'audio') {
                const bytesReceived = report.bytesReceived;
                outgoingBitrate = Math.round(bytesReceived / (callTimer + 1));
              }
            });

            setBitrate(outgoingBitrate);
          } catch (err) {
            console.warn('Error getting stats:', err);
          }
        }, 2000);

        return () => {
          socketService.offEvent('webrtc:offer', handleOffer);
          socketService.offEvent('webrtc:answer', handleAnswer);
          socketService.offEvent('webrtc:ice', handleIce);
        };
      } catch (err) {
        console.error('WebRTC initialization error:', err);
        handleEndCall();
      }
    };

    initializeWebRTC();

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
      if (webrtcRef.current) webrtcRef.current.close();
    };
  }, [activeCall, navigate]);

  const handleMuteToggle = () => {
    if (webrtcRef.current) {
      // Stop audio track would go here
      setIsMuted(!isMuted);
    }
  };

  const handleSpeakerToggle = () => {
    setIsSpeakerOn(!isSpeakerOn);
  };

  const handleEndCall = () => {
    if (activeCall) {
      socketService.emitCallEnd(activeCall.callId);
    }
    if (webrtcRef.current) {
      webrtcRef.current.close();
    }
    clearActiveCall();
    navigate('/contacts');
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getSignalStrength = () => {
    if (bitrate > 500000) return 'excellent';
    if (bitrate > 250000) return 'good';
    if (bitrate > 100000) return 'fair';
    return 'poor';
  };

  if (!activeCall) {
    return null;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      <audio ref={remoteAudioRef} autoPlay playsInline />

      <div className="text-center">
        <div className="w-24 h-24 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-4xl mb-6 mx-auto">
          {activeCall.contactDisplayName.charAt(0).toUpperCase()}
        </div>

        <h2 className="text-3xl font-bold text-white mb-2">{activeCall.contactDisplayName}</h2>
        <p className="text-gray-400 text-lg mb-6">@{activeCall.contactUsername}</p>

        {/* Connection Status & Timer */}
        <div className="mb-8">
          <p className="text-gray-400 text-sm mb-2">
            {connectionState === 'connecting' && 'Connecting...'}
            {connectionState === 'connected' && 'Connected'}
            {connectionState === 'reconnecting' && 'Reconnecting...'}
          </p>
          <p className="text-white text-2xl font-mono font-bold">{formatTime(callTimer)}</p>
        </div>

        {/* Signal Strength */}
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="text-xs text-gray-400">Signal:</div>
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((bar) => (
              <div
                key={bar}
                className={`w-1 h-4 rounded ${
                  getSignalStrength() === 'excellent' || bar <= 4
                    ? 'bg-green-500'
                    : getSignalStrength() === 'good' || bar <= 3
                    ? 'bg-yellow-500'
                    : getSignalStrength() === 'fair' || bar <= 2
                    ? 'bg-orange-500'
                    : 'bg-red-500'
                }`}
              ></div>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-8">
          <button
            onClick={handleMuteToggle}
            className={`inline-flex items-center justify-center w-14 h-14 rounded-full transition ${
              isMuted
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <FiMicOff className="w-6 h-6" /> : <FiMic className="w-6 h-6" />}
          </button>

          <button
            onClick={handleSpeakerToggle}
            className={`inline-flex items-center justify-center w-14 h-14 rounded-full transition ${
              isSpeakerOn
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
            title={isSpeakerOn ? 'Speaker On' : 'Speaker Off'}
          >
            {isSpeakerOn ? <FiVolume2 className="w-6 h-6" /> : <FiVolume className="w-6 h-6" />}
          </button>

          <button
            onClick={handleEndCall}
            className="inline-flex items-center justify-center w-16 h-16 bg-red-600 hover:bg-red-700 text-white rounded-full transition"
            title="End call"
          >
            <FiPhoneOff className="w-8 h-8" />
          </button>
        </div>
      </div>
    </div>
  );
};
