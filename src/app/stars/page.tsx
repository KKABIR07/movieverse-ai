import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Users } from 'lucide-react';
import { getPopularPeople, getTrendingPeople, searchPeople } from '@/lib/tmdb/server';
import { PersonCard } from '@/components/media/PersonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { LoadError, PERSON_GRID_COLS, load } from '@/components/browse/BrowseStates';
import { FilterLinks } from '@/components/browse/FilterLinks';
import { LiveSearchInput } from '@/components/browse/LiveSearchInput';
import { pageMeta } from '@/components/browse/meta';
import { buildHref, first, parsePage, pick, type RawParams } from '@/components/browse/params';
import { toPeople } from '@/components/browse/trim';
import { formatCount } from '@/lib/format';

const LISTS = ['popular', 'trending'] as const;
type Props = { searchParams: Promise<RawParams> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const q = (first(sp.q) ?? '').slice(0, 100);
  const list = pick(sp.list, LISTS, 'popular');
  return pageMeta({
    title: q ? `People matching “${q}”` : list === 'trending' ? 'Trending people' : 'Popular people',
    description: 'Actors, directors and creators: who is popular and trending on TMDB this week.',
    path: buildHref('/stars', { list }, { list: 'popular' }),
    noindex: !!q,
  });
}

export default async function StarsPage({ searchParams }: Props) {
  await connection();
  const sp = await searchParams;
  const q = (first(sp.q) ?? '').slice(0, 100);
  const list = pick(sp.list, LISTS, 'popular');
  const page = parsePage(sp.page);
  const href = (p: Partial<{ list: string; page: number }>) =>
    buildHref('/stars', { q: q || undefined, list: q ? undefined : list, page, ...p }, { list: 'popular' });

  const result = q
    ? await load('search/person', searchPeople(q, page))
    : list === 'trending'
      ? await load('trending/person', getTrendingPeople('week', page))
      : await load('person/popular', getPopularPeople(page));
  const people = result.ok ? toPeople(result.data.results) : [];

  return (
    <>
      <PageHeader
        eyebrow="People"
        title={q ? <>People matching “{q}”</> : list === 'trending' ? 'Trending people' : 'Popular people'}
        description="Actors, directors and creators, ranked by TMDB popularity."
      >
        <div className="flex flex-col gap-4">
          <LiveSearchInput
            action="/stars"
            value={q}
            label="Search people"
            placeholder="Search actors, directors…"
            keep={{ list: list === 'popular' ? undefined : list }}
          />
          {!q && (
            <FilterLinks
              label="People list"
              value={list}
              options={[
                { value: 'popular', label: 'Popular', href: buildHref('/stars', {}) },
                { value: 'trending', label: 'Trending this week', href: buildHref('/stars', { list: 'trending' }) },
              ]}
            />
          )}
        </div>
      </PageHeader>

      <div className="px-gutter pb-8">
        {!result.ok ? (
          <LoadError retryHref={href({})} title="Could not load people" />
        ) : people.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title={q ? `No people found for “${q}”` : 'No people to show'}
            description={q ? 'Check the spelling or try a shorter name.' : 'TMDB returned no people for this list.'}
          />
        ) : (
          <>
            {q && (
              <p role="status" className="mb-6 text-caption text-fg-muted tabular">
                {formatCount(result.data.total_results)} {result.data.total_results === 1 ? 'person' : 'people'}
              </p>
            )}
            <ul aria-label="People" className={PERSON_GRID_COLS}>
              {people.map((p) => (
                <li key={p.id}>
                  <PersonCard person={p} />
                </li>
              ))}
            </ul>
            <Pagination page={page} totalPages={result.data.total_pages} hrefForPage={(p) => href({ page: p })} label="People pages" />
          </>
        )}
      </div>
    </>
  );
}
