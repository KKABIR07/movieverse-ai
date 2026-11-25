import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { SearchX } from 'lucide-react';
import { getGenres, getTrending, searchMovies, searchMulti, searchPeople, searchTv } from '@/lib/tmdb/server';
import { MediaGrid, PersonCard, Rail } from '@/components/media';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { chipClass } from '@/components/ui/Chip';
import { LoadError, PERSON_GRID_COLS, load } from '@/components/browse/BrowseStates';
import { FilterLinks } from '@/components/browse/FilterLinks';
import { GenreTiles } from '@/components/browse/GenreTiles';
import { SearchForm } from '@/components/browse/SearchForm';
import { pageMeta } from '@/components/browse/meta';
import { buildHref, first, parsePage, pick, type RawParams } from '@/components/browse/params';
import { toPeople, toSummaries } from '@/components/browse/trim';
import { formatCount } from '@/lib/format';

const TABS = ['all', 'movie', 'tv', 'person'] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = { all: 'All', movie: 'Movies', tv: 'TV shows', person: 'People' };
type Props = { searchParams: Promise<RawParams> };

const readQuery = (sp: RawParams) => (first(sp.q) ?? '').slice(0, 100);

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = readQuery(await searchParams);
  return pageMeta({
    title: q ? `Search results for “${q}”` : 'Search',
    description: 'Search movies, TV shows and people on mkmovies.',
    path: '/search',
    noindex: true,
  });
}

export default async function SearchPage({ searchParams }: Props) {
  await connection();
  const sp = await searchParams;
  const q = readQuery(sp);
  const tab = pick(sp.type, TABS, 'all');
  const page = parsePage(sp.page);
  const href = (p: Partial<{ type: Tab; page: number }>) => buildHref('/search', { q, type: tab, page, ...p }, { type: 'all' });

  return (
    <>
      <PageHeader eyebrow="Search" title={q ? <>Results for “{q}”</> : 'Search'}>
        <div className="flex flex-col gap-4">
          <SearchForm
            key={q}
            action="/search"
            defaultValue={q}
            label="Search movies, TV shows and people"
            placeholder="Search movies, TV shows, people"
            hidden={{ type: tab === 'all' ? undefined : tab }}
          />
          {q && (
            <FilterLinks
              label="Result type"
              value={tab}
              options={TABS.map((t) => ({ value: t, label: TAB_LABEL[t], href: href({ type: t, page: 1 }) }))}
            />
          )}
        </div>
      </PageHeader>
      <div className="px-gutter pb-8">{q ? <Results q={q} tab={tab} page={page} href={href} /> : <NoQuery />}</div>
    </>
  );
}

async function Results({ q, tab, page, href }: { q: string; tab: Tab; page: number; href: (p: Partial<{ type: Tab; page: number }>) => string }) {
  const retry = href({});
  const empty = (
    <EmptyState
      icon={<SearchX />}
      title={`No ${tab === 'all' ? 'results' : TAB_LABEL[tab].toLowerCase()} for “${q}”`}
      description="Check the spelling, or try a shorter or different title."
    />
  );
  const pager = (total: number) => <Pagination page={page} totalPages={total} hrefForPage={(p) => href({ page: p })} label="Search results pages" />;
  const count = (n: number) => (
    <p className="mb-6 text-caption text-fg-muted tabular" role="status">
      {formatCount(n)} {n === 1 ? 'result' : 'results'}
    </p>
  );

  if (tab === 'person') {
    const res = await load('search/person', searchPeople(q, page));
    if (!res.ok) return <LoadError retryHref={retry} title="Search failed" />;
    const people = toPeople(res.data.results);
    if (!people.length) return empty;
    return (
      <>
        {count(res.data.total_results)}
        <ul aria-label="People" className={PERSON_GRID_COLS}>
          {people.map((p) => (
            <li key={p.id}>
              <PersonCard person={p} />
            </li>
          ))}
        </ul>
        {pager(res.data.total_pages)}
      </>
    );
  }

  if (tab === 'movie' || tab === 'tv') {
    const res = tab === 'movie' ? await load('search/movie', searchMovies(q, page)) : await load('search/tv', searchTv(q, page));
    if (!res.ok) return <LoadError retryHref={retry} title="Search failed" />;
    const items = toSummaries(res.data.results, tab);
    if (!items.length) return empty;
    return (
      <>
        {count(res.data.total_results)}
        <MediaGrid items={items} label={TAB_LABEL[tab]} />
        {pager(res.data.total_pages)}
      </>
    );
  }

  const res = await load('search/multi', searchMulti(q, page));
  if (!res.ok) return <LoadError retryHref={retry} title="Search failed" />;
  const media = toSummaries(res.data.results);
  const people = toPeople(
    res.data.results
      .filter((r) => r.media_type === 'person')
      .map((r) => ({ id: r.id, name: r.name ?? '', profile_path: r.profile_path ?? null, media_type: 'person' })),
  );
  if (!media.length && !people.length) return empty;
  return (
    <>
      {count(res.data.total_results)}
      {people.length > 0 && (
        <div className="-mx-[var(--gutter)] mb-10">
          <Rail title="People" href={href({ type: 'person', page: 1 })} variant="person">
            {people.map((p) => (
              <PersonCard key={p.id} person={p} />
            ))}
          </Rail>
        </div>
      )}
      {media.length > 0 && (
        <section aria-labelledby="titles-heading">
          <h2 id="titles-heading" className="mb-4 text-h2 text-fg">
            Movies &amp; TV
          </h2>
          <MediaGrid items={media} label="Movies and TV shows" />
        </section>
      )}
      {pager(res.data.total_pages)}
    </>
  );
}

async function NoQuery() {
  const [trending, genres] = await Promise.all([load('trending/all/week', getTrending('all', 'week')), load('genre/movie', getGenres('movie'))]);
  const year = new Date().getUTCFullYear();
  const years = Array.from({ length: 12 }, (_, i) => year - i);
  const items = trending.ok ? toSummaries(trending.data.results).slice(0, 12) : [];

  return (
    <div className="flex flex-col gap-12">
      {items.length > 0 && (
        <section aria-labelledby="trending-heading">
          <SectionHeader id="trending-heading" title="Trending this week" href="/trending" />
          <MediaGrid items={items} label="Trending this week" />
        </section>
      )}
      {genres.ok && genres.data.length > 0 && (
        <section aria-labelledby="genres-heading">
          <SectionHeader id="genres-heading" title="Browse by genre" />
          <GenreTiles genres={genres.data} />
        </section>
      )}
      <section aria-labelledby="years-heading">
        <SectionHeader id="years-heading" title="Browse by year" />
        <ul className="flex flex-wrap gap-2">
          {years.map((y) => (
            <li key={y}>
              <Link href={`/discover?year_from=${y}&year_to=${y}`} className={chipClass(false, 'md')}>
                {y}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
