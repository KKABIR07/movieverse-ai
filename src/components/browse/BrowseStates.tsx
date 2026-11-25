import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/EmptyState';
import { MediaCardSkeleton } from '@/components/ui/Skeleton';
import { MEDIA_GRID_COLS } from '@/components/media/MediaGrid';
import { logger } from '@/lib/server/logger';

const log = logger.child({ component: 'browse' });

export type Loaded<T> = { ok: true; data: T } | { ok: false };

/** Await a TMDB call; log and return `{ ok: false }` instead of throwing, so a page can degrade. */
export async function load<T>(what: string, p: Promise<T>): Promise<Loaded<T>> {
  try {
    return { ok: true, data: await p };
  } catch (err) {
    log.warn('tmdb load failed', { what, err });
    return { ok: false };
  }
}

/** Server-rendered failure block with a link-based retry (the current URL). */
export function LoadError({ retryHref, title, description, className }: { retryHref: string; title?: string; description?: string; className?: string }) {
  return (
    <div className={className}>
      <ErrorState
        title={title ?? 'Could not load titles'}
        description={description ?? 'TMDB did not answer in time. Try again in a moment.'}
      />
      <div className="mt-4 flex justify-center">
        <Button href={retryHref} variant="secondary" leadingIcon={<RotateCcw />}>
          Try again
        </Button>
      </div>
    </div>
  );
}

/** Person grid columns (3 → 8). */
export const PERSON_GRID_COLS = 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-x-4 gap-y-8';

/** Skeleton for a list page: header, filter row, poster (or person) grid. Matches the real layout. */
export function BrowsePageSkeleton({ filters = 1, kind = 'media', count = 18 }: { filters?: number; kind?: 'media' | 'person'; count?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="px-gutter pt-8 pb-6 md:pt-12 md:pb-8">
        <div className="skeleton mb-3 h-3 w-20 rounded-chip" />
        <div className="skeleton h-10 w-64 max-w-full rounded-chip md:h-14" />
        <div className="skeleton mt-4 h-4 w-96 max-w-full rounded-chip" />
        {Array.from({ length: filters }).map((_, i) => (
          <div key={i} className="mt-6 flex gap-2">
            {Array.from({ length: 4 }).map((__, j) => (
              <div key={j} className="skeleton h-10 w-24 rounded-full" />
            ))}
          </div>
        ))}
      </div>
      <div className="px-gutter pb-16">
        {kind === 'media' ? (
          <div className={MEDIA_GRID_COLS}>
            {Array.from({ length: count }).map((_, i) => (
              <MediaCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className={PERSON_GRID_COLS}>
            {Array.from({ length: count }).map((_, i) => (
              <div key={i} aria-hidden className="flex flex-col items-center gap-2.5">
                <div className="skeleton aspect-square w-24 rounded-full" />
                <div className="skeleton h-3.5 w-20 rounded-chip" />
                <div className="skeleton h-3 w-14 rounded-chip" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
