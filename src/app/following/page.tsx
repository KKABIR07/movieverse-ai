'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Users, LogIn, Star, UserMinus, Clapperboard, Search, X, ChevronRight } from 'lucide-react';
import { useFollowingStore } from '@/store/followingStore';
import { useAuthStore } from '@/store/authStore';
import { FollowButton } from '@/components/people/FollowButton';
import { tmdb, tmdbImage, formatYear } from '@/lib/tmdb';
import type { FollowedPerson } from '@/types/tmdb';

function formatFollowers(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

type Tab = 'all' | 'actors' | 'directors';

// ── Person row ─────────────────────────────────────────────────────────────────
function PersonRow({ person }: { person: FollowedPerson }) {
  const { counts, unfollow } = useFollowingStore();
  const followerCount = counts[person.id] ?? 0;

  const { data } = useQuery({
    queryKey: ['person', person.id],
    queryFn: () => tmdb.person.detail(person.id),
    staleTime: 10 * 60 * 1000,
  });

  const works = (data?.combined_credits?.cast ?? [])
    .filter((c) => c.poster_path)
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 10);

  return (
    <div className="border-b border-[var(--border)] pb-7 mb-7 last:border-b-0 last:mb-0">
      <div className="flex items-center justify-between mb-4 gap-3">
        <Link href={`/person/${person.id}`} className="flex items-center gap-3 group min-w-0">
          <div className="relative rounded-full overflow-hidden ring-1 ring-white/10 group-hover:ring-[var(--accent-primary)]/50 transition-all flex-shrink-0"
            style={{ width: 52, height: 52 }}>
            {person.profile_path
              ? <Image src={tmdbImage(person.profile_path, 'w92')} alt={person.name} fill className="object-cover object-top" sizes="52px" />
              : <div className="absolute inset-0 bg-[var(--bg-card)] flex items-center justify-center">👤</div>}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors line-clamp-1 text-sm">
              {person.name}
            </p>
            <div className="flex items-center gap-2 flex-wrap mt-0.5">
              <span className="text-xs text-[var(--text-muted)]">
                {person.known_for_department === 'Directing' ? '🎬 Director' : '🎭 Actor'}
              </span>
              {followerCount > 0 && (
                <span className="text-xs text-violet-400 font-semibold flex items-center gap-1">
                  <Users size={10} />{formatFollowers(followerCount)}
                </span>
              )}
            </div>
          </div>
        </Link>
        <div className="flex items-center gap-2 flex-shrink-0">
          <FollowButton
            person={{ id: person.id, name: person.name, profile_path: person.profile_path, known_for_department: person.known_for_department }}
            size="sm"
          />
          <Link href={`/person/${person.id}`} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <ChevronRight size={15} />
          </Link>
        </div>
      </div>

      {works.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {works.map((film) => (
            <Link key={`${film.id}-${film.character ?? ''}`} href={`/${film.media_type ?? 'movie'}/${film.id}`}
              className="group/film flex-shrink-0" style={{ width: 88 }}>
              <div className="relative rounded-xl overflow-hidden aspect-[2/3] bg-[var(--bg-card)] ring-1 ring-white/5 group-hover/film:ring-[var(--accent-primary)]/40 transition-all group-hover/film:-translate-y-1">
                <Image src={tmdbImage(film.poster_path ?? null, 'w185')} alt={film.title ?? ''} fill className="object-cover" sizes="88px" />
                {(film.vote_average ?? 0) > 0 && (
                  <div className="absolute top-1.5 left-1.5 flex items-center gap-0.5 bg-black/70 backdrop-blur-sm rounded px-1 py-0.5">
                    <Star size={7} className="text-amber-400 fill-current" />
                    <span className="text-[9px] font-bold text-white">{(film.vote_average ?? 0).toFixed(1)}</span>
                  </div>
                )}
              </div>
              <p className="text-[10px] font-medium text-[var(--text-primary)] mt-1.5 line-clamp-1 group-hover/film:text-[var(--accent-primary)] transition-colors">
                {film.title}
              </p>
              {film.release_date && <p className="text-[9px] text-[var(--text-muted)]">{formatYear(film.release_date)}</p>}
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 rounded-xl bg-[var(--bg-card)] animate-pulse" style={{ width: 88, aspectRatio: '2/3' }} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function FollowingPage() {
  const { following, counts, setCounts } = useFollowingStore();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!following.length) return;
    const ids = following.map((f) => f.id).join(',');
    fetch(`/api/follows/counts?ids=${ids}`)
      .then((r) => r.json())
      .then(({ counts: c }) => { if (c) setCounts(c); })
      .catch(() => {});
  }, [following, setCounts]);

  const openAuth = () =>
    window.dispatchEvent(new CustomEvent('movieverse:openAuth', { detail: { tab: 'login' } }));

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 pt-20">
        <div className="w-16 h-16 rounded-2xl bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 flex items-center justify-center mb-5">
          <Users size={30} className="text-[var(--accent-primary)]" />
        </div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Sign in to follow people</h1>
        <p className="text-[var(--text-muted)] max-w-sm mb-6">Follow your favourite actors, actresses, and directors.</p>
        <button onClick={openAuth} className="flex items-center gap-2 px-6 py-3 bg-[var(--accent-primary)] text-white font-semibold rounded-xl hover:bg-[var(--accent-secondary)] transition-colors">
          <LogIn size={18} /> Sign In Free
        </button>
      </div>
    );
  }

  const TABS = [
    { key: 'all'       as Tab, label: 'All',       filter: (_: FollowedPerson) => true },
    { key: 'actors'    as Tab, label: '🎭 Actors',   filter: (p: FollowedPerson) => p.known_for_department !== 'Directing' },
    { key: 'directors' as Tab, label: '🎬 Directors', filter: (p: FollowedPerson) => p.known_for_department === 'Directing' },
  ];

  const q = query.trim().toLowerCase();
  const filtered = following
    .filter(TABS.find((t) => t.key === activeTab)!.filter)
    .filter((p) => !q || p.name.toLowerCase().includes(q));

  if (following.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 pt-20">
        <Clapperboard size={48} className="text-[var(--accent-primary)] mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">No one followed yet</h1>
        <p className="text-[var(--text-muted)] max-w-sm mb-6">Browse trending stars and follow people you love.</p>
        <Link href="/stars" className="px-5 py-2.5 bg-[var(--accent-primary)] text-white font-semibold rounded-xl hover:bg-[var(--accent-secondary)] transition-colors text-sm">
          Discover Stars →
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-16">
      <div className="container mx-auto px-4 md:px-8">

        <div className="mt-6 mb-8 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-black text-[var(--text-primary)] flex items-center gap-3">
              <Users size={26} className="text-[var(--accent-primary)]" /> Following
            </h1>
            <p className="text-[var(--text-muted)] mt-1 text-sm">{following.length} {following.length === 1 ? 'person' : 'people'}</p>
          </div>
          <Link href="/stars" className="text-sm text-[var(--accent-primary)] hover:underline font-medium">+ Discover Stars</Link>
        </div>

        {/* Search */}
        <div className="relative mb-6 max-w-lg">
          <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search who you follow…"
            className="w-full bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--accent-primary)] rounded-2xl pl-11 pr-10 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-colors"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-[var(--bg-hover)] text-[var(--text-muted)] transition-colors">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-8 bg-[var(--bg-secondary)] rounded-2xl p-1.5 w-fit">
          {TABS.map((tab) => {
            const count = following.filter(tab.filter).length;
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === tab.key
                    ? 'bg-[var(--accent-primary)] text-white shadow-[0_0_12px_rgba(124,58,237,0.3)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                }`}>
                {tab.label}
                <span className={`text-[10px] font-black rounded-full px-1.5 py-0.5 ${activeTab === tab.key ? 'bg-white/20' : 'bg-[var(--bg-hover)]'}`}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Avatar shelf */}
        <div className="glass rounded-2xl p-4 mb-8 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <div className="flex gap-4">
            {filtered.map((p) => (
              <Link key={p.id} href={`/person/${p.id}`} className="group flex-shrink-0 flex flex-col items-center gap-1.5">
                <div className="relative rounded-full overflow-hidden ring-2 ring-[var(--accent-primary)]/30 group-hover:ring-[var(--accent-primary)] transition-all" style={{ width: 44, height: 44 }}>
                  {p.profile_path
                    ? <Image src={tmdbImage(p.profile_path, 'w92')} alt={p.name} fill className="object-cover object-top" sizes="44px" />
                    : <div className="absolute inset-0 bg-[var(--bg-card)] flex items-center justify-center">👤</div>}
                </div>
                <span className="text-[9px] text-[var(--text-muted)] line-clamp-1 max-w-[44px] text-center">{p.name.split(' ')[0]}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Feed */}
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-[var(--text-muted)] text-sm">
              {q ? `No results for "${query}"` : `No ${activeTab === 'directors' ? 'directors' : 'actors'} followed yet.`}
            </p>
          </div>
        ) : (
          <div>{filtered.map((p) => <PersonRow key={p.id} person={p} />)}</div>
        )}
      </div>
    </div>
  );
}
