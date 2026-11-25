import type { ReactNode } from 'react';
import { Film } from 'lucide-react';
import { MediaGrid } from '@/components/media/MediaGrid';
import type { MediaType } from '@/components/media/types';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { LoadError, type Loaded } from './BrowseStates';
import { toSummaries } from './trim';

export interface BrowseListProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Filter rows under the title (FilterLinks…). */
  filters?: ReactNode;
  result: Loaded<{ results: readonly unknown[]; total_pages: number; total_results?: number }>;
  mediaType?: MediaType;
  page: number;
  hrefForPage: (page: number) => string;
  /** Current URL, used by the retry link. */
  retryHref: string;
  /** Accessible name for the grid. */
  label: string;
  emptyTitle?: string;
  emptyDescription?: string;
}

/** Header + filters + poster grid + link pagination: the shared list-page body. Server component. */
export function BrowseList({
  eyebrow,
  title,
  description,
  filters,
  result,
  mediaType,
  page,
  hrefForPage,
  retryHref,
  label,
  emptyTitle = 'Nothing to show',
  emptyDescription = 'TMDB returned no titles for this view.',
}: BrowseListProps) {
  const items = result.ok ? toSummaries(result.data.results, mediaType) : [];
  const totalPages = result.ok ? result.data.total_pages : 0;
  const pastEnd = result.ok && items.length === 0 && page > 1;

  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} description={description}>
        {filters}
      </PageHeader>
      <div className="px-gutter pb-8">
        {!result.ok ? (
          <LoadError retryHref={retryHref} />
        ) : (
          <MediaGrid
            items={items}
            label={label}
            preloadCount={page === 1 ? 6 : 0}
            empty={
              <EmptyState
                icon={<Film />}
                title={pastEnd ? 'No more pages' : emptyTitle}
                description={pastEnd ? 'You reached the end of this list.' : emptyDescription}
                action={
                  pastEnd ? (
                    <Button href={hrefForPage(1)} variant="secondary">
                      Back to page 1
                    </Button>
                  ) : undefined
                }
              />
            }
          />
        )}
        {result.ok && items.length > 0 && <Pagination page={page} totalPages={totalPages} hrefForPage={hrefForPage} />}
      </div>
    </>
  );
}
