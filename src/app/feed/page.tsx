'use client';

import { useState } from 'react';
import Image from 'next/image'; // used for TMDB images only
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Rss, LogIn, Search, X, Star, ChevronRight,
  Play, SquarePlay, ExternalLink,
} from 'lucide-react';
import { useFollowingStore } from '@/store/followingStore';
import { useAuthStore } from '@/store/authStore';
import { tmdb, tmdbImage, formatYear } from '@/lib/tmdb';
import type { FollowedPerson } from '@/types/tmdb';

// ─── YouTube video types / fetcher ────────────────────────────────────────────
interface YTVideo {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
}

async function fetchStarVideos(name: string): Promise<YTVideo[]> {
  try {
    const res = await fetch(
      `/api/youtube/shorts?${new URLSearchParams({ q: `${name} interview latest`, n: '8', type: 'videos' })}`,
    );
    if (!res.ok) return [];
    const { items } = (await res.json()) as { items?: YTVideo[] };
    return items ?? [];
  } catch {
    return [];
  }
}

// ─── Inline video player modal ────────────────────────────────────────────────
function VideoModal({
  videoId, title, onClose,
}: { videoId: string; title: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <div
        className="relative rounded-2xl overflow-hidden shadow-2xl w-full"
        style={{ maxWidth: 820, aspectRatio: '16/9' }}
        onClick={(e) => e.stopPropagation()}
      >
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&controls=1&modestbranding=1`}
          allow="autoplay; encrypted-media; fullscreen"
          allowFullScreen
          className="absolute inset-0 w-full h-full border-0"
          title={title}
        />
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-2 bg-black/70 backdrop-blur-sm rounded-full text-white hover:bg-black/90 transition-colors"
        >
          <X size={16} />
        </button>
        <a
          href={`https://www.youtube.com/watch?v=${videoId}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1.5 bg-black/70 backdrop-blur-sm rounded-full text-white text-xs hover:bg-red-600/80 transition-colors"
        >
          <ExternalLink size={12} /> YouTube
        </a>
      </div>
      <p className="absolute bottom-5 left-1/2 -translate-x-1/2 text-xs text-white/50 text-center max-w-xs truncate px-4">{title}</p>
    </div>
  );
}

// ─── YouTube row per star ─────────────────────────────────────────────────────
function StarYouTubeRow({ person }: { person: FollowedPerson }) {
  const [playing, setPlaying] = useState<{ videoId: string; title: string } | null>(null);

  const { data: videos = [], isLoading } = useQuery({
    queryKey: ['star-yt-videos', person.id, person.name],
    queryFn: () => fetchStarVideos(person.name),
    staleTime: 24 * 60 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex gap-3 mt-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={`yt-sk-${i}`} className="flex-shrink-0 rounded-xl bg-[var(--bg-card)] animate-pulse" style={{ width: 180, aspectRatio: '16/9' }} />
        ))}
      </div>
    );
  }

  if (!videos.length) return null;

  return (
    <>
      <div className="mt-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">YouTube Videos</p>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
          {videos.map((v) => (
            <button
              key={v.videoId}
              onClick={() => setPlaying({ videoId: v.videoId, title: v.title })}
              className="flex-shrink-0 group text-left"
              style={{ width: 180 }}
            >
              <div
                className="relative rounded-xl overflow-hidden bg-[var(--bg-card)] ring-1 ring-white/5 group-hover:ring-red-500/40 transition-all group-hover:-translate-y-0.5 duration-200"
                style={{ aspectRatio: '16/9' }}
              >
                {v.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.thumbnail} alt={v.title} className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <SquarePlay size={20} className="text-[var(--text-muted)]" />
                  </div>
                )}

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-10 h-10 rounded-full bg-red-600/90 backdrop-blur-sm flex items-center justify-center shadow-lg">
                    <Play size={14} className="text-white fill-current ml-0.5" />
                  </div>
                </div>
              </div>
              <p className="text-[10px] font-medium text-[var(--text-primary)] mt-1.5 line-clamp-2 group-hover:text-red-400 transition-colors leading-tight">{v.title}</p>
              <p className="text-[9px] text-[var(--text-muted)] truncate">{v.channelTitle}</p>
            </button>
          ))}
        </div>
      </div>

      {playing && (
        <VideoModal videoId={playing.videoId} title={playing.title} onClose={() => setPlaying(null)} />
      )}
    </>
  );
}

