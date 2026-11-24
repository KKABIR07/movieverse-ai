import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { paginationRange } from './paginationRange';
import { cn } from './cn';

/** TMDB refuses page > 500. */
export const TMDB_MAX_PAGE = 500;

export interface PaginationProps {
  page: number;
  totalPages: number;
  /** Build the URL for a page, e.g. (p) => `/movies?page=${p}`. */
  hrefForPage: (page: number) => string;
  /** Clamp to TMDB's 500 page limit (default true). */
  clampToTmdb?: boolean;
  siblings?: number;
  /** Accessible name for the nav. */
  label?: string;
  className?: string;
}

const item =
  'inline-flex h-11 min-w-11 items-center justify-center rounded-control px-3 text-caption font-medium tabular transition-colors';

/**
 * Link-based pagination (crawlable, works without JS). Current page has aria-current="page".
 * @example <Pagination page={page} totalPages={data.total_pages} hrefForPage={(p) => `/movies?page=${p}`} />
 */
export function Pagination({
  page,
  totalPages,
  hrefForPage,
  clampToTmdb = true,
  siblings = 1,
  label = 'Pagination',
  className,
}: PaginationProps) {
  const total = clampToTmdb ? Math.min(totalPages, TMDB_MAX_PAGE) : totalPages;
  if (total <= 1) return null;
  const current = Math.min(Math.max(1, page), total);
  const tokens = paginationRange(current, total, siblings);

  return (
    <nav aria-label={label} className={cn('flex items-center justify-center gap-1 py-8', className)}>
      {current > 1 ? (
        <Link href={hrefForPage(current - 1)} rel="prev" className={cn(item, 'text-fg-secondary hover:text-fg hover:bg-surface-2')}>
          <ChevronLeft aria-hidden className="size-4" />
          <span className="sr-only sm:not-sr-only sm:ml-1">Previous</span>
        </Link>
      ) : (
        <span aria-hidden className={cn(item, 'text-fg-muted/50')}>
          <ChevronLeft className="size-4" />
          <span className="hidden sm:inline sm:ml-1">Previous</span>
        </span>
      )}

      <ul className="flex items-center gap-1">
        {tokens.map((t) =>
          typeof t === 'number' ? (
            <li key={t} className={cn(t !== current && Math.abs(t - current) > 1 && t !== 1 && t !== total && 'hidden sm:block')}>
              <Link
                href={hrefForPage(t)}
                aria-current={t === current ? 'page' : undefined}
                aria-label={`Page ${t}`}
                className={cn(
                  item,
                  t === current ? 'bg-fg text-ground' : 'text-fg-secondary hover:text-fg hover:bg-surface-2',
                )}
              >
                {t}
              </Link>
            </li>
          ) : (
            <li key={t} aria-hidden className="px-1 text-fg-muted">
              …
            </li>
          ),
        )}
      </ul>

      {current < total ? (
        <Link href={hrefForPage(current + 1)} rel="next" className={cn(item, 'text-fg-secondary hover:text-fg hover:bg-surface-2')}>
          <span className="sr-only sm:not-sr-only sm:mr-1">Next</span>
          <ChevronRight aria-hidden className="size-4" />
        </Link>
      ) : (
        <span aria-hidden className={cn(item, 'text-fg-muted/50')}>
          <span className="hidden sm:inline sm:mr-1">Next</span>
          <ChevronRight className="size-4" />
        </span>
      )}
    </nav>
  );
}
