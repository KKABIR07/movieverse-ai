'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Play, Star, BookmarkPlus, BookmarkCheck, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { tmdbBackdrop, tmdbImage, formatYear, formatRuntime, getTrailerKey, tmdb } from '@/lib/tmdb';
import { useWatchlistStore } from '@/store';
import type { Movie } from '@/types/tmdb';
import dynamic from 'next/dynamic';

const HeroScene = dynamic(
  () => import('@/components/3d/HeroScene').then((m) => ({ default: m.HeroScene })),
  { ssr: false, loading: () => null }
);

const BG_DURATION  = 60_000; // ms each movie plays in background
const PREFETCH_AT  = 50_000; // pre-fetch next trailer at this point
const FADE_DELAY   = 1_800;  // ms after iframe mounts before fading in

const heroCache = new Map<number, string | null>();

const ytBgSrc = (key: string) =>
  `https://www.youtube.com/embed/${key}?autoplay=1&mute=1&controls=0&showinfo=0` +
  `&modestbranding=1&rel=0&iv_load_policy=3&disablekb=1&fs=0` +
  `&cc_load_policy=0&playsinline=1&loop=1&playlist=${key}`;

async function fetchKey(movie: Movie): Promise<string | null> {
  if (heroCache.has(movie.id)) return heroCache.get(movie.id) ?? null;
  try {
    const data = await tmdb.movie.videos(movie.id);
    const key  = getTrailerKey(data as Parameters<typeof getTrailerKey>[0]);
    heroCache.set(movie.id, key);
    return key;
  } catch {
    heroCache.set(movie.id, null);
    return null;
  }
}

interface HeroBannerProps {
  movies: Movie[];
}

