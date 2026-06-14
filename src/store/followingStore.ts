'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FollowedPerson } from '@/types/tmdb';

interface FollowingStore {
  following: FollowedPerson[];
  counts: Record<number, number>;   // personId → follower count

  follow: (person: Omit<FollowedPerson, 'followedAt'>) => Promise<void>;
  unfollow: (personId: number) => Promise<void>;
  isFollowing: (personId: number) => boolean;
  setCount: (personId: number, count: number) => void;
  setCounts: (counts: Record<number, number>) => void;
  hydrate: () => Promise<void>;
  reset: () => void;
}

export const useFollowingStore = create<FollowingStore>()(
  persist(
    (set, get) => ({
      following: [],
      counts: {},

      follow: async (person) => {
        set((s) => ({
          following: s.following.some((f) => f.id === person.id)
            ? s.following
            : [{ ...person, followedAt: new Date().toISOString() }, ...s.following],
        }));
        try {
          const res = await fetch('/api/follows', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              personId: person.id,
              personName: person.name,
              personImage: person.profile_path,
              department: person.known_for_department,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            set((s) => ({ counts: { ...s.counts, [person.id]: data.followerCount } }));
          }
        } catch { /* optimistic — local state already updated */ }
      },

      unfollow: async (personId) => {
        set((s) => ({ following: s.following.filter((f) => f.id !== personId) }));
        try {
          const res = await fetch('/api/follows', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ personId }),
          });
          if (res.ok) {
            const data = await res.json();
            set((s) => ({ counts: { ...s.counts, [personId]: data.followerCount } }));
          }
        } catch { /* optimistic */ }
      },

      isFollowing: (personId) => get().following.some((f) => f.id === personId),

      setCount: (personId, count) =>
        set((s) => ({ counts: { ...s.counts, [personId]: count } })),

      setCounts: (counts) =>
        set((s) => ({ counts: { ...s.counts, ...counts } })),

      hydrate: async () => {
        try {
          const res = await fetch('/api/follows');
          if (!res.ok) return;
          const { following } = await res.json();
          const mapped: FollowedPerson[] = (following ?? []).map((f: {
            personId: number; personName: string; personImage: string | null;
            department: string; followedAt: string;
          }) => ({
            id: f.personId,
            name: f.personName,
            profile_path: f.personImage,
            known_for_department: f.department,
            followedAt: f.followedAt,
          }));
          set({ following: mapped });
        } catch { /* offline */ }
      },

      reset: () => set({ following: [], counts: {} }),
    }),
    { name: 'mkmovies-following' }
  )
);
