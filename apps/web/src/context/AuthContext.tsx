/**
 * Authentication context
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import * as firebaseService from '../services/firebase';
import { User } from '../types';
import { socketService } from '../services/socket';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, username: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = firebaseService.onAuthStateChange(async (firebaseUser: FirebaseUser | null) => {
      try {
        if (firebaseUser) {
          // Get user profile from Firestore
          const profile = await firebaseService.getUserProfile(firebaseUser.uid);
          if (profile) {
            setUser(profile as User);

            // Authenticate socket connection
            try {
              const token = await firebaseService.getIdToken();
              await socketService.connect(token);
            } catch (socketError) {
              console.warn('Socket connection failed:', socketError);
            }
          }
        } else {
          setUser(null);
          socketService.disconnect();
        }
      } catch (err) {
        console.error('Auth state change error:', err);
        setError(err instanceof Error ? err.message : 'Auth error');
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setError(null);
      await firebaseService.signIn(email, password);
      // User state will be updated by onAuthStateChange subscription
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      throw err;
    }
  };

  const signup = async (
    email: string,
    password: string,
    username: string,
    displayName: string
  ) => {
    try {
      setError(null);
      const { uid } = await firebaseService.signUp(email, password);

      // Create user profile in Firestore
      await firebaseService.createUserProfile(uid, {
        username,
        email,
        displayName,
      });

      // Register username on server
      const token = await firebaseService.getIdToken();
      const response = await fetch(
        `${import.meta.env.VITE_SIGNALING_SERVER_URL || 'http://localhost:3001'}/api/users/username`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ username }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to register username');
      }

      // User state will be updated by onAuthStateChange subscription
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Signup failed';
      setError(message);
      throw err;
    }
  };

  const logout = async () => {
    try {
      setError(null);
      socketService.disconnect();
      await firebaseService.signOut();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Logout failed';
      setError(message);
      throw err;
    }
  };

  const forgotPassword = async (email: string) => {
    try {
      setError(null);
      await firebaseService.forgotPassword(email);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Password reset failed';
      setError(message);
      throw err;
    }
  };

  const clearError = () => {
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        signup,
        logout,
        forgotPassword,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
