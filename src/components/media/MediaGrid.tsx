import type { ReactNode } from 'react';
import { MediaCardSkeleton } from '@/components/ui/Skeleton';
import { cn } from '@/components/ui/cn';
import { MediaCard } from './MediaCard';
import { POSTER_SIZES } from './tmdbImage';
import { toMediaSummary, type MediaInput, type MediaType } from './types';

export interface MediaGridProps {
  items: readonly MediaInput[] | undefined;
  mediaType?: MediaType;
  loading?: boolean;
  /** Skeleton count while loading (default 18 = 3 rows at xl). */
  skeletonCount?: number;
  /** Rendered when not loading and there are no items (e.g. an <EmptyState />). */
  empty?: ReactNode;
  /** Preload the first N posters (LCP). Default 0. */
  preloadCount?: number;
  trailerPreview?: boolean;
  /** Custom cell renderer; defaults to <MediaCard />. */
  renderItem?: (item: MediaInput, index: number) => ReactNode;
  /** Accessible name for the list. */
  label?: string;
  className?: string;
}

/** Column classes; MediaCard's default `sizes` (POSTER_SIZES.grid) matches these. */
export const MEDIA_GRID_COLS = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8';

/**
 * Responsive poster grid (2 → 6 columns) with a skeleton state.
 * @example <MediaGrid items={data?.results} loading={isLoading} empty={<EmptyState title="No results" />} />
 */
export function MediaGrid({
  items,
  mediaType,
  loading = false,
  skeletonCount = 18,
  empty,
  preloadCount = 0,
  trailerPreview,
  renderItem,
  label,
  className,
}: MediaGridProps) {
  if (loading) {
    return (
      <div aria-busy="true" aria-label={label ? `${label}, loading` : 'Loading'} className={cn(MEDIA_GRID_COLS, className)}>
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <MediaCardSkeleton key={i} />
        ))}
      </div>
    );
  }
  if (!items?.length) return <>{empty ?? null}</>;
  return (
    <ul aria-label={label} className={cn(MEDIA_GRID_COLS, className)}>
      {items.map((item, i) => {
        const m = toMediaSummary(item, mediaType);
        return (
          <li key={`${m.mediaType}:${m.id}`}>
            {renderItem ? (
              renderItem(item, i)
            ) : (
              <MediaCard item={m} sizes={POSTER_SIZES.grid} preload={i < preloadCount} trailerPreview={trailerPreview} />
            )}
          </li>
        );
      })}
    </ul>
  );
}
