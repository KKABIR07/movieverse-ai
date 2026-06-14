'use client';

import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MovieCard } from './MovieCard';
import { MovieCardSkeleton } from '@/components/ui/Skeleton';
import type { Movie, TVShow } from '@/types/tmdb';

interface HorizontalScrollProps {
  title: string;
  items: (Movie | TVShow)[];
  mediaType?: 'movie' | 'tv';
  loading?: boolean;
  viewAllHref?: string;
}

export function HorizontalScroll({ title, items, mediaType = 'movie', loading = false, viewAllHref }: HorizontalScrollProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: 'left' | 'right') => {
    if (!containerRef.current) return;
    const amount = containerRef.current.clientWidth * 0.75;
    containerRef.current.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  return (
    <section className="pt-4 pb-8">
      <div className="flex items-center justify-between mb-5 px-4 md:px-8">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">{title}</h2>
        <div className="flex items-center gap-3">
          {viewAllHref && (
            <a href={viewAllHref} className="text-sm text-[var(--accent-primary)] hover:underline font-medium">
              View all
            </a>
          )}
          <div className="flex gap-1.5">
            <button
              onClick={() => scroll('left')}
              className="p-1.5 rounded-full border border-[var(--border)] hover:border-[var(--accent-primary)] hover:bg-[var(--bg-hover)] transition-colors"
              aria-label="Scroll left"
            >
              <ChevronLeft size={16} className="text-[var(--text-secondary)]" />
            </button>
            <button
              onClick={() => scroll('right')}
              className="p-1.5 rounded-full border border-[var(--border)] hover:border-[var(--accent-primary)] hover:bg-[var(--bg-hover)] transition-colors"
              aria-label="Scroll right"
            >
              <ChevronRight size={16} className="text-[var(--text-secondary)]" />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide px-4 md:px-8 pt-5 pb-3"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {loading
          ? Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-40 sm:w-44">
                <MovieCardSkeleton />
              </div>
            ))
          : items.map((item) => (
              <div key={item.id} className="flex-shrink-0 w-40 sm:w-44">
                <MovieCard item={item} mediaType={mediaType} />
              </div>
            ))}
      </div>
    </section>
  );
}
