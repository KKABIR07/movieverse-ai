'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WatchlistItem, LocalReview } from '@/types/tmdb';
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

// ── Watchlist Store (multi-list, keyed by `${media_type}:${id}`) ─────────────

function makeId() {
  return `list_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

interface WatchlistStore {
  lists: WatchlistList[];
  activeListId: string;

  // List management
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

  getActiveItems: () => WatchlistItem[];
}

const mapList = (lists: WatchlistList[], listId: string, fn: (items: WatchlistItem[]) => WatchlistItem[]) =>
  lists.map((l) => (l.id !== listId ? l : { ...l, items: fn(l.items) }));

export const useWatchlistStore = create<WatchlistStore>()(
  persist(
    (set, get) => ({
      lists: [defaultList()],
      activeListId: DEFAULT_LIST_ID,

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

      add: (item) => set((s) => ({ lists: mapList(s.lists, s.activeListId, (items) => addItem(items, item)) })),

      addToList: (listId, item) => set((s) => ({ lists: mapList(s.lists, listId, (items) => addItem(items, item)) })),

      remove: (itemId, mediaType) =>
        set((s) => ({ lists: mapList(s.lists, s.activeListId, (items) => removeItem(items, itemId, mediaType)) })),

      removeFromList: (listId, itemId, mediaType) =>
        set((s) => ({ lists: mapList(s.lists, listId, (items) => removeItem(items, itemId, mediaType)) })),

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

      clear: () => set((s) => ({ lists: mapList(s.lists, s.activeListId, () => []) })),

      reset: () => set({ lists: [defaultList()], activeListId: DEFAULT_LIST_ID }),

      getActiveItems: () => {
        const { lists, activeListId } = get();
        return lists.find((l) => l.id === activeListId)?.items ?? [];
      },
    }),
    {
      name: 'mkmovies-watchlist',
      version: WATCHLIST_VERSION,
      skipHydration: true,
      partialize: (s) => ({ lists: s.lists, activeListId: s.activeListId }),
      migrate: (persisted, version) => migrateWatchlist(persisted, version),
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

// ── Reviews Store ───────────────────────────────────────────────────────────
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

// ── Ratings Store (local star ratings per movie) ────────────────────────────
interface RatingsStore {
  ratings: Record<number, number>;
  rate: (movieId: number, rating: number) => void;
  getRating: (movieId: number) => number | null;
  reset: () => void;
}

export const useRatingsStore = create<RatingsStore>()(
  persist(
    (set, get) => ({
      ratings: {},
      rate: (movieId, rating) => set((s) => ({ ratings: { ...s.ratings, [movieId]: rating } })),
      getRating: (movieId) => get().ratings[movieId] ?? null,
      reset: () => set({ ratings: {} }),
    }),
    { name: 'mkmovies-ratings', skipHydration: true, partialize: (s) => ({ ratings: s.ratings }) },
  ),
);

/** The user's own rating for one title (re-renders only when it changes). */
export function useUserRating(movieId: number): number | null {
  return useRatingsStore((s) => s.ratings[movieId] ?? null);
}
