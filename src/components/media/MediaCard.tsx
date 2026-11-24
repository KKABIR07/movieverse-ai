'use client';

import Image from 'next/image';
import Link from 'next/link';
import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { Film, Tv } from 'lucide-react';
import { tmdb, getTrailerKey } from '@/lib/tmdb';
import { formatYear } from '@/lib/format';
import { useCanHover } from '@/lib/hooks/useMediaQuery';
import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';
import { Rating } from '@/components/ui/Rating';
import { cn } from '@/components/ui/cn';
import { tmdbPosterLoader, POSTER_SIZES } from './tmdbImage';
import { WatchlistButton } from './WatchlistButton';
import { mediaHref, toMediaSummary, type MediaInput, type MediaType } from './types';

const HOVER_DELAY_MS = 800;
const trailerCache = new Map<string, string | null>();

async function loadTrailer(id: number, type: MediaType): Promise<string | null> {
  const key = `${type}:${id}`;
  if (trailerCache.has(key)) return trailerCache.get(key) ?? null;
  try {
    const data = type === 'tv' ? await tmdb.tv.videos(id) : await tmdb.movie.videos(id);
    const k = getTrailerKey(data);
    trailerCache.set(key, k);
    return k;
  } catch {
    trailerCache.set(key, null);
    return null;
  }
}

export interface MediaCardProps {
  item: MediaInput;
  /** Force movie/tv when the source object is ambiguous. */
  mediaType?: MediaType;
  /** `sizes` attribute for the poster. Defaults to the MediaGrid preset; Rail passes its own. */
  sizes?: string;
  /** Preload the poster (only for the first visible row of a page's LCP area). */
  preload?: boolean;
  showRating?: boolean;
  showWatchlist?: boolean;
  /** Muted trailer on hover (pointer devices only, after 800ms, off for reduced motion). */
  trailerPreview?: boolean;
  /** Replace the "2024 · Movie" line. */
  meta?: ReactNode;
  /** Heading level for the title (default h3). */
  headingLevel?: 'h2' | 'h3' | 'h4';
  className?: string;
}

/**
 * Poster card for a movie or TV show → /movie/:id or /tv/:id.
 * The watchlist toggle is a sibling of the link (never nested), visible on hover,
 * on keyboard focus, on touch screens, and whenever the title is saved.
 * @example <MediaCard item={movie} />
 * @example <MediaCard item={result} mediaType="tv" sizes={POSTER_SIZES.rail} trailerPreview />
 */
function MediaCardImpl({
  item,
  mediaType,
  sizes = POSTER_SIZES.grid,
  preload = false,
  showRating = true,
  showWatchlist = true,
  trailerPreview = false,
  meta,
  headingLevel: Heading = 'h3',
  className,
}: MediaCardProps) {
  const m = toMediaSummary(item, mediaType);
  const href = mediaHref(m);
  const year = formatYear(m.date, '');
  const typeLabel = m.mediaType === 'tv' ? 'TV' : 'Movie';

  const canHover = useCanHover();
  const reducedMotion = usePrefersReducedMotion();
  const previewEnabled = trailerPreview && canHover && !reducedMotion;
  const [trailer, setTrailer] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hovering = useRef(false);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const startPreview = () => {
    if (!previewEnabled) return;
    hovering.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const key = await loadTrailer(m.id, m.mediaType);
      if (hovering.current && key) setTrailer(key);
    }, HOVER_DELAY_MS);
  };
  const stopPreview = () => {
    hovering.current = false;
    if (timer.current) clearTimeout(timer.current);
    setTrailer(null);
  };

  return (
    <article
      className={cn('group/card relative', className)}
      onPointerEnter={startPreview}
      onPointerLeave={stopPreview}
    >
      <Link href={href} className="block rounded-card outline-offset-4">
        <div className="relative aspect-[2/3] overflow-hidden rounded-card bg-surface-2 ring-1 ring-inset ring-white/5">
          {m.posterPath ? (
            <Image
              loader={tmdbPosterLoader}
              src={m.posterPath}
              alt=""
              fill
              sizes={sizes}
              preload={preload}
              className="object-cover transition-transform duration-320 ease-projector [@media(hover:hover)]:group-hover/card:scale-[1.03]"
            />
          ) : (
            <div aria-hidden className="absolute inset-0 grid place-items-center text-fg-muted">
              {m.mediaType === 'tv' ? <Tv className="size-8" /> : <Film className="size-8" />}
            </div>
          )}

          {trailer && (
            <iframe
              title={`${m.title} trailer preview`}
              aria-hidden
              tabIndex={-1}
              src={`https://www.youtube-nocookie.com/embed/${trailer}?autoplay=1&mute=1&controls=0&playsinline=1&loop=1&playlist=${trailer}&modestbranding=1&rel=0`}
              allow="autoplay; encrypted-media"
              className="hover-only pointer-events-none absolute inset-0 h-full w-full scale-[1.6] animate-fade-in"
            />
          )}

          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ground/80 to-transparent"
          />
          {showRating && (
            <Rating value={m.rating} voteCount={m.voteCount} size="sm" className="absolute bottom-2 left-2" />
          )}
        </div>

        <Heading className="mt-2.5 line-clamp-1 text-caption font-semibold text-fg group-hover/card:text-accent transition-colors">
          {m.title}
        </Heading>
        <p className="mt-0.5 text-micro text-fg-muted tabular">
          {meta ?? (
            <>
              {year && <span>{year}</span>}
              {year && <span aria-hidden> · </span>}
              <span>{typeLabel}</span>
            </>
          )}
        </p>
      </Link>

      {showWatchlist && (
        <div
          className={cn(
            'absolute right-2 top-2 transition-opacity duration-120',
            '[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/card:opacity-100',
            'group-focus-within/card:!opacity-100 has-[[aria-pressed=true]]:!opacity-100',
          )}
        >
          <WatchlistButton item={m} className="before:absolute before:-inset-1 before:content-['']" />
        </div>
      )}
    </article>
  );
}

export const MediaCard = memo(MediaCardImpl);
