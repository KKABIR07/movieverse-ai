'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ChevronLeft, ChevronRight, Star,
  BookmarkPlus, BookmarkCheck, Calendar, Eye, Play,
} from 'lucide-react';
import { tmdbImage, tmdbBackdrop, formatYear, getTrailerKey, tmdb } from '@/lib/tmdb';
import { useWatchlistStore } from '@/store';
import { GENRES } from '@/types/tmdb';
import type { Movie, TVShow } from '@/types/tmdb';
import { MovieCardSkeleton } from '@/components/ui/Skeleton';

type Item = Movie | TVShow;

const GENRE_MAP  = new Map(GENRES.map((g) => [g.id, g.name]));
const cardCache  = new Map<number, string | null>();

const ytSrc = (key: string) =>
  `https://www.youtube.com/embed/${key}?autoplay=1&mute=1&controls=0&showinfo=0` +
  `&modestbranding=1&rel=0&iv_load_policy=3&disablekb=1&fs=0` +
  `&cc_load_policy=0&playsinline=1&loop=1&playlist=${key}`;

function genreNames(ids: number[] = []): string[] {
  return ids.slice(0, 4).flatMap((id) => {
    const n = GENRE_MAP.get(id);
    return n ? [n] : [];
  });
}
function rtScore(vote: number) {
  const pct = Math.round(vote * 10);
  if (pct >= 75) return { pct, icon: '🍅', text: '#22c55e' };
  if (pct >= 60) return { pct, icon: '🍅', text: '#84cc16' };
  return { pct, icon: '🥀', text: '#9ca3af' };
}
function mcScore(vote: number) {
  const pct = Math.round(vote * 10);
  if (pct >= 61) return { pct, bg: '#22c55e', fg: '#fff' };
  if (pct >= 40) return { pct, bg: '#eab308', fg: '#000' };
  return { pct, bg: '#ef4444', fg: '#fff' };
}

interface Props {
  items: Item[];
  loading?: boolean;
  mediaType?: 'movie' | 'tv';
}

export function TrendingShowcase({ items, loading = false, mediaType = 'movie' }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -600 : 600, behavior: 'smooth' });
  };

  const itemTitle = (item: Item) => ('title' in item ? item.title : item.name);
  const itemDate  = (item: Item) => ('release_date' in item ? item.release_date : item.first_air_date);
  const itemHref  = (item: Item) =>
    `/${'media_type' in item && item.media_type ? item.media_type : mediaType}/${item.id}`;

  const first = items[0];

  return (
    <section className="relative py-0 overflow-hidden" style={{ minHeight: 460 }}>
      {/* Ambient backdrop — very dim */}
      {first?.backdrop_path && (
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <Image
            src={tmdbBackdrop(first.backdrop_path)}
            alt="" fill className="object-cover"
            style={{ opacity: 0.08 }} sizes="100vw" priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-primary)] via-[var(--bg-primary)]/60 to-[var(--bg-primary)]/80" />
        </div>
      )}

      <div className="relative z-10 pt-10 pb-6">
        {/* Header */}
        <div className="flex items-center justify-between px-4 md:px-8 mb-6">
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">🔥 Trending This Week</h2>
          <div className="flex items-center gap-3">
            <Link href="/trending" className="text-sm text-[var(--accent-primary)] hover:underline font-medium">
              View all
            </Link>
            <div className="flex gap-1.5">
              <button onClick={() => scroll('left')} className="p-2 rounded-full border border-[var(--border)] hover:border-[var(--accent-primary)] hover:bg-[var(--bg-hover)] transition-colors">
                <ChevronLeft size={16} className="text-[var(--text-secondary)]" />
              </button>
              <button onClick={() => scroll('right')} className="p-2 rounded-full border border-[var(--border)] hover:border-[var(--accent-primary)] hover:bg-[var(--bg-hover)] transition-colors">
                <ChevronRight size={16} className="text-[var(--text-secondary)]" />
              </button>
            </div>
          </div>
        </div>

        {/* Cards */}
        <div className="relative">
          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto px-4 md:px-8 pt-5 pb-4"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex-shrink-0" style={{ width: 224 }}>
                    <MovieCardSkeleton />
                  </div>
                ))
              : items.map((item) => (
                  <TrendingCard
                    key={item.id}
                    item={item}
                    mediaType={mediaType}
                    title={itemTitle(item)}
                    date={itemDate(item)}
                    href={itemHref(item)}
                  />
                ))}
          </div>
          <div className="pointer-events-none absolute left-0 top-0 bottom-4 w-10 bg-gradient-to-r from-[var(--bg-primary)] to-transparent" />
          <div className="pointer-events-none absolute right-0 top-0 bottom-4 w-10 bg-gradient-to-l from-[var(--bg-primary)] to-transparent" />
        </div>
      </div>
    </section>
  );
}

interface CardProps {
  item: Item;
  mediaType: 'movie' | 'tv';
  title: string;
  date: string | undefined;
  href: string;
}

