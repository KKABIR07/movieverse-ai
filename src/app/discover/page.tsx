import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Compass } from 'lucide-react';
import { discover, getGenres } from '@/lib/tmdb/server';
import { MediaGrid } from '@/components/media/MediaGrid';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { LoadError, load } from '@/components/browse/BrowseStates';
import { pageMeta } from '@/components/browse/meta';
import type { RawParams } from '@/components/browse/params';
import { toSummaries } from '@/components/browse/trim';
import { DiscoverFilters } from '@/components/discover/DiscoverFilters';
import { DEFAULT_STATE, describeDiscover, discoverHref, parseDiscover, toDiscoverFilters } from '@/components/discover/state';
import { formatCount } from '@/lib/format';

type Props = { searchParams: Promise<RawParams> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const state = parseDiscover(await searchParams);
  return pageMeta({
    title: 'Discover',
    description:
      'Find your next movie or show: filter TMDB by genre, release year, rating and original language, then sort by popularity, rating or release date.',
    // filter combinations are not separate documents; canonicalise to the type
    path: discoverHref({ ...DEFAULT_STATE, type: state.type }),
  });
}

export default async function DiscoverPage({ searchParams }: Props) {
  await connection();
  const state = parseDiscover(await searchParams);

  const [result, movieGenresRes, tvGenresRes] = await Promise.all([
    load(`discover/${state.type}`, discover(state.type, toDiscoverFilters(state))),
    load('genre/movie', getGenres('movie')),
    load('genre/tv', getGenres('tv')),
  ]);
  const movieGenres = movieGenresRes.ok ? movieGenresRes.data : [];
  const tvGenres = tvGenresRes.ok ? tvGenresRes.data : [];
  const names = new Map((state.type === 'tv' ? tvGenres : movieGenres).map((g) => [g.id, g.name]));

  const items = result.ok ? toSummaries(result.data.results, state.type) : [];
  const total = result.ok ? result.data.total_results : 0;
  const reset = discoverHref({ ...DEFAULT_STATE, type: state.type });

  return (
    <>
      <PageHeader
        eyebrow="Discover"
        title="Find something to watch"
        description={
          <>
            {describeDiscover(state, names)}
            {result.ok && (
              <span className="text-fg-muted tabular">
                {' '}
                · {formatCount(total)} {total === 1 ? 'title' : 'titles'}
              </span>
            )}
          </>
        }
      />
      <DiscoverFilters
        state={state}
        movieGenres={movieGenres}
        tvGenres={tvGenres}
        currentYear={new Date().getUTCFullYear()}
      />
      <section aria-label="Results" className="px-gutter pb-8 pt-8">
        {!result.ok ? (
          <LoadError retryHref={discoverHref(state)} />
        ) : (
          <MediaGrid
            items={items}
            label="Discover results"
            preloadCount={state.page === 1 ? 6 : 0}
            empty={
              <EmptyState
                icon={<Compass />}
                title="No titles match these filters"
                description="Try fewer genres, a wider year range or a lower minimum rating."
                action={
                  <Button href={reset} variant="secondary">
                    Clear filters
                  </Button>
                }
              />
            }
          />
        )}
        {result.ok && items.length > 0 && (
          <Pagination page={state.page} totalPages={result.data.total_pages} hrefForPage={(p) => discoverHref({ ...state, page: p })} />
        )}
      </section>
    </>
  );
}
