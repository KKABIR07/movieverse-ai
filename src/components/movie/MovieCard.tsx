'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { BookmarkPlus, BookmarkCheck, Star, Eye, Play, Calendar } from 'lucide-react';
import { tmdbImage, formatYear, getTrailerKey, tmdb } from '@/lib/tmdb';
import { useWatchlistStore } from '@/store';
import type { Movie, TVShow } from '@/types/tmdb';

// Module-level cache — repeated hovers are instant, no re-fetch
const trailerCache = new Map<number, string | null>();

// YouTube embed that suppresses every visible UI element
const ytSrc = (key: string) =>
  `https://www.youtube.com/embed/${key}?autoplay=1&mute=1&controls=0&showinfo=0` +
  `&modestbranding=1&rel=0&iv_load_policy=3&disablekb=1&fs=0` +
  `&cc_load_policy=0&playsinline=1&loop=1&playlist=${key}`;

type MediaItem = (Movie | TVShow) & { media_type?: 'movie' | 'tv' };

interface MovieCardProps {
  item: MediaItem;
  mediaType?: 'movie' | 'tv';
  size?: 'sm' | 'md' | 'lg';
}

export function MovieCard({ item, mediaType = 'movie', size = 'md' }: MovieCardProps) {
  const [imgError, setImgError]         = useState(false);
  const [hovered, setHovered]           = useState(false);
  const [trailerKey, setTrailerKey]     = useState<string | null>(null);
  const [trailerReady, setTrailerReady] = useState(false);
  const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { add, remove, has } = useWatchlistStore();
  const title       = 'title' in item ? item.title : item.name;
  const date        = 'release_date' in item ? item.release_date : item.first_air_date;
  const type        = item.media_type ?? mediaType;
  const href        = `/${type}/${item.id}`;
  const inWatchlist = has(item.id);

  const fetchTrailer = useCallback(async () => {
    if (trailerCache.has(item.id)) {
      const cached = trailerCache.get(item.id) ?? null;
      setTrailerKey(cached);
      if (cached) {
        if (readyTimer.current) clearTimeout(readyTimer.current);
        readyTimer.current = setTimeout(() => setTrailerReady(true), 700);
      }
      return;
    }
    try {
      const data = type === 'tv'
        ? await tmdb.tv.videos(item.id)
        : await tmdb.movie.videos(item.id);
      const key = getTrailerKey(data as Parameters<typeof getTrailerKey>[0]);
      trailerCache.set(item.id, key);
      setTrailerKey(key);
      if (key) {
        if (readyTimer.current) clearTimeout(readyTimer.current);
        readyTimer.current = setTimeout(() => setTrailerReady(true), 700);
      }
    } catch {
      trailerCache.set(item.id, null);
    }
  }, [item.id, type]);

  const handleEnter = () => {
    setHovered(true);
    if (fetchTimer.current) clearTimeout(fetchTimer.current);
    fetchTimer.current = setTimeout(fetchTrailer, 350);
  };

  const handleLeave = () => {
    setHovered(false);
    setTrailerReady(false);
    if (fetchTimer.current) clearTimeout(fetchTimer.current);
    if (readyTimer.current) clearTimeout(readyTimer.current);
  };

  const handleWatchlist = (e: React.MouseEvent) => {
    e.preventDefault();
    if (inWatchlist) remove(item.id);
    else add({ id: item.id, title, poster_path: item.poster_path, release_date: date ?? '', vote_average: item.vote_average, media_type: type });
  };

  return (
    <Link
      href={href}
      className="block"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {/* ── Poster shell ── */}
      <div
        className="relative aspect-[2/3] overflow-hidden rounded-xl bg-[var(--bg-card)]"
        style={{
          boxShadow: hovered
            ? '0 0 0 2px var(--accent-primary), 0 12px 36px rgba(124,58,237,0.38)'
            : '0 2px 10px rgba(0,0,0,0.4)',
          transition: 'box-shadow 0.3s ease',
        }}
      >
        {/* Poster image — fades out when trailer plays */}
        {item.poster_path && !imgError ? (
          <Image
            src={tmdbImage(item.poster_path, size === 'lg' ? 'w500' : 'w342')}
            alt={title}
            fill
            className="object-cover"
            style={{ opacity: trailerReady ? 0 : 1, transition: 'opacity 0.5s ease' }}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            onError={() => setImgError(true)}
          />
        ) : (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[var(--text-muted)]"
            style={{ opacity: trailerReady ? 0 : 1, transition: 'opacity 0.5s ease' }}
          >
            <Eye size={26} />
            <span className="text-xs text-center px-2 line-clamp-2">{title}</span>
          </div>
        )}

        {/* YouTube trailer — covers card, all controls hidden */}
        {trailerKey && hovered && (
          <div
            className="absolute inset-0 overflow-hidden rounded-xl"
            style={{ opacity: trailerReady ? 1 : 0, transition: 'opacity 0.5s ease' }}
          >
            <iframe
              src={ytSrc(trailerKey)}
              allow="autoplay; encrypted-media"
              style={{
                position: 'absolute',
                top: '50%', left: '50%',
                /* 16:9 video covers 2:3 card: width = (16/9)÷(2/3)×100% = 266.67% */
                width: '266.67%',
                height: '100%',
                transform: 'translate(-50%, -50%)',
                border: 'none',
                pointerEvents: 'none',
              }}
              title={`${title} trailer`}
            />
          </div>
        )}

        {/* Play pulse while trailer hasn't started yet */}
        {hovered && !trailerReady && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-10 h-10 rounded-full bg-black/55 backdrop-blur-sm border border-white/25 flex items-center justify-center">
              <Play size={15} className="text-white fill-white ml-0.5" />
            </div>
          </div>
        )}

        {/* Slide-up info panel */}
        <div
          className="absolute inset-x-0 bottom-0 rounded-b-xl overflow-hidden"
          style={{
            background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 55%, transparent 100%)',
            maxHeight: hovered ? '68%' : '0%',
            transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          <div className="px-2.5 pt-8 pb-2.5 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Star size={10} className="text-amber-400 fill-current" />
              <span className="text-[11px] font-bold text-amber-400">{item.vote_average.toFixed(1)}</span>
            </div>

            {item.overview && (
              <p className="text-[10px] text-white/60 leading-relaxed line-clamp-3">
                {item.overview}
              </p>
            )}

            <div className="flex items-center justify-between pt-0.5">
              <div className="flex items-center gap-1 text-[10px] text-white/40">
                <Calendar size={9} />
                <span>{formatYear(date)}</span>
              </div>
              <button
                onClick={handleWatchlist}
                className="p-1 rounded-md bg-white/10 hover:bg-[var(--accent-primary)] transition-colors"
                aria-label={inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
              >
                {inWatchlist
                  ? <BookmarkCheck size={11} className="text-white" />
                  : <BookmarkPlus size={11} className="text-white" />}
              </button>
            </div>
          </div>
        </div>

        {/* Rating badge — always visible */}
        {item.vote_average > 0 && (
          <div className="absolute top-1.5 left-1.5 flex items-center gap-0.5 bg-black/70 backdrop-blur-sm rounded px-1.5 py-0.5">
            <Star size={9} className="text-amber-400 fill-current" />
            <span className="text-[11px] font-bold text-white">{item.vote_average.toFixed(1)}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-2 px-0.5">
        <p className="text-sm font-medium text-[var(--text-primary)] line-clamp-1">
          {title}
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">{formatYear(date)}</p>
      </div>
    </Link>
  );
}
