'use client';

import { create } from 'zustand';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  initials: string;
  joinedAt: string;
}

/**
 * - `unknown`: we have not heard from /api/auth/me yet (or it failed on the network)
 * - `authenticated` / `anonymous`: confirmed by the server
 */
export type AuthStatus = 'unknown' | 'authenticated' | 'anonymous';

interface AuthStore {
  user: User | null;
  status: AuthStatus;
  isLoading: boolean;
  error: string | null;
  signup: (name: string, email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
  clearError: () => void;
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Auth state is NOT persisted: the session cookie is the source of truth and the
 * user is refreshed from `/api/auth/me` on every load (see Providers). Persisting
 * it caused hydration mismatches and stale identities after a session expired.
 */
export const useAuthStore = create<AuthStore>()((set) => ({
  user: null,
  status: 'unknown',
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
      const data = await readJson(res);
      if (!res.ok) {
        set({ isLoading: false, error: (data.error as string) ?? 'Signup failed.' });
        return;
      }
      set({ user: data.user as User, status: 'authenticated', isLoading: false, error: null });
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
      const data = await readJson(res);
      if (!res.ok) {
        set({ isLoading: false, error: (data.error as string) ?? 'Login failed.' });
        return;
      }
      set({ user: data.user as User, status: 'authenticated', isLoading: false, error: null });
    } catch {
      set({ isLoading: false, error: 'Network error. Please try again.' });
    }
  },

  logout: async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Clear locally even if the network call fails
    }
    set({ user: null, status: 'anonymous', error: null });
  },

  hydrate: async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      const data = await readJson(res);
      if (data.user) set({ user: data.user as User, status: 'authenticated' });
      else set({ user: null, status: 'anonymous' });
    } catch {
      // Network failure: keep status 'unknown' so per-user data is NOT wiped
    }
  },

  clearError: () => set({ error: null }),
}));

/** Selector hooks */
export const useUser = () => useAuthStore((s) => s.user);
export const useAuthStatus = () => useAuthStore((s) => s.status);
