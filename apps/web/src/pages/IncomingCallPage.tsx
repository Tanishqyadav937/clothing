/**
 * Incoming call overlay page
 */

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPhone, FiPhoneOff } from 'react-icons/fi';
import { useCallStore } from '../store/callStore';
import { socketService } from '../services/socket';

export const IncomingCallPage: React.FC = () => {
  const navigate = useNavigate();
  const { incomingCall, clearIncomingCall, setActiveCall } = useCallStore();

  useEffect(() => {
    if (!incomingCall) {
      navigate(-1);
    }
  }, [incomingCall, navigate]);

  const handleAccept = () => {
    if (incomingCall) {
      socketService.emitCallAccept(incomingCall.callId);
      setActiveCall({
        ...incomingCall,
        status: 'connected',
        startTime: Date.now(),
      });
      navigate('/call/active');
    }
  };

  const handleReject = () => {
    if (incomingCall) {
      socketService.emitCallReject(incomingCall.callId);
    }
    clearIncomingCall();
    navigate(-1);
  };

  if (!incomingCall) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg p-8 text-center w-full max-w-md mx-4">
        <div className="w-24 h-24 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-4xl mb-6 mx-auto">
          {incomingCall.contactDisplayName.charAt(0).toUpperCase()}
        </div>

        <h2 className="text-3xl font-bold text-white mb-2">{incomingCall.contactDisplayName}</h2>
        <p className="text-gray-400 text-lg mb-8">@{incomingCall.contactUsername}</p>

        <p className="text-gray-300 text-sm mb-8 animate-pulse">Incoming call...</p>

        <div className="flex justify-center gap-6">
          <button
            onClick={handleAccept}
            className="inline-flex items-center justify-center w-16 h-16 bg-green-600 hover:bg-green-700 text-white rounded-full transition"
            title="Accept call"
          >
            <FiPhone className="w-8 h-8" />
          </button>
          <button
            onClick={handleReject}
            className="inline-flex items-center justify-center w-16 h-16 bg-red-600 hover:bg-red-700 text-white rounded-full transition"
            title="Reject call"
          >
            <FiPhoneOff className="w-8 h-8" />
          </button>
        </div>
      </div>
    </div>
  );
};