export function HeroBanner({ movies }: HeroBannerProps) {
  const [current, setCurrent]   = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const [bgKey, setBgKey]       = useState<string | null>(null);
  const [bgReady, setBgReady]   = useState(false);
  const [tick, setTick]         = useState(0); // bumped every 60s for progress bar reset

  const fadeTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { add, remove, has } = useWatchlistStore();
  const movie      = movies[current];
  const nextIndex  = (current + 1) % movies.length;
  const inWatchlist = movie ? has(movie.id) : false;

  const advance = useCallback(() => {
    setCurrent((c) => (c + 1) % movies.length);
    setTick((t) => t + 1);
  }, [movies.length]);

  // Load trailer for new current movie
  useEffect(() => {
    if (!movie) return;
    setBgKey(null);
    setBgReady(false);
    if (fadeTimer.current) clearTimeout(fadeTimer.current);

    fetchKey(movie).then((key) => {
      if (!key) return;
      setBgKey(key);
      fadeTimer.current = setTimeout(() => setBgReady(true), FADE_DELAY);
    });

    return () => {
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    };
  }, [movie?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-advance every 60s + pre-fetch next
  useEffect(() => {
    if (!autoplay) return;

    if (prefetchTimer.current) clearTimeout(prefetchTimer.current);
    if (advanceTimer.current) clearTimeout(advanceTimer.current);

    prefetchTimer.current = setTimeout(() => {
      if (movies[nextIndex]) fetchKey(movies[nextIndex]);
    }, PREFETCH_AT);

    advanceTimer.current = setTimeout(advance, BG_DURATION);

    return () => {
      if (prefetchTimer.current) clearTimeout(prefetchTimer.current);
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, [current, autoplay, advance, nextIndex, movies]);

  const prev = () => {
    setAutoplay(false);
    setTick((t) => t + 1);
    setCurrent((c) => (c - 1 + movies.length) % movies.length);
  };
  const next = () => {
    setAutoplay(false);
    setTick((t) => t + 1);
    setCurrent((c) => (c + 1) % movies.length);
  };
  const goTo = (i: number) => {
    setAutoplay(false);
    setTick((t) => t + 1);
    setCurrent(i);
  };

  if (!movie) return null;

  return (
    <>
      {/* inject progress-bar keyframe once */}
      <style>{`@keyframes mv-hero-progress{from{width:0}to{width:100%}}`}</style>

      <div className="relative h-[100svh] min-h-[600px] overflow-hidden">

        {/* ── Background layer ── */}
        <div className="absolute inset-0">

          {/* Backdrop image — shown until trailer is ready */}
          {movie.backdrop_path && (
            <Image
              key={`bd-${movie.id}`}
              src={tmdbBackdrop(movie.backdrop_path)}
              alt={movie.title}
              fill
              priority
              className="object-cover transition-opacity duration-700"
              style={{ opacity: bgReady ? 0.08 : 0.42 }}
              sizes="100vw"
            />
          )}

          {/* YouTube trailer — full-screen, muted, no controls */}
          {bgKey && (
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ opacity: bgReady ? 1 : 0, transition: 'opacity 1.2s ease' }}
            >
              <iframe
                key={`yt-${movie.id}-${bgKey}`}
                src={ytBgSrc(bgKey)}
                allow="autoplay; encrypted-media"
                style={{
                  position: 'absolute',
                  top: '50%', left: '50%',
                  /* 16:9 covering any viewport */
                  width: 'max(100%, calc(100vh * 16 / 9))',
                  height: 'max(100%, calc(100vw * 9 / 16))',
                  transform: 'translate(-50%, -50%)',
                  border: 'none',
                  pointerEvents: 'none',
                }}
                title={`${movie.title} background trailer`}
              />
            </div>
          )}

          {/* 3D particle overlay */}
          <HeroScene />

          {/* Cinematic gradients */}
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--bg-primary)] via-[var(--bg-primary)]/55 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-primary)] via-transparent to-[var(--bg-primary)]/20" />
          {/* Slight dim so text is always readable */}
          <div className="absolute inset-0 bg-black/30" />
        </div>

        {/* ── Content ── */}
        <div className="relative z-10 h-full flex items-center">
          <div className="container mx-auto px-4 md:px-8 flex items-center gap-12">

            {/* Text */}
            <div className="max-w-lg space-y-5 fade-in-up">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-[var(--accent-primary)] bg-[var(--accent-primary)]/10 px-3 py-1 rounded-full border border-[var(--accent-primary)]/30">
                  Trending Now
                </span>
                {bgReady && (
                  <span className="text-xs font-medium text-white/40 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full border border-white/10 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block animate-pulse" />
                    LIVE Trailer
                  </span>
                )}
              </div>

              <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white leading-tight drop-shadow-lg">
                {movie.title}
              </h1>

              <div className="flex items-center gap-4 flex-wrap text-sm text-[var(--text-secondary)]">
                <span
                  className="flex items-center gap-1.5 font-bold"
                  style={{ color: movie.vote_average >= 7.5 ? '#22c55e' : '#f59e0b' }}
                >
                  <Star size={14} className="fill-current" />
                  {movie.vote_average.toFixed(1)}
                </span>
                <span>{formatYear(movie.release_date)}</span>
                {movie.runtime && <span>{formatRuntime(movie.runtime)}</span>}
                {movie.genres?.slice(0, 2).map((g) => (
                  <span
                    key={g.id}
                    className="px-2 py-0.5 rounded-full bg-[var(--bg-hover)] border border-[var(--border)] text-xs"
                  >
                    {g.name}
                  </span>
                ))}
              </div>

              <p className="text-[var(--text-secondary)] text-base leading-relaxed line-clamp-3">
                {movie.overview}
              </p>

              <div className="flex items-center gap-3 flex-wrap">
                <Link
                  href={`/movie/${movie.id}`}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-white font-semibold transition-all hover:shadow-[0_0_20px_rgba(124,58,237,0.5)] active:scale-95"
                >
                  <Play size={18} className="fill-current" />
                  Watch Trailer
                </Link>

                <Link
                  href={`/movie/${movie.id}`}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl border border-[var(--border)] bg-white/5 hover:bg-white/10 text-white font-medium transition-colors backdrop-blur-sm"
                >
                  <Info size={18} />
                  More Info
                </Link>

                <button
                  onClick={() =>
                    inWatchlist
                      ? remove(movie.id)
                      : add({
                          id: movie.id,
                          title: movie.title,
                          poster_path: movie.poster_path,
                          release_date: movie.release_date,
                          vote_average: movie.vote_average,
                          media_type: 'movie',
                        })
                  }
                  className="p-3 rounded-xl border border-[var(--border)] bg-white/5 hover:bg-white/10 text-white transition-colors backdrop-blur-sm"
                  aria-label={inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
                >
                  {inWatchlist ? <BookmarkCheck size={20} /> : <BookmarkPlus size={20} />}
                </button>
              </div>
            </div>

            {/* Poster */}
            <div className="hidden lg:block flex-shrink-0 w-56">
              <div className="relative aspect-[2/3] rounded-2xl overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.8)] ring-1 ring-white/10 poster-card">
                <Image
                  key={`poster-${movie.id}`}
                  src={tmdbImage(movie.poster_path, 'w342')}
                  alt={movie.title}
                  fill
                  className="object-cover"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Bottom navigation ── */}
        <div className="absolute bottom-0 left-0 right-0 z-10">
          {/* 60s progress bar — resets each slide */}
          {autoplay && (
            <div className="h-[2px] w-full bg-white/10 overflow-hidden">
              <div
                key={`prog-${current}-${tick}`}
                style={{
                  height: '100%',
                  background: 'linear-gradient(90deg, var(--accent-primary), #a78bfa)',
                  animation: `mv-hero-progress ${BG_DURATION}ms linear forwards`,
                }}
              />
            </div>
          )}

          <div className="flex items-center justify-center gap-4 py-5">
            <button
              onClick={prev}
              className="p-2 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 border border-white/10 text-white transition-colors"
              aria-label="Previous"
            >
              <ChevronLeft size={20} />
            </button>

            <div className="flex gap-2">
              {movies.slice(0, 8).map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === current ? 'w-8 bg-[var(--accent-primary)]' : 'w-2 bg-white/30 hover:bg-white/50'
                  }`}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>

            <button
              onClick={next}
              className="p-2 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 border border-white/10 text-white transition-colors"
              aria-label="Next"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
