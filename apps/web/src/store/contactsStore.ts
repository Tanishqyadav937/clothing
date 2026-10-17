/**
 * Contacts state management with Zustand
 */

import { create } from 'zustand';
import { Contact } from '../types';

interface ContactsState {
  contacts: Contact[];
  loading: boolean;
  error: string | null;

  // Actions
  setContacts: (contacts: Contact[]) => void;
  addContact: (contact: Contact) => void;
  updateContact: (uid: string, contact: Partial<Contact>) => void;
  removeContact: (uid: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useContactsStore = create<ContactsState>((set) => ({
  contacts: [],
  loading: false,
  error: null,

  setContacts: (contacts) => set({ contacts, error: null }),
  addContact: (contact) => set((state) => ({ contacts: [...state.contacts, contact] })),
  updateContact: (uid, updates) =>
    set((state) => ({
      contacts: state.contacts.map((c) => (c.uid === uid ? { ...c, ...updates } : c)),
    })),
  removeContact: (uid) =>
    set((state) => ({
      contacts: state.contacts.filter((c) => c.uid !== uid),
    })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
