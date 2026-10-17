/**
 * Call history page
 */

import React, { useState, useEffect } from 'react';
import { FiPhone, FiPhoneOff, FiArrowDownRight, FiArrowUpRight, FiClock } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { useCallStore } from '../store/callStore';
import { getCallHistory } from '../services/firebase';
import { formatDistanceToNow } from 'date-fns';

export const CallHistoryPage: React.FC = () => {
  const { user } = useAuth();
  const { callHistory, setCallHistory } = useCallStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadHistory = async () => {
      if (user) {
        try {
          const history = await getCallHistory(user.uid, 50);
          setCallHistory(history);
        } catch (error) {
          console.error('Failed to load call history:', error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    loadHistory();
  }, [user, setCallHistory]);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (minutes === 0) return `${secs}s`;
    return `${minutes}m ${secs}s`;
  };

  const getCallIcon = (call: typeof callHistory[0]) => {
    switch (call.status) {
      case 'missed':
        return <FiPhoneOff className="w-5 h-5 text-red-500" />;
      case 'rejected':
        return <FiPhoneOff className="w-5 h-5 text-red-500" />;
      case 'completed':
        // Check if incoming (callee) or outgoing (caller)
        return user?.uid === call.toUid ? (
          <FiArrowDownRight className="w-5 h-5 text-green-500" />
        ) : (
          <FiArrowUpRight className="w-5 h-5 text-blue-500" />
        );
      default:
        return <FiPhone className="w-5 h-5 text-gray-400" />;
    }
  };

  const getCallLabel = (call: typeof callHistory[0]) => {
    switch (call.status) {
      case 'missed':
        return 'Missed call';
      case 'rejected':
        return 'Declined call';
      case 'completed':
        return user?.uid === call.toUid ? 'Incoming call' : 'Outgoing call';
      default:
        return 'Call';
    }
  };

  const getContactName = (call: typeof callHistory[0]) => {
    return user?.uid === call.fromUid ? call.toUsername : call.fromUsername;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FiClock className="w-6 h-6" />
            Call History
          </h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">Loading call history...</div>
        ) : callHistory.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <FiPhone className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No calls yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {callHistory.map((call) => (
              <div
                key={call.callId}
                className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex items-center justify-between hover:bg-gray-700 transition"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="flex-shrink-0">{getCallIcon(call)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{getContactName(call)}</p>
                    <p className="text-gray-400 text-sm">
                      {getCallLabel(call)}
                      {call.startedAt && (
                        <> · {formatDistanceToNow(new Date(call.startedAt), { addSuffix: true })}</>
                      )}
                    </p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  {call.duration && (
                    <p className="text-gray-400 text-sm">{formatDuration(call.duration)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
