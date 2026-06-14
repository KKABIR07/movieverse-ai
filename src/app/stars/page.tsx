'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Search, Users, X, ChevronDown, Loader2 } from 'lucide-react';
import { tmdb, tmdbImage } from '@/lib/tmdb';
import { useFollowingStore } from '@/store/followingStore';
import { FollowButton } from '@/components/people/FollowButton';
import type { Person } from '@/types/tmdb';

function formatFollowers(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export default function StarsPage() {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [allPeople, setAllPeople] = useState<Person[]>([]);
  const { counts, setCounts } = useFollowingStore();
  const prevQueryRef = useRef('');

  // Trending (paginated)
  const { data: trendingData, isLoading: loadingTrending, isFetching } = useQuery({
    queryKey: ['trending-people-page', page],
    queryFn: () => tmdb.person.trending('week', page),
    staleTime: 10 * 60 * 1000,
    enabled: query.trim().length <= 1,
  });

  // Search
  const { data: searchData, isLoading: loadingSearch } = useQuery({
    queryKey: ['search', 'person', query],
    queryFn: () => tmdb.search.person(query),
    enabled: query.trim().length > 1,
    staleTime: 60 * 1000,
  });

  // Accumulate trending pages; reset on query change
  useEffect(() => {
    if (query.trim().length > 1) return; // search mode — don't accumulate
    if (!trendingData?.results) return;
    if (page === 1) {
      setAllPeople(trendingData.results);
    } else {
      setAllPeople((prev) => {
        const ids = new Set(prev.map((p) => p.id));
        const fresh = trendingData.results.filter((p) => !ids.has(p.id));
        return [...prev, ...fresh];
      });
    }
  }, [trendingData, page, query]);

  // Reset to page 1 when search is cleared
  useEffect(() => {
    const wasSearching = prevQueryRef.current.trim().length > 1;
    const isSearching  = query.trim().length > 1;
    if (wasSearching && !isSearching) {
      setPage(1);
      setAllPeople([]);
    }
    prevQueryRef.current = query;
  }, [query]);

  const isSearching = query.trim().length > 1;
  const people: Person[] = isSearching
    ? (searchData?.results ?? [])
    : allPeople;

  const isLoading = isSearching ? loadingSearch : (loadingTrending && page === 1);
  const hasMore   = !isSearching && (trendingData?.total_pages ?? 1) > page;

  // Fetch follower counts whenever people list changes
  useEffect(() => {
    if (!people.length) return;
    const ids = people.map((p) => p.id).join(',');
    fetch(`/api/follows/counts?ids=${ids}`)
      .then((r) => r.json())
      .then(({ counts: c }) => { if (c) setCounts(c); })
      .catch(() => {});
  }, [people.map((p) => p.id).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen pt-20 pb-16">
      <div className="container mx-auto px-4 md:px-8">

        {/* Header */}
        <div className="mt-6 mb-8 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-black text-[var(--text-primary)]">⭐ Trending Stars</h1>
            <p className="text-[var(--text-muted)] text-sm mt-1">
              {isSearching ? `Results for "${query}"` : `${allPeople.length} stars · Most popular this week`}
            </p>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative mb-8 max-w-lg">
          <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search actors, directors, actresses…"
            className="w-full bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--accent-primary)] rounded-2xl pl-11 pr-10 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-colors shadow-sm"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-[var(--bg-hover)] text-[var(--text-muted)] transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="animate-pulse space-y-3">
                <div className="rounded-2xl bg-[var(--bg-card)] aspect-[3/4]" />
                <div className="h-3 bg-[var(--bg-card)] rounded w-3/4 mx-auto" />
                <div className="h-3 bg-[var(--bg-card)] rounded w-1/2 mx-auto" />
              </div>
            ))}
          </div>
        ) : people.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-5xl mb-4">🔍</p>
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">No results found</h3>
            <p className="text-sm text-[var(--text-muted)]">Try a different name</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
              {people.map((person, i) => {
                const followerCount = counts[person.id] ?? 0;
                return (
                  <div key={person.id} className="group">
                    <Link href={`/person/${person.id}`} className="block">
                      <div className="relative rounded-2xl overflow-hidden aspect-[3/4] bg-[var(--bg-card)] ring-1 ring-white/5 group-hover:ring-[var(--accent-primary)]/40 transition-all shadow-lg">
                        {person.profile_path ? (
                          <Image
                            src={tmdbImage(person.profile_path, 'w342')}
                            alt={person.name}
                            fill
                            className="object-cover object-top transition-transform duration-500 group-hover:scale-105"
                            sizes="(max-width:640px) 50vw,(max-width:1024px) 33vw,20vw"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-4xl bg-[var(--bg-secondary)]">👤</div>
                        )}

                        {/* Rank badge (trending mode only) */}
                        {!isSearching && (
                          <div className="absolute top-2.5 left-2.5 w-6 h-6 rounded-full bg-[var(--accent-primary)] flex items-center justify-center text-[11px] font-black text-white shadow-lg">
                            {i + 1}
                          </div>
                        )}

                        {/* Bottom overlay */}
                        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
                        <div className="absolute bottom-0 inset-x-0 p-3 space-y-1.5">
                          {followerCount > 0 && (
                            <div className="flex items-center gap-1">
                              <Users size={10} className="text-violet-400" />
                              <span className="text-[10px] font-bold text-violet-300">
                                {formatFollowers(followerCount)} followers
                              </span>
                            </div>
                          )}
                          <div className="flex flex-wrap gap-0.5">
                            {(person.known_for ?? []).slice(0, 2).map((k) => (
                              <span key={k.id} className="text-[9px] text-white/50 bg-white/10 px-1.5 py-0.5 rounded-full">
                                {k.title ?? k.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <p className="text-sm font-semibold text-[var(--text-primary)] mt-2.5 line-clamp-1 group-hover:text-[var(--accent-primary)] transition-colors text-center">
                        {person.name}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] text-center mt-0.5">
                        {person.known_for_department === 'Directing' ? '🎬 Director' : '🎭 Actor'}
                      </p>
                    </Link>

                    <div className="flex justify-center mt-2">
                      <FollowButton
                        person={{ id: person.id, name: person.name, profile_path: person.profile_path, known_for_department: person.known_for_department }}
                        size="sm"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Load More */}
            {!isSearching && hasMore && (
              <div className="mt-12 flex justify-center">
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={isFetching}
                  className="flex items-center gap-2.5 px-8 py-3.5 rounded-2xl border border-[var(--accent-primary)]/40 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] font-semibold text-sm hover:bg-[var(--accent-primary)]/20 hover:border-[var(--accent-primary)]/70 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isFetching ? (
                    <><Loader2 size={16} className="animate-spin" /> Loading…</>
                  ) : (
                    <><ChevronDown size={16} /> Load More Stars</>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
