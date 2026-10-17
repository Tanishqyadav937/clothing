/**
 * Contacts home page
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiPlus, FiPhone, FiLogOut } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { useContactsStore } from '../store/contactsStore';
import { useCallStore } from '../store/callStore';
import { listContacts } from '../services/firebase';
import { socketService } from '../services/socket';
import { v4 as uuidv4 } from 'uuid';

export const ContactsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { contacts, setContacts } = useContactsStore();
  const { setActiveCall } = useCallStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load contacts on mount
  useEffect(() => {
    const loadContacts = async () => {
      if (user) {
        try {
          const fetchedContacts = await listContacts(user.uid);
          setContacts(fetchedContacts || []);
        } catch (error) {
          console.error('Failed to load contacts:', error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    loadContacts();
  }, [user, setContacts]);

  // Listen for presence updates
  useEffect(() => {
    socketService.onEvent('presence:update', (data) => {
      const { uid, online } = data;
      setContacts(
        contacts.map((c) => (c.uid === uid ? { ...c, isOnline: online } : c))
      );
    });

    return () => {
      socketService.offEvent('presence:update');
    };
  }, [contacts, setContacts]);

  const filteredContacts = contacts.filter(
    (c) =>
      c.status === 'accepted' &&
      (c.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.username.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleCall = (contact: typeof contacts[0]) => {
    const callId = uuidv4();
    setActiveCall({
      callId,
      contactUsername: contact.username,
      contactDisplayName: contact.displayName,
      status: 'calling',
      isIncoming: false,
      startTime: Date.now(),
    });

    socketService.emitCallRequest(callId, contact.username);
    navigate('/call/outgoing');
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const selectedContactData = contacts.find((c) => c.uid === selectedContact);

  return (
    <div className="flex h-screen bg-gray-900">
      {/* Sidebar */}
      <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center text-white font-bold">
                {user?.displayName?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div>
                <p className="text-white font-medium text-sm">{user?.displayName}</p>
                <p className="text-gray-400 text-xs">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-gray-700 rounded transition text-gray-300"
              title="Logout"
            >
              <FiLogOut className="w-5 h-5" />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <FiSearch className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-green-500 text-sm"
            />
          </div>
        </div>

        {/* Contacts List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-gray-400 text-center">Loading contacts...</div>
          ) : filteredContacts.length === 0 ? (
            <div className="p-4 text-gray-400 text-center">No contacts found</div>
          ) : (
            filteredContacts.map((contact) => (
              <button
                key={contact.uid}
                onClick={() => setSelectedContact(contact.uid)}
                className={`w-full p-4 border-b border-gray-700 hover:bg-gray-700 transition text-left ${
                  selectedContact === contact.uid ? 'bg-gray-700' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center text-white font-bold">
                      {contact.displayName.charAt(0).toUpperCase()}
                    </div>
                    {contact.isOnline && (
                      <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-800"></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{contact.displayName}</p>
                    <p className="text-gray-400 text-sm truncate">@{contact.username}</p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Add Contact Button */}
        <button
          onClick={() => navigate('/add-contact')}
          className="m-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded flex items-center justify-center gap-2 transition"
        >
          <FiPlus className="w-5 h-5" />
          Add Contact
        </button>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-900">
        {selectedContactData ? (
          <div className="text-center">
            <div className="w-24 h-24 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-4xl mb-4 mx-auto">
              {selectedContactData.displayName.charAt(0).toUpperCase()}
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">{selectedContactData.displayName}</h2>
            <p className="text-gray-400 mb-6">@{selectedContactData.username}</p>
            {selectedContactData.isOnline && (
              <p className="text-green-400 text-sm mb-6">Online</p>
            )}
            <button
              onClick={() => handleCall(selectedContactData)}
              className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg flex items-center gap-2 mx-auto transition"
            >
              <FiPhone className="w-5 h-5" />
              Call
            </button>
          </div>
        ) : (
          <div className="text-center text-gray-500">
            <div className="text-6xl mb-4">📞</div>
            <p className="text-xl">Select a contact to call</p>
          </div>
        )}
      </div>
    </div>
  );
};