// ─── Per-person row (filmography + YouTube) ───────────────────────────────────
function PersonFeedRow({ person, query }: { person: FollowedPerson; query: string }) {
  const { data } = useQuery({
    queryKey: ['person', person.id],
    queryFn: () => tmdb.person.detail(person.id),
    staleTime: 10 * 60 * 1000,
  });

  const q = query.trim().toLowerCase();
  const allWorks = (data?.combined_credits?.cast ?? []).filter((c) => c.poster_path);
  const works = allWorks
    .filter((f) => !q || (f.title ?? '').toLowerCase().includes(q))
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 12);

  if (q && works.length === 0 && !data) return null;

  return (
    <div className="mb-2">
      {/* Person header */}
      <div className="flex items-center justify-between mb-3">
        <Link href={`/person/${person.id}`} className="flex items-center gap-3 group min-w-0">
          <div
            className="relative rounded-full overflow-hidden ring-2 ring-white/10 group-hover:ring-[var(--accent-primary)]/50 transition-all flex-shrink-0"
            style={{ width: 44, height: 44 }}
          >
            {person.profile_path
              ? <Image src={tmdbImage(person.profile_path, 'w92')} alt={person.name} fill className="object-cover object-top" sizes="44px" />
              : <div className="absolute inset-0 bg-[var(--bg-card)] flex items-center justify-center text-sm">👤</div>}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors text-sm">
              {person.name}
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              {person.known_for_department === 'Directing' ? '🎬 Director' : '🎭 Actor'}
              {allWorks.length > 0 && ` · ${allWorks.length} works`}
            </p>
          </div>
        </Link>
        <Link href={`/person/${person.id}`} className="flex items-center gap-1 text-xs text-[var(--accent-primary)] hover:underline flex-shrink-0">
          See all <ChevronRight size={12} />
        </Link>
      </div>

      {/* Filmography */}
      {!q && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-[var(--accent-primary)] flex-shrink-0" />
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Filmography</p>
          </div>

          {data ? (
            works.length > 0 ? (
              <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {works.map((film) => (
                  <Link
                    key={`${film.id}-${film.character ?? ''}`}
                    href={`/${film.media_type ?? 'movie'}/${film.id}`}
                    className="group/f flex-shrink-0"
                    style={{ width: 88 }}
                  >
                    <div className="relative rounded-xl overflow-hidden aspect-[2/3] bg-[var(--bg-card)] ring-1 ring-white/5 group-hover/f:ring-[var(--accent-primary)]/40 transition-all group-hover/f:-translate-y-1">
                      <Image
                        src={tmdbImage(film.poster_path ?? null, 'w185')}
                        alt={film.title ?? ''}
                        fill
                        className="object-cover"
                        sizes="88px"
                      />
                      {(film.vote_average ?? 0) > 0 && (
                        <div className="absolute top-1.5 left-1.5 flex items-center gap-0.5 bg-black/70 backdrop-blur-sm rounded px-1 py-0.5">
                          <Star size={8} className="text-amber-400 fill-current" />
                          <span className="text-[10px] font-bold text-white">{(film.vote_average ?? 0).toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] font-medium text-[var(--text-primary)] mt-1.5 line-clamp-1 group-hover/f:text-[var(--accent-primary)] transition-colors">{film.title}</p>
                    {film.release_date && <p className="text-[9px] text-[var(--text-muted)]">{formatYear(film.release_date)}</p>}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--text-muted)] py-3">No matching titles.</p>
            )
          ) : (
            <div className="flex gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={`film-sk-${i}`} className="flex-shrink-0 rounded-xl bg-[var(--bg-card)] animate-pulse" style={{ width: 88, aspectRatio: '2/3' }} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* YouTube videos — always shown (regardless of search) */}
      {!q && <StarYouTubeRow person={person} />}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function FeedPage() {
  const { following } = useFollowingStore();
  const { user }      = useAuthStore();
  const [query, setQuery] = useState('');

  const openAuth = () =>
    window.dispatchEvent(new CustomEvent('mkmovies:openAuth', { detail: { tab: 'login' } }));

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 pt-20">
        <div className="w-16 h-16 rounded-2xl bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 flex items-center justify-center mb-5">
          <Rss size={30} className="text-[var(--accent-primary)]" />
        </div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Sign in to see your feed</h1>
        <p className="text-[var(--text-muted)] max-w-sm mb-6">Follow actors and directors to see their work and YouTube videos here.</p>
        <button
          onClick={openAuth}
          className="flex items-center gap-2 px-6 py-3 bg-[var(--accent-primary)] text-white font-semibold rounded-xl hover:bg-[var(--accent-secondary)] transition-colors"
        >
          <LogIn size={18} /> Sign In Free
        </button>
      </div>
    );
  }

  if (following.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 pt-20">
        <Rss size={48} className="text-[var(--text-muted)] mb-4" />
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Your feed is empty</h1>
        <p className="text-[var(--text-muted)] max-w-sm mb-6">
          Follow actors and directors to see their movies, shows, and YouTube videos here.
        </p>
        <Link
          href="/stars"
          className="px-5 py-2.5 bg-[var(--accent-primary)] text-white font-semibold rounded-xl hover:bg-[var(--accent-secondary)] transition-colors text-sm"
        >
          Discover Stars →
        </Link>
      </div>
    );
  }

  const q = query.trim();

  return (
    <div className="min-h-screen pt-20 pb-16">
      <div className="container mx-auto px-4 md:px-8">

        {/* Header */}
        <div className="mt-6 mb-8 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-black text-[var(--text-primary)] flex items-center gap-3">
              <Rss size={26} className="text-green-400" />
              My Feed
            </h1>
            <p className="text-[var(--text-muted)] mt-1 text-sm">
              {q
                ? `Searching for "${q}"`
                : `Movies, shows & YouTube videos from ${following.length} stars you follow`}
            </p>
          </div>
          <Link href="/stars" className="text-sm text-[var(--accent-primary)] hover:underline font-medium">
            + Follow More Stars
          </Link>
        </div>

        {/* Search */}
        <div className="relative mb-8 max-w-lg">
          <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search movies & shows in your feed…"
            className="w-full bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--accent-primary)] rounded-2xl pl-11 pr-10 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-colors"
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

        {/* Feed rows */}
        <div className="divide-y divide-[var(--border)]">
          {following.map((person) => (
            <div key={person.id} className="py-8 first:pt-0">
              <PersonFeedRow person={person} query={query} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
