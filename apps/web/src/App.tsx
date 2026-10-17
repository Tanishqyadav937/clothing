/**
 * Main App with React Router v6
 */

import React from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useCallStore } from './store/callStore';

// Pages
import { SplashPage } from './pages/SplashPage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ContactsPage } from './pages/ContactsPage';
import { AddContactPage } from './pages/AddContactPage';
import { CallHistoryPage } from './pages/CallHistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { OutgoingCallPage } from './pages/OutgoingCallPage';
import { IncomingCallPage } from './pages/IncomingCallPage';
import { ActiveCallPage } from './pages/ActiveCallPage';

// Protected route wrapper
const ProtectedRoute: React.FC<{ element: React.ReactElement }> = ({ element }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen bg-gray-900"><p className="text-white">Loading...</p></div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return element;
};

// Layout wrapper for main app
const LayoutWrapper: React.FC<{ element: React.ReactElement }> = ({ element }) => {
  const { incomingCall } = useCallStore();

  return (
    <>
      {element}
      {incomingCall && <IncomingCallPage />}
    </>
  );
};

const router = createBrowserRouter([
  {
    path: '/',
    element: <SplashPage />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/signup',
    element: <SignupPage />,
  },
  {
    path: '/forgot-password',
    element: <ForgotPasswordPage />,
  },
  {
    path: '/contacts',
    element: <ProtectedRoute element={<LayoutWrapper element={<ContactsPage />} />} />,
  },
  {
    path: '/add-contact',
    element: <ProtectedRoute element={<LayoutWrapper element={<AddContactPage />} />} />,
  },
  {
    path: '/history',
    element: <ProtectedRoute element={<LayoutWrapper element={<CallHistoryPage />} />} />,
  },
  {
    path: '/settings',
    element: <ProtectedRoute element={<LayoutWrapper element={<SettingsPage />} />} />,
  },
  {
    path: '/call/outgoing',
    element: <ProtectedRoute element={<OutgoingCallPage />} />,
  },
  {
    path: '/call/incoming',
    element: <ProtectedRoute element={<IncomingCallPage />} />,
  },
  {
    path: '/call/active',
    element: <ProtectedRoute element={<ActiveCallPage />} />,
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);

export const App: React.FC = () => {
  return <RouterProvider router={router} />;
};
