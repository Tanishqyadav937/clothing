/**
 * Firebase initialization and Firestore services
 */

import { initializeApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  Firestore,
  doc,
  setDoc,
  getDoc,
  query,
  where,
  collection,
  getDocs,
  orderBy,
  limit,
  offset,
} from 'firebase/firestore';

import { User } from '../types';

// Initialize Firebase with env variables or fall back to demo mode
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'demo.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-project',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'demo-project.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || 'demo-sender',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || 'demo-app',
};

let firebaseApp: FirebaseApp;
let auth: Auth;
let db: Firestore;

try {
  firebaseApp = initializeApp(firebaseConfig);
  auth = getAuth(firebaseApp);
  db = getFirestore(firebaseApp);
} catch (error) {
  console.warn('Firebase initialization failed, running in demo mode:', error);
}

// Export instances
export { firebaseApp, auth, db };

/**
 * Sign up a new user with email and password
 */
export async function signUp(
  email: string,
  password: string
): Promise<{ uid: string; user: FirebaseUser }> {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  return {
    uid: userCredential.user.uid,
    user: userCredential.user,
  };
}

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string): Promise<FirebaseUser> {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
}

/**
 * Sign out
 */
export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

/**
 * Send password reset email
 */
export async function forgotPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

/**
 * Get current auth state
 */
export function onAuthStateChange(callback: (user: FirebaseUser | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

/**
 * Get ID token for authenticated requests
 */
export async function getIdToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('No user logged in');
  return user.getIdToken();
}

/**
 * Create a user profile in Firestore
 */
export async function createUserProfile(
  uid: string,
  userData: { username: string; email: string; displayName: string }
): Promise<void> {
  const userRef = doc(db, 'users', uid);
  await setDoc(userRef, {
    ...userData,
    createdAt: Date.now(),
  });
}

/**
 * Get user profile
 */
export async function getUserProfile(uid: string): Promise<User | null> {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  return userSnap.exists() ? (userSnap.data() as User) : null;
}

/**
 * Search for a user by username (exact match via API)
 */
export async function searchUserByUsername(username: string): Promise<User | null> {
  try {
    const response = await fetch(`${import.meta.env.VITE_SIGNALING_SERVER_URL || 'http://localhost:3001'}/api/users/search?username=${encodeURIComponent(username)}`);
    if (response.ok) {
      const data = await response.json();
      return data;
    }
  } catch (error) {
    console.warn('Search API error:', error);
  }
  return null;
}

/**
 * List contacts for the user
 */
export async function listContacts(uid: string): Promise<Contact[]> {
  try {
    const response = await fetch(`${import.meta.env.VITE_SIGNALING_SERVER_URL || 'http://localhost:3001'}/api/contacts`, {
      headers: {
        Authorization: `Bearer ${await getIdToken()}`,
      },
    });
    if (response.ok) {
      return response.json();
    }
  } catch (error) {
    console.warn('List contacts error:', error);
  }
  return [];
}

/**
 * Get call history
 */
export async function getCallHistory(uid: string, limit: number = 20, offsetVal: number = 0): Promise<Call[]> {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SIGNALING_SERVER_URL || 'http://localhost:3001'}/api/calls/history?limit=${limit}&offset=${offsetVal}`,
      {
        headers: {
          Authorization: `Bearer ${await getIdToken()}`,
        },
      }
    );
    if (response.ok) {
      return response.json();
    }
  } catch (error) {
    console.warn('Get call history error:', error);
  }
  return [];
}

// Placeholder types for Contact and Call that were missing
export interface Contact {
  uid: string;
  username: string;
  displayName: string;
  status: 'pending' | 'accepted' | 'blocked';
  isOnline: boolean;
}

export interface Call {
  callId: string;
  fromUid: string;
  toUid: string;
  fromUsername: string;
  toUsername: string;
  status: string;
  startedAt?: number;
  answeredAt?: number;
  endedAt?: number;
  duration?: number;
}