function TrendingCard({ item, mediaType, title, date, href }: CardProps) {
  const { add, remove, has } = useWatchlistStore();
  const [imgError, setImgError]         = useState(false);
  const [hovered, setHovered]           = useState(false);
  const [trailerKey, setTrailerKey]     = useState<string | null>(null);
  const [trailerReady, setTrailerReady] = useState(false);
  const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const inWatchlist = has(item.id);
  const rt     = rtScore(item.vote_average);
  const mc     = mcScore(item.vote_average);
  const genres = genreNames(item.genre_ids ?? []);

  const fetchTrailer = useCallback(async () => {
    if (cardCache.has(item.id)) {
      const cached = cardCache.get(item.id) ?? null;
      setTrailerKey(cached);
      if (cached) {
        if (readyTimer.current) clearTimeout(readyTimer.current);
        readyTimer.current = setTimeout(() => setTrailerReady(true), 700);
      }
      return;
    }
    try {
      const isMovie = 'title' in item;
      const data    = isMovie ? await tmdb.movie.videos(item.id) : await tmdb.tv.videos(item.id);
      const key     = getTrailerKey(data as Parameters<typeof getTrailerKey>[0]);
      cardCache.set(item.id, key);
      setTrailerKey(key);
      if (key) {
        if (readyTimer.current) clearTimeout(readyTimer.current);
        readyTimer.current = setTimeout(() => setTrailerReady(true), 700);
      }
    } catch {
      cardCache.set(item.id, null);
    }
  }, [item]);

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
    else add({
      id: item.id, title, poster_path: item.poster_path,
      release_date: date ?? '', vote_average: item.vote_average,
      media_type: ('media_type' in item && item.media_type ? item.media_type : mediaType) as 'movie' | 'tv',
    });
  };

  return (
    <div className="flex-shrink-0" style={{ width: 224 }} onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <Link href={href} className="block">
        <div
          className="relative overflow-hidden rounded-2xl bg-[var(--bg-card)]"
          style={{
            aspectRatio: '2/3',
            boxShadow: hovered
              ? '0 0 0 2px var(--accent-primary), 0 20px 56px rgba(124,58,237,0.45)'
              : '0 4px 20px rgba(0,0,0,0.5)',
            transition: 'box-shadow 0.3s ease',
          }}
        >
          {item.poster_path && !imgError ? (
            <Image
              src={tmdbImage(item.poster_path, 'w342')} alt={title} fill className="object-cover"
              style={{ opacity: trailerReady ? 0 : 1, transition: 'opacity 0.5s ease' }}
              sizes="224px" onError={() => setImgError(true)}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[var(--text-muted)]"
              style={{ opacity: trailerReady ? 0 : 1, transition: 'opacity 0.5s ease' }}>
              <Eye size={32} /><span className="text-xs text-center px-2 line-clamp-2">{title}</span>
            </div>
          )}

          {trailerKey && hovered && (
            <div className="absolute inset-0 overflow-hidden rounded-2xl"
              style={{ opacity: trailerReady ? 1 : 0, transition: 'opacity 0.5s ease' }}>
              <iframe
                src={ytSrc(trailerKey)} allow="autoplay; encrypted-media"
                style={{
                  position: 'absolute', top: '50%', left: '50%',
                  width: '266.67%', height: '100%',
                  transform: 'translate(-50%, -50%)',
                  border: 'none', pointerEvents: 'none',
                }}
                title={`${title} trailer`}
              />
            </div>
          )}

          {hovered && !trailerReady && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm border border-white/30 flex items-center justify-center">
                <Play size={18} className="text-white fill-white ml-0.5" />
              </div>
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 rounded-b-2xl overflow-hidden"
            style={{
              background: 'linear-gradient(to top, rgba(0,0,0,0.96) 0%, rgba(0,0,0,0.8) 55%, transparent 100%)',
              maxHeight: hovered ? '78%' : '0%',
              transition: 'max-height 0.38s cubic-bezier(0.4,0,0.2,1)',
            }}>
            <div className="px-3 pt-10 pb-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1">
                  <span className="text-sm">{rt.icon}</span>
                  <span className="text-xs font-bold" style={{ color: rt.text }}>{rt.pct}%</span>
                </div>
                <div className="w-px h-3 bg-white/20" />
                <div className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-black"
                  style={{ background: mc.bg, color: mc.fg }}>{mc.pct}</div>
                <div className="w-px h-3 bg-white/20" />
                <Star size={11} className="text-amber-400 fill-current" />
                <span className="text-xs font-bold text-amber-400">{item.vote_average.toFixed(1)}</span>
              </div>
              {genres.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {genres.slice(0, 3).map((g) => (
                    <span key={g} className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 border border-white/10 text-white/80 font-medium">{g}</span>
                  ))}
                </div>
              )}
              {item.overview && (
                <p className="text-[11px] text-white/60 leading-relaxed line-clamp-3">{item.overview}</p>
              )}
              <div className="flex items-center justify-between pt-0.5">
                <div className="flex items-center gap-1 text-[10px] text-white/40">
                  <Calendar size={10} /><span>{formatYear(date)}</span>
                </div>
                <button onClick={handleWatchlist}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-[var(--accent-primary)] transition-colors"
                  aria-label={inWatchlist ? 'Remove' : 'Add to watchlist'}>
                  {inWatchlist
                    ? <BookmarkCheck size={13} className="text-white" />
                    : <BookmarkPlus size={13} className="text-white" />}
                </button>
              </div>
            </div>
          </div>

          <div className="absolute top-2 left-2 flex items-center gap-0.5 bg-black/70 backdrop-blur-sm rounded px-1.5 py-0.5">
            <Star size={10} className="text-amber-400 fill-current" />
            <span className="text-xs font-bold text-white">{item.vote_average.toFixed(1)}</span>
          </div>
          <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-black/70 backdrop-blur-sm rounded px-1.5 py-0.5">
            <span className="text-[11px] leading-none">{rt.icon}</span>
            <span className="text-[11px] font-bold" style={{ color: rt.text }}>{rt.pct}%</span>
          </div>
        </div>

        <div className="mt-3 px-1">
          <p className="text-sm font-semibold text-[var(--text-primary)] line-clamp-1">{title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-[var(--text-muted)]">{formatYear(date)}</span>
            {genres[0] && <><span className="text-xs text-[var(--text-muted)]">·</span><span className="text-xs text-[var(--text-muted)]">{genres[0]}</span></>}
          </div>
        </div>
      </Link>
    </div>
  );
}
