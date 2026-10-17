/**
 * Forgot password page
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { FiMail, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

interface ForgotPasswordForm {
  email: string;
}

export const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { forgotPassword, error: authError, clearError } = useAuth();
  const { register, handleSubmit, formState: { errors }, reset } = useForm<ForgotPasswordForm>();
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const onSubmit = async (data: ForgotPasswordForm) => {
    try {
      setIsLoading(true);
      clearError();
      await forgotPassword(data.email);
      setSuccess(true);
      reset();
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 3000);
    } catch (err) {
      console.error('Forgot password error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="w-full max-w-md p-8 bg-gray-800 rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold text-white mb-2 text-center">Reset Password</h1>
        <p className="text-gray-400 text-center mb-6">Enter your email to receive reset instructions</p>

        {success && (
          <div className="mb-4 p-3 bg-green-900 bg-opacity-50 border border-green-500 rounded flex items-center gap-2 text-green-200">
            <FiCheckCircle className="w-4 h-4" />
            <span>Check your email for reset instructions. Redirecting...</span>
          </div>
        )}

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

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-medium rounded transition"
          >
            {isLoading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/login" className="text-green-400 hover:text-green-300 font-medium">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
};
