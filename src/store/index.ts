'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WatchlistItem, LocalReview } from '@/types/tmdb';
import { createWatchlistApi } from '@/lib/sync/watchlistApi';
import { createWatchlistSync } from '@/lib/sync/watchlistSync';
import { useAuthStore } from './authStore';
import { toast } from './toastStore';
import {
  DEFAULT_LIST_ID,
  WATCHLIST_VERSION,
  addItem,
  defaultList,
  hasItem,
  matchesItem,
  migrateWatchlist,
  removeItem,
  type MediaType,
  type WatchlistList,
} from './watchlistLogic';

export type { MediaType, WatchlistList } from './watchlistLogic';
export { watchKey } from './watchlistLogic';

/*
 * Every persisted store uses `skipHydration: true`. They are rehydrated once,
 * on the client, by <Providers> (see ./hydration.ts). The first client render
 * therefore matches the server HTML and there are no hydration errors.
 */

// ── Watchlist Store ──────────────────────────────────────────────────────────
//
// One list (`default`), keyed by `${media_type}:${id}`.
//  - Signed out: a plain local list (localStorage).
//  - Signed in: server-backed. Mutations apply optimistically and are pushed to
//    /api/watchlist; failures roll back that one change with a toast. On the first
//    confirmed session the local items are merged into the account once
//    (`syncFromServer`), after that the server list replaces the local cache.
//
// The multi-list API (createList, …) is kept for backward compatibility but only the
// default list is synced; the UI no longer exposes extra lists.

