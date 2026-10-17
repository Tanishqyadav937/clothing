/**
 * Outgoing call page
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPhoneOff } from 'react-icons/fi';
import { useCallStore } from '../store/callStore';
import { socketService } from '../services/socket';

export const OutgoingCallPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeCall, clearActiveCall } = useCallStore();
  const [callTimer, setCallTimer] = useState(0);

  useEffect(() => {
    if (!activeCall) {
      navigate('/contacts', { replace: true });
      return;
    }

    // Listen for call acceptance
    const handleCallAccepted = () => {
      navigate('/call/active');
    };

    const handleCallRejected = () => {
      clearActiveCall();
      navigate('/contacts');
    };

    socketService.onEvent('call:accepted', handleCallAccepted);
    socketService.onEvent('call:rejected', handleCallRejected);

    // Timer
    const interval = setInterval(() => {
      setCallTimer((prev) => prev + 1);
    }, 1000);

    return () => {
      socketService.offEvent('call:accepted', handleCallAccepted);
      socketService.offEvent('call:rejected', handleCallRejected);
      clearInterval(interval);
    };
  }, [activeCall, navigate, clearActiveCall]);

  const handleEndCall = () => {
    if (activeCall) {
      socketService.emitCallEnd(activeCall.callId);
    }
    clearActiveCall();
    navigate('/contacts');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!activeCall) {
    return null;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="text-center">
        <div className="w-24 h-24 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-4xl mb-6 mx-auto">
          {activeCall.contactDisplayName.charAt(0).toUpperCase()}
        </div>
        <h2 className="text-3xl font-bold text-white mb-2">{activeCall.contactDisplayName}</h2>
        <p className="text-gray-400 text-lg mb-6">@{activeCall.contactUsername}</p>
        <p className="text-green-400 text-sm mb-8 animate-pulse">Calling...</p>
        <div className="text-gray-400 text-sm mb-8">{formatTime(callTimer)}</div>

        <button
          onClick={handleEndCall}
          className="inline-flex items-center justify-center w-16 h-16 bg-red-600 hover:bg-red-700 text-white rounded-full transition"
        >
          <FiPhoneOff className="w-8 h-8" />
        </button>
      </div>
    </div>
  );
};
