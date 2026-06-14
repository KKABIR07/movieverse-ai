'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronUp, ChevronDown, BookmarkPlus, BookmarkCheck,
  ExternalLink, Loader2, Star, Volume2, VolumeX,
  SquarePlay, ExternalLink as LinkIcon,
} from 'lucide-react';
import { tmdb, tmdbImage, formatYear } from '@/lib/tmdb';
import { fetchMovieShorts, checkYouTubeKey, type YTShort } from '@/lib/youtube';
import { useWatchlistStore } from '@/store';
import { useAuthStore } from '@/store/authStore';

// ─── Setup screen (no YouTube key) ───────────────────────────────────────────
function SetupScreen() {
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center p-6" style={{ paddingTop: 64 }}>
      <div className="max-w-md w-full glass rounded-3xl border border-[var(--border)] p-8 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
          <SquarePlay size={32} className="text-red-500" />
        </div>

        <div>
          <h2 className="text-xl font-black text-[var(--text-primary)] mb-2">YouTube API Key Required</h2>
          <p className="text-sm text-[var(--text-muted)] leading-relaxed">
            Movie Shorts sources real YouTube Shorts. Add a free YouTube Data API key to enable this feature.
          </p>
        </div>

        <ol className="text-left space-y-3 text-sm text-[var(--text-secondary)]">
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
            <span>Go to <span className="text-[var(--accent-primary)] font-mono text-xs">console.cloud.google.com</span></span>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
            <span>Enable <strong className="text-[var(--text-primary)]">YouTube Data API v3</strong> for your project</span>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
            <span>Create an API key in <strong className="text-[var(--text-primary)]">Credentials</strong></span>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
            <span>
              Add to <span className="font-mono text-xs bg-[var(--bg-card)] px-1.5 py-0.5 rounded text-[var(--text-primary)]">.env.local</span>:
              <br />
              <span className="font-mono text-xs text-green-400 mt-1 block">YOUTUBE_API_KEY=your_key_here</span>
            </span>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] flex items-center justify-center text-xs font-bold flex-shrink-0">5</span>
            <span>Restart the dev server and reload this page</span>
          </li>
        </ol>

        <p className="text-xs text-[var(--text-muted)]">
          Free tier: 10,000 quota units/day — plenty for personal use.
        </p>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ShortsPage() {
  const [current, setCurrent]   = useState(0);
  const [muted, setMuted]       = useState(true);
  const [hasKey, setHasKey]     = useState<boolean | null>(null);
  const { add, has }            = useWatchlistStore();
  const { user }                = useAuthStore();
  const touchStartY             = useRef(0);
  const containerRef            = useRef<HTMLDivElement>(null);

  // Check if YouTube API key is configured
  useEffect(() => {
    checkYouTubeKey().then(setHasKey);
  }, []);

  // Fetch trending movies + TV from TMDB for context
  const { data: trendingMovies } = useQuery({
    queryKey: ['shorts-trending-movies'],
    queryFn: () => tmdb.movie.trending('week'),
    staleTime: 60 * 60 * 1000,
    enabled: hasKey === true,
  });

  const { data: trendingTV } = useQuery({
    queryKey: ['shorts-trending-tv'],
    queryFn: () => tmdb.tv.trending('week'),
    staleTime: 60 * 60 * 1000,
    enabled: hasKey === true,
  });

  // Build the YouTube Shorts feed
  const { data: shorts = [], isLoading: shortsLoading } = useQuery({
    queryKey: [
      'yt-shorts-feed',
      trendingMovies?.results.slice(0, 5).map((m) => m.id).join(','),
      trendingTV?.results.slice(0, 5).map((t) => t.id).join(','),
    ],
    enabled: hasKey === true && !!(trendingMovies?.results) && !!(trendingTV?.results),
    staleTime: 24 * 60 * 60 * 1000,
    queryFn: async (): Promise<YTShort[]> => {
      const movies = trendingMovies!.results.slice(0, 5).map((m) => ({
        title: m.title,
        id: m.id,
        poster_path: m.poster_path,
        vote_average: m.vote_average,
        type: 'movie' as const,
        date: m.release_date,
      }));

      const tvShows = trendingTV!.results.slice(0, 5).map((t) => ({
        title: t.name,
        id: t.id,
        poster_path: t.poster_path,
        vote_average: t.vote_average,
        type: 'tv' as const,
        date: t.first_air_date,
      }));

      // Interleave movies and TV shows, 3 shorts each
      const combined = [...movies, ...tvShows];
      const allShorts = await Promise.all(
        combined.map((item) => fetchMovieShorts(item, 3)),
      );

      return allShorts.flat().filter((s) => s.videoId);
    },
  });

  const total = shorts.length;

  const prev = useCallback(() => {
    setCurrent((c) => Math.max(0, c - 1));
    setMuted(true);
  }, []);

  const next = useCallback(() => {
    setCurrent((c) => Math.min(total - 1, c + 1));
    setMuted(true);
  }, [total]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp')   { e.preventDefault(); prev(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); next(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [prev, next]);

  // Touch swipe
  const onTouchStart = (e: React.TouchEvent) => { touchStartY.current = e.touches[0].clientY; };
  const onTouchEnd   = (e: React.TouchEvent) => {
    const delta = touchStartY.current - e.changedTouches[0].clientY;
    if (Math.abs(delta) > 50) { if (delta > 0) next(); else prev(); }
  };

  // ── Render states ──────────────────────────────────────────────────────────

  if (hasKey === null) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center" style={{ paddingTop: 64 }}>
        <Loader2 size={28} className="animate-spin text-[var(--accent-primary)]" />
      </div>
    );
  }

  if (hasKey === false) return <SetupScreen />;

  if (shortsLoading || !trendingMovies) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-4" style={{ paddingTop: 64 }}>
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <SquarePlay size={28} className="text-red-500" />
        </div>
        <Loader2 size={24} className="animate-spin text-[var(--accent-primary)]" />
        <p className="text-sm text-[var(--text-muted)]">Loading Movie Shorts…</p>
      </div>
    );
  }

  if (!shorts.length) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-4" style={{ paddingTop: 64 }}>
        <SquarePlay size={32} className="text-[var(--text-muted)]" />
        <p className="text-[var(--text-muted)]">No shorts found. Try again later.</p>
      </div>
    );
  }

  const short   = shorts[current];
  const isSaved = has(short.relatedMovieId);
  const year    = short.relatedMovieDate ? formatYear(short.relatedMovieDate) : null;

  const embedSrc =
    `https://www.youtube.com/embed/${short.videoId}` +
    `?autoplay=1&mute=${muted ? 1 : 0}&controls=1&rel=0&modestbranding=1&playsinline=1`;

  const handleSave = () => {
    if (!user) {
      window.dispatchEvent(new CustomEvent('mkmovies:openAuth', { detail: { tab: 'login' } }));
      return;
    }
    add({
      id:           short.relatedMovieId,
      title:        short.relatedMovie,
      poster_path:  short.relatedMoviePoster,
      vote_average: short.relatedMovieRating,
      release_date: short.relatedMovieDate ?? '',
      media_type:   short.relatedMovieType,
    });
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black overflow-hidden select-none"
      style={{ paddingTop: 64 }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <style>{`
        @keyframes mv-shorts-entry {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .mv-shorts-info { animation: mv-shorts-entry 0.3s ease-out; }
      `}</style>

      {/* Blurred backdrop from movie poster */}
      <div className="absolute inset-0 pointer-events-none">
        {short.relatedMoviePoster ? (
          <Image
            key={`bg-${short.videoId}`}
            src={tmdbImage(short.relatedMoviePoster, 'w342')}
            alt=""
            fill
            className="object-cover"
            style={{ filter: 'blur(40px) brightness(0.3)', transform: 'scale(1.15)' }}
            sizes="100vw"
          />
        ) : (
          <div className="absolute inset-0 bg-[var(--bg-primary)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/70" />
      </div>

      {/* Main layout */}
      <div className="relative h-full flex items-center justify-center gap-4 px-2 md:px-6">

        {/* Left nav — desktop only */}
        <div className="hidden lg:flex flex-col items-center gap-3 flex-shrink-0 w-12">
          <button
            onClick={prev}
            disabled={current === 0}
            className="p-2.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronUp size={20} />
          </button>
          <span className="text-[11px] text-white/40 font-mono">{current + 1}/{total}</span>
          <button
            onClick={next}
            disabled={current === total - 1}
            className="p-2.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronDown size={20} />
          </button>
        </div>

        {/* ── 9:16 vertical video container ── */}
        <div
          className="relative flex-shrink-0 rounded-2xl overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.9)] border border-white/10"
          style={{
            aspectRatio: '9/16',
            height: 'min(calc(100dvh - 64px - 24px), 680px)',
            maxWidth: '100%',
          }}
        >
          <iframe
            key={`${short.videoId}-${muted}`}
            src={embedSrc}
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full border-0"
            title={short.title}
          />

          {/* Bottom overlay — title */}
          <div
            key={short.videoId}
            className="mv-shorts-info absolute bottom-0 left-0 right-0 px-4 pt-16 pb-4 pointer-events-none"
            style={{
              background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)',
            }}
          >
            {/* Movie badge */}
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md ${
                short.relatedMovieType === 'tv'
                  ? 'bg-blue-500/40 text-blue-200 border border-blue-500/30'
                  : 'bg-red-500/40 text-red-200 border border-red-500/30'
              }`}>
                {short.relatedMovieType === 'tv' ? 'TV Show' : 'Movie'}
              </span>
              {year && <span className="text-[10px] text-white/40">{year}</span>}
            </div>

            {/* YouTube short title */}
            <p className="text-xs text-white/60 leading-snug line-clamp-2 mb-1">{short.title}</p>

            {/* Channel */}
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full bg-red-500/30 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                <SquarePlay size={8} className="text-red-400" />
              </div>
              <span className="text-[10px] text-white/50 truncate">{short.channelTitle}</span>
            </div>
          </div>

          {/* Mute button — top right of video */}
          <button
            onClick={() => setMuted((m) => !m)}
            className="absolute top-3 right-3 p-2 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 text-white hover:bg-black/70 transition-colors"
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>

          {/* Progress dots — bottom left corner */}
          <div className="absolute bottom-3 left-3 flex gap-1 pointer-events-none">
            {Array.from({ length: Math.min(total, 12) }, (_, i) => {
              const offset = Math.max(0, current - 5);
              const idx = offset + i;
              if (idx >= total) return null;
              return (
                <div
                  key={idx}
                  className={`rounded-full transition-all duration-300 ${
                    idx === current ? 'w-5 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/30'
                  }`}
                />
              );
            })}
          </div>
        </div>

        {/* ── Right action column ── */}
        <div className="flex flex-col items-center gap-5 flex-shrink-0 w-14">

          {/* Movie poster + link */}
          {short.relatedMoviePoster && (
            <Link href={`/${short.relatedMovieType}/${short.relatedMovieId}`}>
              <div
                className="relative rounded-xl overflow-hidden ring-2 ring-white/20 hover:ring-[var(--accent-primary)]/60 transition-all shadow-lg"
                style={{ width: 48, height: 72 }}
              >
                <Image
                  src={tmdbImage(short.relatedMoviePoster, 'w92')}
                  alt={short.relatedMovie}
                  fill
                  className="object-cover"
                  sizes="48px"
                />
              </div>
            </Link>
          )}

          {/* Rating */}
          <div className="flex flex-col items-center gap-0.5">
            <Star size={20} className="text-amber-400 fill-current" />
            <span className="text-xs font-bold text-white">{short.relatedMovieRating.toFixed(1)}</span>
          </div>

          {/* Save to watchlist */}
          <button onClick={handleSave} className="flex flex-col items-center gap-1 group">
            {isSaved
              ? <BookmarkCheck size={24} className="text-green-400" />
              : <BookmarkPlus size={24} className="text-white/70 group-hover:text-white transition-colors" />
            }
            <span className="text-[10px] text-white/50">{isSaved ? 'Saved' : 'Save'}</span>
          </button>

          {/* View movie details */}
          <Link
            href={`/${short.relatedMovieType}/${short.relatedMovieId}`}
            className="flex flex-col items-center gap-1 group"
          >
            <ExternalLink size={20} className="text-white/70 group-hover:text-white transition-colors" />
            <span className="text-[10px] text-white/50">Details</span>
          </Link>

          {/* Open on YouTube */}
          <a
            href={`https://www.youtube.com/shorts/${short.videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1 group"
          >
            <LinkIcon size={18} className="text-red-500/70 group-hover:text-red-400 transition-colors" />
            <span className="text-[10px] text-white/50">YouTube</span>
          </a>

          {/* Mobile nav */}
          <div className="flex flex-col gap-2 lg:hidden mt-1">
            <button
              onClick={prev}
              disabled={current === 0}
              className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-30"
            >
              <ChevronUp size={16} />
            </button>
            <button
              onClick={next}
              disabled={current === total - 1}
              className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-30"
            >
              <ChevronDown size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Movie title — below video on desktop */}
      <div
        key={short.videoId}
        className="mv-shorts-info absolute bottom-3 left-1/2 -translate-x-1/2 text-center pointer-events-none hidden lg:block"
        style={{ width: 'min(calc((100dvh - 64px - 24px) * 9/16), 100vw - 120px)' }}
      >
        <p className="text-sm font-bold text-white/80 line-clamp-1">{short.relatedMovie}</p>
      </div>
    </div>
  );
}
