/**
 * Signup page with username availability check
 */

import React, { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { FiMail, FiLock, FiUser, FiAlertCircle, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { searchUserByUsername } from '../services/firebase';

interface SignupForm {
  email: string;
  password: string;
  username: string;
  displayName?: string;
}

export const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const { signup, error: authError, clearError } = useAuth();
  const { register, handleSubmit, watch, formState: { errors }, reset } = useForm<SignupForm>();
  const [isLoading, setIsLoading] = useState(false);
  const [usernameCheck, setUsernameCheck] = useState<'available' | 'taken' | 'checking' | null>(null);
  const username = watch('username');

  // Debounced username availability check
  const checkUsername = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout;
      return async (value: string) => {
        clearTimeout(timeoutId);
        if (!value || value.length < 3) {
          setUsernameCheck(null);
          return;
        }

        setUsernameCheck('checking');
        timeoutId = setTimeout(async () => {
          try {
            const result = await searchUserByUsername(value);
            setUsernameCheck(result ? 'taken' : 'available');
          } catch (err) {
            console.warn('Username check error:', err);
            setUsernameCheck(null);
          }
        }, 500);
      };
    })(),
    []
  );

  React.useEffect(() => {
    checkUsername(username);
  }, [username, checkUsername]);

  const onSubmit = async (data: SignupForm) => {
    if (usernameCheck === 'taken') {
      return;
    }

    try {
      setIsLoading(true);
      clearError();
      await signup(data.email, data.password, data.username, data.displayName || data.username);
      reset();
      navigate('/contacts', { replace: true });
    } catch (err) {
      console.error('Signup error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="w-full max-w-md p-8 bg-gray-800 rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold text-white mb-2 text-center">Create Account</h1>
        <p className="text-gray-400 text-center mb-6">Join CallMe to start calling</p>

        {authError && (
          <div className="mb-4 p-3 bg-red-900 bg-opacity-50 border border-red-500 rounded flex items-center gap-2 text-red-200">
            <FiAlertCircle className="w-4 h-4" />
            <span>{authError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
            <div className="relative">
              <FiMail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="email"
                placeholder="Enter your email"
                className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-green-500"
                {...register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Invalid email address',
                  },
                })}
              />
            </div>
            {errors.email && <p className="text-red-400 text-sm mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Username</label>
            <div className="relative">
              <FiUser className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Choose a username (3-20 chars)"
                className="w-full pl-10 pr-10 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-green-500"
                {...register('username', {
                  required: 'Username is required',
                  minLength: { value: 3, message: 'Minimum 3 characters' },
                  maxLength: { value: 20, message: 'Maximum 20 characters' },
                  pattern: {
                    value: /^[a-zA-Z0-9_]+$/,
                    message: 'Alphanumeric and underscore only',
                  },
                })}
              />
              {usernameCheck === 'available' && <FiCheckCircle className="absolute right-3 top-3 w-5 h-5 text-green-500" />}
              {usernameCheck === 'taken' && <FiXCircle className="absolute right-3 top-3 w-5 h-5 text-red-500" />}
              {usernameCheck === 'checking' && <div className="absolute right-3 top-3 w-5 h-5 border-2 border-gray-400 border-t-green-500 rounded-full animate-spin"></div>}
            </div>
            {errors.username && <p className="text-red-400 text-sm mt-1">{errors.username.message}</p>}
            {usernameCheck === 'taken' && <p className="text-red-400 text-sm mt-1">Username already taken</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Display Name (Optional)</label>
            <input
              type="text"
              placeholder="Your display name"
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-green-500"
              {...register('displayName')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
            <div className="relative">
              <FiLock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="password"
                placeholder="Minimum 6 characters"
                className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-green-500"
                {...register('password', {
                  required: 'Password is required',
                  minLength: { value: 6, message: 'Minimum 6 characters' },
                })}
              />
            </div>
            {errors.password && <p className="text-red-400 text-sm mt-1">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isLoading || usernameCheck === 'taken'}
            className="w-full py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-medium rounded transition"
          >
            {isLoading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-400">
          Already have an account?{' '}
          <Link to="/login" className="text-green-400 hover:text-green-300 font-medium">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
};
