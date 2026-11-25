'use client';

import { useQueries } from '@tanstack/react-query';
import { tmdb } from '@/lib/tmdb';
import type { FollowedPerson, Person } from '@/types/tmdb';
import { buildFilmography, type Filmography } from './credits';

/** At most this many people are loaded at once (each is one cached TMDB request via /api/tmdb). */
export const MAX_FEED_PEOPLE = 40;

export interface FollowedCredits {
  person: FollowedPerson;
  film: Filmography | null;
  isLoading: boolean;
  isError: boolean;
}

/** Filmography per Person payload, cached by object identity (query data is referentially stable). */
const filmCache = new WeakMap<Person, Filmography>();
function filmOf(p: Person): Filmography {
  let f = filmCache.get(p);
  if (!f) {
    f = buildFilmography(p, 12);
    filmCache.set(p, f);
  }
  return f;
}

/** Filmography for each followed person (shares the ['person', id] cache with other pages). */
export function useFollowedCredits(following: readonly FollowedPerson[]): FollowedCredits[] {
  const people = following.slice(0, MAX_FEED_PEOPLE);
  const results = useQueries({
    queries: people.map((p) => ({
      queryKey: ['person', p.id],
      queryFn: () => tmdb.person.detail(p.id),
      staleTime: 30 * 60 * 1000,
      retry: 1,
    })),
  });
  return people.map((person, i) => {
    const r = results[i];
    return {
      person,
      film: r?.data ? filmOf(r.data) : null,
      isLoading: !!r?.isPending,
      isError: !!r?.isError,
    };
  });
}
