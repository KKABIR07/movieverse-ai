'use client';

import { create } from 'zustand';
import { useWatchlistStore, useReviewsStore, useRatingsStore } from './index';
import { useFollowingStore } from './followingStore';
import { useChatStore } from './chatStore';
import type { AuthStatus } from './authStore';
import { OWNER_STORAGE_KEY, decideUserScope } from './userScope';

/** Persisted stores that hold data belonging to one signed-in user. */
const USER_SCOPED = [useWatchlistStore, useReviewsStore, useRatingsStore, useFollowingStore] as const;
const ALL_PERSISTED = [...USER_SCOPED, useChatStore] as const;

interface HydrationState {
  /** True once every persisted store has been read from localStorage. */
  hydrated: boolean;
}

export const useHydrationStore = create<HydrationState>()(() => ({ hydrated: false }));

/**
 * `false` on the server + first client render, `true` after persisted stores
 * load. Gate localStorage-derived UI (counts, "saved" states) on it if you
 * want to avoid a flash of the empty state.
 */
export const useStoresHydrated = () => useHydrationStore((s) => s.hydrated);

let rehydrating: Promise<void> | null = null;

/** Rehydrate every persisted store exactly once (idempotent). */
export function rehydratePersistedStores(): Promise<void> {
  if (!rehydrating) {
    rehydrating = Promise.all(ALL_PERSISTED.map((s) => Promise.resolve(s.persist.rehydrate())))
      .catch((err) => {
        console.error('[mkmovies] store rehydrate failed', err);
      })
      .then(() => {
        useHydrationStore.setState({ hydrated: true });
      });
  }
  return rehydrating;
}

function safeStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Wipe all per-user data from memory and localStorage. */
export function clearUserScopedData(): void {
  useWatchlistStore.getState().reset();
  useReviewsStore.getState().reset();
  useRatingsStore.getState().reset();
  useFollowingStore.getState().reset();
  useChatStore.getState().reset();
  for (const store of USER_SCOPED) {
    try {
      store.persist.clearStorage();
    } catch {
      /* storage blocked */
    }
  }
}

/** Apply the owner rules from ./userScope after auth status changes. */
export function reconcileUserScope(status: AuthStatus, userId: string | null): void {
  const storage = safeStorage();
  let prevOwner: string | null = null;
  try {
    prevOwner = storage?.getItem(OWNER_STORAGE_KEY) ?? null;
  } catch {
    /* ignore */
  }
  const decision = decideUserScope(prevOwner, status, userId);
  if (decision.clear) clearUserScopedData();
  if (decision.nextOwner !== undefined && storage) {
    try {
      if (decision.nextOwner === null) storage.removeItem(OWNER_STORAGE_KEY);
      else storage.setItem(OWNER_STORAGE_KEY, decision.nextOwner);
    } catch {
      /* ignore */
    }
  }
  // Signed in: the server watchlist becomes the source of truth (local items are merged once).
  if (status === 'authenticated' && userId) {
    void useWatchlistStore.getState().syncFromServer(userId);
    watchFocusRefresh();
  }
}

let focusListener = false;
let lastRefresh = 0;
/** Re-read the server watchlist when the tab becomes visible again (multi-device), at most once a minute. */
function watchFocusRefresh(): void {
  if (focusListener || typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;
  focusListener = true;
  lastRefresh = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || Date.now() - lastRefresh < 60_000) return;
    lastRefresh = Date.now();
    void useWatchlistStore.getState().refreshFromServer();
  });
}

/** Remove keys from older builds that should no longer exist. */
export function cleanupLegacyStorage(): void {
  const storage = safeStorage();
  try {
    storage?.removeItem('mkmovies-auth'); // user is no longer persisted
  } catch {
    /* ignore */
  }
}
