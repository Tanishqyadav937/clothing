/**
 * Add contact page with username search
 */

import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiArrowLeft, FiPlus, FiAlertCircle } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { searchUserByUsername } from '../services/firebase';
import { User } from '../types';

export const AddContactPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingUid, setAddingUid] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSearch = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout;
      return async (value: string) => {
        setError(null);
        setSuccessMessage(null);
        clearTimeout(timeoutId);

        if (!value || value.length < 2) {
          setResults([]);
          return;
        }

        setIsSearching(true);
        timeoutId = setTimeout(async () => {
          try {
            const result = await searchUserByUsername(value);
            if (result && result.uid !== user?.uid) {
              setResults([result]);
            } else {
              setResults([]);
            }
          } catch (err) {
            setError('Search failed. Please try again.');
            setResults([]);
          } finally {
            setIsSearching(false);
          }
        }, 300);
      };
    })(),
    [user?.uid]
  );

  React.useEffect(() => {
    handleSearch(searchTerm);
  }, [searchTerm, handleSearch]);

  const handleAddContact = async (contactUid: string) => {
    if (!user) return;

    try {
      setAddingUid(contactUid);
      const token = localStorage.getItem('idToken') || '';
      const response = await fetch(
        `${import.meta.env.VITE_SIGNALING_SERVER_URL || 'http://localhost:3001'}/api/contacts/request`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ toUid: contactUid }),
        }
      );

      if (response.ok) {
        setSuccessMessage('Contact request sent!');
        setTimeout(() => {
          navigate('/contacts');
        }, 1500);
      } else {
        setError('Failed to send request');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error sending request');
    } finally {
      setAddingUid(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <button
            onClick={() => navigate('/contacts')}
            className="p-2 hover:bg-gray-700 rounded transition"
          >
            <FiArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold">Add Contact</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto p-4 sm:p-6">
        {/* Search Bar */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">Search by username</label>
          <div className="relative">
            <FiSearch className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Enter username (minimum 2 characters)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-400 focus:outline-none focus:border-green-500"
            />
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 p-3 bg-red-900 bg-opacity-50 border border-red-500 rounded flex items-center gap-2 text-red-200">
            <FiAlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 bg-green-900 bg-opacity-50 border border-green-500 rounded text-green-200">
            ✓ {successMessage}
          </div>
        )}

        {/* Results */}
        <div>
          {isSearching && <p className="text-gray-400">Searching...</p>}

          {!isSearching && results.length === 0 && searchTerm && (
            <p className="text-gray-400">No users found matching "{searchTerm}"</p>
          )}

          {results.map((result) => (
            <div
              key={result.uid}
              className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center text-white font-bold">
                  {result.displayName?.charAt(0).toUpperCase() || result.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-white font-medium">{result.displayName || result.username}</p>
                  <p className="text-gray-400 text-sm">@{result.username}</p>
                </div>
              </div>
              <button
                onClick={() => handleAddContact(result.uid)}
                disabled={addingUid === result.uid}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-medium rounded flex items-center gap-2 transition"
              >
                <FiPlus className="w-4 h-4" />
                {addingUid === result.uid ? 'Adding...' : 'Add'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
