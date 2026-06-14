'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  initials: string;
  joinedAt: string;
}

interface AuthStore {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  signup: (name: string, email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isLoading: false,
      error: null,

      signup: async (name, email, password) => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch('/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password }),
          });
          const data = await res.json();
          if (!res.ok) {
            set({ isLoading: false, error: data.error ?? 'Signup failed.' });
            return;
          }
          set({ user: data.user, isLoading: false, error: null });
        } catch {
          set({ isLoading: false, error: 'Network error. Please try again.' });
        }
      },

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });
          const data = await res.json();
          if (!res.ok) {
            set({ isLoading: false, error: data.error ?? 'Login failed.' });
            return;
          }
          set({ user: data.user, isLoading: false, error: null });
        } catch {
          set({ isLoading: false, error: 'Network error. Please try again.' });
        }
      },

      logout: async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        set({ user: null, error: null });
      },

      hydrate: async () => {
        try {
          const res = await fetch('/api/auth/me');
          const data = await res.json();
          if (data.user) set({ user: data.user });
          else set({ user: null });
        } catch {
          // silently fail — user stays null
        }
      },

      clearError: () => set({ error: null }),
    }),
    { name: 'movieverse-auth', partialize: (s) => ({ user: s.user }) }
  )
);
