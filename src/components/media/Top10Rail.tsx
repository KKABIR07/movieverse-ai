'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Film } from 'lucide-react';
import { Rating } from '@/components/ui/Rating';
import { cn } from '@/components/ui/cn';
import { formatYear } from '@/lib/format';
import { Rail } from './Rail';
import { tmdbPosterLoader } from './tmdbImage';
import { WatchlistButton } from './WatchlistButton';
import { mediaHref, toMediaSummary, type MediaInput, type MediaType } from './types';

export interface Top10RailProps {
  title?: ReactNode;
  href?: string;
  eyebrow?: ReactNode;
  /** First 10 are used. */
  items: readonly MediaInput[];
  mediaType?: MediaType;
  loading?: boolean;
  className?: string;
}

function Top10Skeleton() {
  return (
    <div aria-hidden className="flex items-end">
      <div className="w-[38%]" />
      <div className="skeleton aspect-[2/3] w-[62%] rounded-card" />
    </div>
  );
}

/**
 * Ranked rail with big outlined numerals (Netflix-style "Top 10").
 * @example <Top10Rail title="Top 10 movies this week" items={trending.results} mediaType="movie" />
 */
export function Top10Rail({ title = 'Top 10 this week', href, eyebrow, items, mediaType, loading, className }: Top10RailProps) {
  const top = items.slice(0, 10).map((i) => toMediaSummary(i, mediaType));
  return (
    <Rail
      title={title}
      href={href}
      eyebrow={eyebrow}
      variant="top10"
      gap={8}
      loading={loading}
      skeleton={<Top10Skeleton />}
      skeletonCount={6}
      className={className}
    >
      {top.map((m, i) => (
        <div key={`${m.mediaType}:${m.id}`} className="group/top relative">
          <Link href={mediaHref(m)} className="flex items-end rounded-card outline-offset-4">
            <span className="sr-only">Number {i + 1}: </span>
            <span
              aria-hidden
              className={cn(
                'relative z-0 w-[38%] shrink-0 select-none text-right font-bold tabular leading-[0.78] tracking-[-0.06em]',
                'text-[clamp(5.5rem,22vw,9rem)] text-ground [-webkit-text-stroke:2px_var(--color-line-strong)]',
                'transition-[-webkit-text-stroke-color] duration-200 group-hover/top:[-webkit-text-stroke-color:var(--color-accent)]',
                i === 9 && 'tracking-[-0.12em] text-[clamp(4.5rem,18vw,7.5rem)]',
              )}
            >
              {i + 1}
            </span>
            <span className="relative z-10 -ml-3 block w-[62%]">
              <span className="relative block aspect-[2/3] overflow-hidden rounded-card bg-surface-2 ring-1 ring-inset ring-white/5">
                {m.posterPath ? (
                  <Image
                    loader={tmdbPosterLoader}
                    src={m.posterPath}
                    alt=""
                    fill
                    sizes="(min-width: 640px) 175px, 38vw"
                    className="object-cover"
                  />
                ) : (
                  <Film aria-hidden className="absolute inset-0 m-auto size-8 text-fg-muted" />
                )}
                <Rating value={m.rating} voteCount={m.voteCount} size="sm" className="absolute bottom-2 left-2" />
              </span>
              <span className="mt-2 block truncate text-caption font-semibold text-fg group-hover/top:text-accent">
                {m.title}
              </span>
              <span className="block text-micro text-fg-muted tabular">{formatYear(m.date, '')}</span>
            </span>
          </Link>
          <div className="absolute right-2 top-2 z-20 [@media(hover:hover)]:opacity-0 group-hover/top:opacity-100 group-focus-within/top:!opacity-100 has-[[aria-pressed=true]]:!opacity-100 transition-opacity">
            <WatchlistButton item={m} />
          </div>
        </div>
      ))}
    </Rail>
  );
}
