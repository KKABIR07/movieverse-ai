'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WatchlistItem, LocalReview } from '@/types/tmdb';

// ── Watchlist Store (multi-list) ──────────────────────────────────────────────

export interface WatchlistList {
  id: string;
  name: string;
  items: WatchlistItem[];
  createdAt: string;
}

function makeId() {
  return `list_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

const DEFAULT_ID = 'default';

function defaultList(items: WatchlistItem[] = []): WatchlistList {
  return { id: DEFAULT_ID, name: 'My Watchlist', items, createdAt: new Date().toISOString() };
}

interface WatchlistStore {
  lists: WatchlistList[];
  activeListId: string;

  // List management
  createList: (name: string) => string;
  renameList: (listId: string, name: string) => void;
  deleteList: (listId: string) => void;
  setActiveList: (listId: string) => void;

  // Item helpers — operate on the active list
  add: (item: Omit<WatchlistItem, 'addedAt'>) => void;
  addToList: (listId: string, item: Omit<WatchlistItem, 'addedAt'>) => void;
  remove: (itemId: number) => void;
  removeFromList: (listId: string, itemId: number) => void;
  has: (itemId: number) => boolean;
  hasInAny: (itemId: number) => boolean;
  clear: () => void;

  // Convenience for share page
  getActiveItems: () => WatchlistItem[];
}

export const useWatchlistStore = create<WatchlistStore>()(
  persist(
    (set, get) => ({
      lists: [defaultList()],
      activeListId: DEFAULT_ID,

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
          const nextActive = next.find((l) => l.id === s.activeListId)
            ? s.activeListId
            : next[0].id;
          return { lists: next, activeListId: nextActive };
        }),

      setActiveList: (listId) => set({ activeListId: listId }),

      add: (item) => {
        const { activeListId } = get();
        set((s) => ({
          lists: s.lists.map((l) =>
            l.id !== activeListId
              ? l
              : l.items.some((i) => i.id === item.id)
              ? l
              : { ...l, items: [{ ...item, addedAt: new Date().toISOString() }, ...l.items] }
          ),
        }));
      },

      addToList: (listId, item) =>
        set((s) => ({
          lists: s.lists.map((l) =>
            l.id !== listId
              ? l
              : l.items.some((i) => i.id === item.id)
              ? l
              : { ...l, items: [{ ...item, addedAt: new Date().toISOString() }, ...l.items] }
          ),
        })),

      remove: (itemId) => {
        const { activeListId } = get();
        set((s) => ({
          lists: s.lists.map((l) =>
            l.id !== activeListId ? l : { ...l, items: l.items.filter((i) => i.id !== itemId) }
          ),
        }));
      },

      removeFromList: (listId, itemId) =>
        set((s) => ({
          lists: s.lists.map((l) =>
            l.id !== listId ? l : { ...l, items: l.items.filter((i) => i.id !== itemId) }
          ),
        })),

      has: (itemId) => {
        const { lists, activeListId } = get();
        return lists.find((l) => l.id === activeListId)?.items.some((i) => i.id === itemId) ?? false;
      },

      hasInAny: (itemId) => get().lists.some((l) => l.items.some((i) => i.id === itemId)),

      clear: () => {
        const { activeListId } = get();
        set((s) => ({
          lists: s.lists.map((l) => (l.id !== activeListId ? l : { ...l, items: [] })),
        }));
      },

      getActiveItems: () => {
        const { lists, activeListId } = get();
        return lists.find((l) => l.id === activeListId)?.items ?? [];
      },
    }),
    {
      name: 'movieverse-watchlist',
      version: 2,
      migrate: (persisted: unknown, version: number) => {
        if (version < 2) {
          // Migrate old flat { items: WatchlistItem[] } shape
          const old = persisted as { items?: WatchlistItem[] };
          return {
            lists: [defaultList(old?.items ?? [])],
            activeListId: DEFAULT_ID,
          };
        }
        return persisted as { lists: WatchlistList[]; activeListId: string };
      },
    }
  )
);

// Reviews Store
interface ReviewsStore {
  reviews: LocalReview[];
  addReview: (review: Omit<LocalReview, 'id' | 'createdAt' | 'updatedAt' | 'likes'>) => void;
  updateReview: (id: string, updates: Partial<LocalReview>) => void;
  deleteReview: (id: string) => void;
  likeReview: (id: string) => void;
  getMovieReviews: (movieId: number) => LocalReview[];
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
          reviews: s.reviews.map((r) =>
            r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r
          ),
        })),
      deleteReview: (id) => set((s) => ({ reviews: s.reviews.filter((r) => r.id !== id) })),
      likeReview: (id) =>
        set((s) => ({
          reviews: s.reviews.map((r) => (r.id === id ? { ...r, likes: r.likes + 1 } : r)),
        })),
      getMovieReviews: (movieId) => get().reviews.filter((r) => r.movieId === movieId),
    }),
    { name: 'movieverse-reviews' }
  )
);

// UI Store
interface UIStore {
  searchOpen: boolean;
  mobileMenuOpen: boolean;
  setSearchOpen: (v: boolean) => void;
  setMobileMenuOpen: (v: boolean) => void;
}

export const useUIStore = create<UIStore>()((set) => ({
  searchOpen: false,
  mobileMenuOpen: false,
  setSearchOpen: (v) => set({ searchOpen: v }),
  setMobileMenuOpen: (v) => set({ mobileMenuOpen: v }),
}));

// Ratings Store (local star ratings per movie)
interface RatingsStore {
  ratings: Record<number, number>;
  rate: (movieId: number, rating: number) => void;
  getRating: (movieId: number) => number | null;
}

export const useRatingsStore = create<RatingsStore>()(
  persist(
    (set, get) => ({
      ratings: {},
      rate: (movieId, rating) =>
        set((s) => ({ ratings: { ...s.ratings, [movieId]: rating } })),
      getRating: (movieId) => get().ratings[movieId] ?? null,
    }),
    { name: 'movieverse-ratings' }
  )
);
