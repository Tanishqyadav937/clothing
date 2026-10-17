/**
 * Settings page
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiLogOut, FiSliders, FiBell, FiShield } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Logout failed:', error);
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FiSliders className="w-6 h-6" />
            Settings
          </h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        {/* Profile Section */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-bold text-white mb-4">Profile</h2>

          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-2xl">
              {user?.displayName?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div>
              <p className="text-white font-medium">{user?.displayName}</p>
              <p className="text-gray-400 text-sm">@{user?.username}</p>
              <p className="text-gray-500 text-xs mt-1">{user?.email}</p>
            </div>
          </div>

          <div className="space-y-3 text-sm">
            <div>
              <label className="text-gray-400">Display Name</label>
              <p className="text-white font-medium">{user?.displayName}</p>
            </div>
            <div>
              <label className="text-gray-400">Username</label>
              <p className="text-white font-medium">@{user?.username}</p>
            </div>
            <div>
              <label className="text-gray-400">Email</label>
              <p className="text-white font-medium">{user?.email}</p>
            </div>
            <div>
              <label className="text-gray-400">Member Since</label>
              <p className="text-white font-medium">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
              </p>
            </div>
          </div>
        </div>

        {/* Preferences Section */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <FiBell className="w-5 h-5" />
            Preferences
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium">Notifications</p>
                <p className="text-gray-400 text-sm">Receive incoming call alerts</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notificationsEnabled}
                  onChange={(e) => setNotificationsEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Blocked Users Section */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <FiShield className="w-5 h-5" />
            Blocked Users
          </h2>

          <p className="text-gray-400 text-sm">No blocked users</p>
        </div>

        {/* About Section */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-bold text-white mb-4">About</h2>

          <div className="space-y-2 text-sm text-gray-400">
            <p>
              <span className="text-gray-300">App Version</span>
              <br />
              1.0.0
            </p>
            <p className="mt-4">
              <span className="text-gray-300">Build Date</span>
              <br />
              {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition"
        >
          <FiLogOut className="w-5 h-5" />
          {isLoggingOut ? 'Signing Out...' : 'Sign Out'}
        </button>
      </div>
    </div>
  );
};
