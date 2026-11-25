'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FollowedPerson } from '@/types/tmdb';
import { followsApi } from '@/lib/sync/follows';
import { friendlyError } from '@/lib/sync/http';
import { toast } from './toastStore';

/**
 * People the signed-in user follows. Server-backed (`/api/follows`): follow / unfollow
 * update the list optimistically and roll back with a toast when the request fails.
 * The persisted copy is only a cache for a fast first paint; `hydrate()` replaces it.
 */
interface FollowingStore {
  following: FollowedPerson[];
  /** personId → follower count (public). */
  counts: Record<number, number>;

  /** Resolves true when the server accepted the follow. */
  follow: (person: Omit<FollowedPerson, 'followedAt'>) => Promise<boolean>;
  unfollow: (personId: number) => Promise<boolean>;
  isFollowing: (personId: number) => boolean;
  setCount: (personId: number, count: number) => void;
  setCounts: (counts: Record<number, number>) => void;
  /** Fetch public follower counts for these ids (≤100, cached in `counts`). */
  loadCounts: (ids: number[]) => Promise<void>;
  /** Replace the list with the server's. */
  hydrate: () => Promise<void>;
  reset: () => void;
}

const bump = (counts: Record<number, number>, id: number, delta: number) =>
  id in counts ? { ...counts, [id]: Math.max(0, counts[id] + delta) } : counts;

export const useFollowingStore = create<FollowingStore>()(
  persist(
    (set, get) => ({
      following: [],
      counts: {},

      follow: async (person) => {
        if (get().isFollowing(person.id)) return true;
        const entry: FollowedPerson = { ...person, followedAt: new Date().toISOString() };
        set((s) => ({ following: [entry, ...s.following], counts: bump(s.counts, person.id, 1) }));
        try {
          const count = await followsApi.follow(person);
          if (count !== null) set((s) => ({ counts: { ...s.counts, [person.id]: count } }));
          return true;
        } catch (err) {
          set((s) => ({
            following: s.following.filter((f) => f.id !== person.id),
            counts: bump(s.counts, person.id, -1),
          }));
          toast({ title: `Couldn't follow ${person.name}`, description: friendlyError(err), tone: 'danger' });
          return false;
        }
      },

      unfollow: async (personId) => {
        const prev = get().following.find((f) => f.id === personId);
        if (!prev) return true;
        set((s) => ({ following: s.following.filter((f) => f.id !== personId), counts: bump(s.counts, personId, -1) }));
        try {
          const count = await followsApi.unfollow(personId);
          if (count !== null) set((s) => ({ counts: { ...s.counts, [personId]: count } }));
          return true;
        } catch (err) {
          set((s) => ({
            following: s.following.some((f) => f.id === personId) ? s.following : [prev, ...s.following],
            counts: bump(s.counts, personId, 1),
          }));
          toast({ title: `Couldn't unfollow ${prev.name}`, description: friendlyError(err), tone: 'danger' });
          return false;
        }
      },

      isFollowing: (personId) => get().following.some((f) => f.id === personId),

      setCount: (personId, count) => set((s) => ({ counts: { ...s.counts, [personId]: count } })),

      setCounts: (counts) => set((s) => ({ counts: { ...s.counts, ...counts } })),

      loadCounts: async (ids) => {
        try {
          const counts = await followsApi.counts(ids);
          if (Object.keys(counts).length) set((s) => ({ counts: { ...s.counts, ...counts } }));
        } catch {
          /* counts are decorative */
        }
      },

      hydrate: async () => {
        try {
          const following = await followsApi.list();
          set({ following });
        } catch {
          /* offline / DB down: keep the cached copy */
        }
      },

      reset: () => set({ following: [], counts: {} }),
    }),
    {
      name: 'mkmovies-following',
      skipHydration: true,
      partialize: (s) => ({ following: s.following, counts: s.counts }),
    },
  ),
);

/** Re-renders only when this person's followed state flips. */
export const useIsFollowing = (personId: number) => useFollowingStore((s) => s.following.some((f) => f.id === personId));
/** Follower count for one person (undefined until loaded). */
export const useFollowerCount = (personId: number) => useFollowingStore((s) => s.counts[personId]);
