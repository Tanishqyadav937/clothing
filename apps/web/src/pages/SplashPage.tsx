/**
 * Splash page with loading indicator
 */

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPhone } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

export const SplashPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        navigate('/contacts', { replace: true });
      } else {
        navigate('/login', { replace: true });
      }
    }
  }, [loading, user, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-green-900 to-green-800">
      <div className="text-center">
        <FiPhone className="w-24 h-24 mx-auto mb-4 text-white animate-bounce" />
        <h1 className="text-4xl font-bold text-white mb-2">CallMe</h1>
        <p className="text-green-100 mb-8">Loading...</p>
        <div className="flex justify-center gap-1">
          <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
          <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>
      </div>
    </div>
  );
};