function makeId() {
  return `list_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

interface WatchlistStore {
  lists: WatchlistList[];
  activeListId: string;
  /** userId whose account already received this device's local items (merge-once marker). */
  mergedFor: string | null;

  // List management (local only)
  createList: (name: string) => string;
  renameList: (listId: string, name: string) => void;
  deleteList: (listId: string) => void;
  setActiveList: (listId: string) => void;

  /**
   * Item helpers operate on the active list.
   * `mediaType` is optional ONLY for backward compatibility: when omitted the
   * call targets items whose media_type is 'movie' (or missing). New code must
   * always pass it.
   */
  add: (item: Omit<WatchlistItem, 'addedAt'>) => void;
  addToList: (listId: string, item: Omit<WatchlistItem, 'addedAt'>) => void;
  remove: (itemId: number, mediaType?: MediaType) => void;
  removeFromList: (listId: string, itemId: number, mediaType?: MediaType) => void;
  has: (itemId: number, mediaType?: MediaType) => boolean;
  hasInAny: (itemId: number, mediaType?: MediaType) => boolean;
  /** Add if missing, remove if present (active list). Returns true when now saved. */
  toggle: (item: Omit<WatchlistItem, 'addedAt'>) => boolean;
  clear: () => void;
  /** Wipe all lists (used on logout / account switch). */
  reset: () => void;

  /** First sync for a confirmed session (merge local → server once, then server wins). */
  syncFromServer: (userId: string) => Promise<void>;
  /** Re-read the server list (e.g. when the tab regains focus). No-op when signed out. */
  refreshFromServer: () => Promise<void>;

  getActiveItems: () => WatchlistItem[];
}

const mapList = (lists: WatchlistList[], listId: string, fn: (items: WatchlistItem[]) => WatchlistItem[]) =>
  lists.map((l) => (l.id !== listId ? l : { ...l, items: fn(l.items) }));

const listItems = (s: Pick<WatchlistStore, 'lists'>, listId: string) => s.lists.find((l) => l.id === listId)?.items ?? [];

/** Server sync applies only to the default list of a signed-in user. */
const serverBacked = (listId: string) => listId === DEFAULT_LIST_ID && useAuthStore.getState().status === 'authenticated';

let syncEngine: ReturnType<typeof createWatchlistSync> | null = null;
function engine() {
  syncEngine ??= createWatchlistSync({
    api: createWatchlistApi(),
    getItems: () => listItems(useWatchlistStore.getState(), DEFAULT_LIST_ID),
    setItems: (items) => useWatchlistStore.setState((s) => ({ lists: mapList(s.lists, DEFAULT_LIST_ID, () => items) })),
    notify: (n) => toast(n),
    onAuthLost: () => void useAuthStore.getState().hydrate(),
  });
  return syncEngine;
}

const syncing = new Map<string, Promise<void>>();

/** Not persisted: true while the first server sync of a session runs. */
export const useWatchlistSyncState = create<{ syncing: boolean }>()(() => ({ syncing: false }));

export const useWatchlistStore = create<WatchlistStore>()(
  persist(
    (set, get) => {
      const addTo = (listId: string, item: Omit<WatchlistItem, 'addedAt'>) => {
        if (hasItem(listItems(get(), listId), item.id, item.media_type ?? 'movie')) return;
        set((s) => ({ lists: mapList(s.lists, listId, (items) => addItem(items, item)) }));
        if (serverBacked(listId)) {
          const added = listItems(get(), listId).find((i) => matchesItem(i, item.id, item.media_type ?? 'movie'));
          if (added) void engine().pushAdd(added);
        }
      };

      const removeFrom = (listId: string, itemId: number, mediaType?: MediaType) => {
        const removed = listItems(get(), listId).filter((i) => matchesItem(i, itemId, mediaType));
        if (!removed.length) return;
        set((s) => ({ lists: mapList(s.lists, listId, (items) => removeItem(items, itemId, mediaType)) }));
        if (serverBacked(listId)) for (const r of removed) void engine().pushRemove(r);
      };

      return {
        lists: [defaultList()],
        activeListId: DEFAULT_LIST_ID,
        mergedFor: null,

        createList: (name) => {
          const id = makeId();
          set((s) => ({
            lists: [...s.lists, { id, name: name.trim() || 'New List', items: [], createdAt: new Date().toISOString() }],
            activeListId: id,
          }));
          return id;
        },

        renameList: (listId, name) =>
          set((s) => ({
            lists: s.lists.map((l) => (l.id === listId ? { ...l, name: name.trim() || l.name } : l)),
          })),

        deleteList: (listId) =>
          set((s) => {
            const next = s.lists.filter((l) => l.id !== listId);
            if (!next.length) {
              const fresh = defaultList();
              return { lists: [fresh], activeListId: fresh.id };
            }
            const nextActive = next.find((l) => l.id === s.activeListId) ? s.activeListId : next[0].id;
            return { lists: next, activeListId: nextActive };
          }),

        setActiveList: (listId) => set({ activeListId: listId }),

        add: (item) => addTo(get().activeListId, item),
        addToList: (listId, item) => addTo(listId, item),
        remove: (itemId, mediaType) => removeFrom(get().activeListId, itemId, mediaType),
        removeFromList: (listId, itemId, mediaType) => removeFrom(listId, itemId, mediaType),

        has: (itemId, mediaType) => hasItem(get().getActiveItems(), itemId, mediaType),

        hasInAny: (itemId, mediaType) => get().lists.some((l) => hasItem(l.items, itemId, mediaType)),

        toggle: (item) => {
          const type = item.media_type ?? 'movie';
          if (get().has(item.id, type)) {
            get().remove(item.id, type);
            return false;
          }
          get().add({ ...item, media_type: type });
          return true;
        },

        clear: () => {
          const listId = get().activeListId;
          for (const i of [...listItems(get(), listId)]) removeFrom(listId, i.id, i.media_type ?? 'movie');
        },

        reset: () => set({ lists: [defaultList()], activeListId: DEFAULT_LIST_ID, mergedFor: null }),

        syncFromServer: (userId) => {
          const running = syncing.get(userId);
          if (running) return running;
          const p = (async () => {
            useWatchlistSyncState.setState({ syncing: true });
            try {
              const result = await engine().syncOnLogin(get().mergedFor !== userId);
              // Only record the merge if the same user is still signed in.
              if (result.ok && useAuthStore.getState().user?.id === userId) {
                set({ mergedFor: userId, activeListId: DEFAULT_LIST_ID });
              }
            } finally {
              useWatchlistSyncState.setState({ syncing: false });
              syncing.delete(userId);
            }
          })();
          syncing.set(userId, p);
          return p;
        },

        refreshFromServer: async () => {
          const uid = useAuthStore.getState().user?.id;
          if (!uid || useAuthStore.getState().status !== 'authenticated' || get().mergedFor !== uid) return;
          await engine().pull();
        },

        getActiveItems: () => {
          const { lists, activeListId } = get();
          return lists.find((l) => l.id === activeListId)?.items ?? [];
        },
      };
    },
    {
      name: 'mkmovies-watchlist',
      version: WATCHLIST_VERSION,
      skipHydration: true,
      partialize: (s) => ({ lists: s.lists, activeListId: s.activeListId, mergedFor: s.mergedFor }),
      migrate: (persisted, version) => {
        const mergedFor = (persisted as { mergedFor?: unknown } | null)?.mergedFor;
        return { ...migrateWatchlist(persisted, version), mergedFor: typeof mergedFor === 'string' ? mergedFor : null };
      },
    },
  ),
);

// ── Watchlist selector hooks (subscribe to a single boolean / number) ────────

const EMPTY_ITEMS: WatchlistItem[] = [];

function activeItems(s: Pick<WatchlistStore, 'lists' | 'activeListId'>): WatchlistItem[] {
  return s.lists.find((l) => l.id === s.activeListId)?.items ?? EMPTY_ITEMS;
}

/** Re-renders only when this one title's saved state flips. */
export function useIsInWatchlist(id: number, mediaType: MediaType): boolean {
  return useWatchlistStore((s) => activeItems(s).some((i) => matchesItem(i, id, mediaType)));
}

/** Count of items in the active list. */
export function useWatchlistCount(): number {
  return useWatchlistStore((s) => activeItems(s).length);
}

/** Stable reference to the toggle action (never triggers re-renders). */
export function useWatchlistToggle(): WatchlistStore['toggle'] {
  return useWatchlistStore((s) => s.toggle);
}

/** Items in the active list (re-renders when that array changes). */
export function useActiveWatchlistItems(): WatchlistItem[] {
  return useWatchlistStore(activeItems);
}

// ── Reviews Store (legacy) ──────────────────────────────────────────────────
// Reviews are server-backed now (`/api/reviews`, see src/lib/sync/reviews.ts and
// ReviewSection). This local store is no longer read by the UI; it is kept so old
// localStorage data is still wiped on logout and for backward compatibility.
interface ReviewsStore {
  reviews: LocalReview[];
  addReview: (review: Omit<LocalReview, 'id' | 'createdAt' | 'updatedAt' | 'likes'>) => void;
  updateReview: (id: string, updates: Partial<LocalReview>) => void;
  deleteReview: (id: string) => void;
  likeReview: (id: string) => void;
  getMovieReviews: (movieId: number) => LocalReview[];
  reset: () => void;
}

export const useReviewsStore = create<ReviewsStore>()(
  persist(
    (set, get) => ({
      reviews: [],
      addReview: (review) =>
        set((s) => ({
          reviews: [
            {
              ...review,
              id: `review_${Date.now()}_${Math.random().toString(36).slice(2)}`,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              likes: 0,
            },
            ...s.reviews,
          ],
        })),
      updateReview: (id, updates) =>
        set((s) => ({
          reviews: s.reviews.map((r) => (r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r)),
        })),
      deleteReview: (id) => set((s) => ({ reviews: s.reviews.filter((r) => r.id !== id) })),
      likeReview: (id) =>
        set((s) => ({
          reviews: s.reviews.map((r) => (r.id === id ? { ...r, likes: r.likes + 1 } : r)),
        })),
      getMovieReviews: (movieId) => get().reviews.filter((r) => r.movieId === movieId),
      reset: () => set({ reviews: [] }),
    }),
    { name: 'mkmovies-reviews', skipHydration: true, partialize: (s) => ({ reviews: s.reviews }) },
  ),
);

// ── UI Store (not persisted) ────────────────────────────────────────────────
export type AuthTab = 'login' | 'signup';

interface UIStore {
  /** Command palette open state (was the inline header search). */
  searchOpen: boolean;
  mobileMenuOpen: boolean;
  authOpen: boolean;
  authTab: AuthTab;
  setSearchOpen: (v: boolean) => void;
  setMobileMenuOpen: (v: boolean) => void;
  openAuth: (tab?: AuthTab) => void;
  closeAuth: () => void;
}

export const useUIStore = create<UIStore>()((set) => ({
  searchOpen: false,
  mobileMenuOpen: false,
  authOpen: false,
  authTab: 'login',
  setSearchOpen: (v) => set({ searchOpen: v }),
  setMobileMenuOpen: (v) => set({ mobileMenuOpen: v }),
  openAuth: (tab = 'login') => set({ authOpen: true, authTab: tab }),
  closeAuth: () => set({ authOpen: false }),
}));

/** Open the sign-in dialog from anywhere (also reachable via the legacy `mkmovies:openAuth` window event). */
export const openAuth = (tab: AuthTab = 'login') => useUIStore.getState().openAuth(tab);
/** Open the command palette from anywhere. */
export const openSearch = () => useUIStore.getState().setSearchOpen(true);

// ── Ratings Store (private, local "Your rating") ────────────────────────────
// Keyed by `${media_type}:${id}` (movie 1399 ≠ tv 1399). Values are 1..10 (5 stars × 2).
// Ratings never leave the device; the UI labels them as private.

export const ratingKey = (id: number, mediaType: MediaType = 'movie') => `${mediaType}:${id}`;

interface RatingsStore {
  ratings: Record<string, number>;
  rate: (id: number, rating: number, mediaType?: MediaType) => void;
  clearRating: (id: number, mediaType?: MediaType) => void;
  getRating: (id: number, mediaType?: MediaType) => number | null;
  reset: () => void;
}

/** v0 stored `{ [movieId]: rating }`: move to keyed `movie:<id>`. */
export function migrateRatings(persisted: unknown, version: number): { ratings: Record<string, number> } {
  const raw = ((persisted ?? {}) as { ratings?: unknown }).ratings;
  const out: Record<string, number> = {};
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v !== 'number' || !Number.isFinite(v)) continue;
      const rating = Math.min(10, Math.max(1, Math.round(v)));
      if (version < 1 && /^\d+$/.test(k)) out[`movie:${k}`] = rating;
      else if (/^(movie|tv):\d+$/.test(k)) out[k] = rating;
    }
  }
  return { ratings: out };
}

export const useRatingsStore = create<RatingsStore>()(
  persist(
    (set, get) => ({
      ratings: {},
      rate: (id, rating, mediaType = 'movie') =>
        set((s) => ({ ratings: { ...s.ratings, [ratingKey(id, mediaType)]: Math.min(10, Math.max(1, Math.round(rating))) } })),
      clearRating: (id, mediaType = 'movie') =>
        set((s) => {
          const next = { ...s.ratings };
          delete next[ratingKey(id, mediaType)];
          return { ratings: next };
        }),
      getRating: (id, mediaType = 'movie') => get().ratings[ratingKey(id, mediaType)] ?? null,
      reset: () => set({ ratings: {} }),
    }),
    {
      name: 'mkmovies-ratings',
      version: 1,
      skipHydration: true,
      partialize: (s) => ({ ratings: s.ratings }),
      migrate: (persisted, version) => migrateRatings(persisted, version),
    },
  ),
);

/** The user's own rating (1..10) for one title (re-renders only when it changes). */
export function useUserRating(id: number, mediaType: MediaType = 'movie'): number | null {
  return useRatingsStore((s) => s.ratings[ratingKey(id, mediaType)] ?? null);
}
