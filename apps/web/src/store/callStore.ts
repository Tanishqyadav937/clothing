/**
 * Call state management with Zustand
 */

import { create } from 'zustand';
import { ActiveCall, Call } from '../types';

interface CallState {
  activeCall: ActiveCall | null;
  incomingCall: ActiveCall | null;
  callHistory: Call[];
  onlineUsers: Set<string>;
  connectionStatus: 'idle' | 'connecting' | 'connected' | 'reconnecting';

  // Actions
  setActiveCall: (call: ActiveCall | null) => void;
  setIncomingCall: (call: ActiveCall | null) => void;
  clearActiveCall: () => void;
  clearIncomingCall: () => void;
  setCallHistory: (calls: Call[]) => void;
  addCallToHistory: (call: Call) => void;
  updatePresence: (uid: string, isOnline: boolean) => void;
  setConnectionStatus: (status: 'idle' | 'connecting' | 'connected' | 'reconnecting') => void;
}

export const useCallStore = create<CallState>((set) => ({
  activeCall: null,
  incomingCall: null,
  callHistory: [],
  onlineUsers: new Set(),
  connectionStatus: 'idle',

  setActiveCall: (call) => set({ activeCall: call }),
  setIncomingCall: (call) => set({ incomingCall: call }),
  clearActiveCall: () => set({ activeCall: null }),
  clearIncomingCall: () => set({ incomingCall: null }),
  setCallHistory: (calls) => set({ callHistory: calls }),
  addCallToHistory: (call) => set((state) => ({ callHistory: [call, ...state.callHistory] })),
  updatePresence: (uid, isOnline) =>
    set((state) => {
      const newOnlineUsers = new Set(state.onlineUsers);
      if (isOnline) {
        newOnlineUsers.add(uid);
      } else {
        newOnlineUsers.delete(uid);
      }
      return { onlineUsers: newOnlineUsers };
    }),
  setConnectionStatus: (status) => set({ connectionStatus: status }),
}));
