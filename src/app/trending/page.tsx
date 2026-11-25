import type { Metadata } from 'next';
import { connection } from 'next/server';
import { getTrending } from '@/lib/tmdb/server';
import { BrowseList } from '@/components/browse/BrowseList';
import { load } from '@/components/browse/BrowseStates';
import { FilterLinks } from '@/components/browse/FilterLinks';
import { pageMeta } from '@/components/browse/meta';
import { buildHref, parsePage, pick, type RawParams } from '@/components/browse/params';

const TYPES = ['all', 'movie', 'tv'] as const;
const WINDOWS = ['week', 'day'] as const;
type Props = { searchParams: Promise<RawParams> };

const TYPE_LABEL = { all: 'Movies & shows', movie: 'Movies', tv: 'TV shows' } as const;

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const type = pick(sp.type, TYPES, 'all');
  const title = type === 'all' ? 'Trending movies & shows' : `Trending ${TYPE_LABEL[type].toLowerCase()}`;
  return pageMeta({
    title,
    description: 'What everyone is watching today and this week, updated hourly from TMDB.',
    path: buildHref('/trending', { type }, { type: 'all' }),
  });
}

export default async function TrendingPage({ searchParams }: Props) {
  await connection();
  const sp = await searchParams;
  const type = pick(sp.type, TYPES, 'all');
  const window = pick(sp.window, WINDOWS, 'week');
  const page = parsePage(sp.page);
  const href = (p: Partial<{ type: string; window: string; page: number }>) =>
    buildHref('/trending', { type, window, page, ...p }, { type: 'all', window: 'week' });

  const result = await load('trending', getTrending(type, window, page));

  return (
    <BrowseList
      eyebrow="Trending"
      title={type === 'all' ? 'Trending movies & shows' : `Trending ${TYPE_LABEL[type].toLowerCase()}`}
      description={window === 'day' ? 'The most-watched titles in the last 24 hours.' : 'The most-watched titles this week.'}
      filters={
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
          <FilterLinks
            label="Content type"
            value={type}
            options={TYPES.map((t) => ({ value: t, label: t === 'all' ? 'All' : TYPE_LABEL[t], href: href({ type: t, page: 1 }) }))}
          />
          <FilterLinks
            label="Time window"
            value={window}
            options={[
              { value: 'day', label: 'Today', href: href({ window: 'day', page: 1 }) },
              { value: 'week', label: 'This week', href: href({ window: 'week', page: 1 }) },
            ]}
          />
        </div>
      }
      result={result}
      mediaType={type === 'all' ? undefined : type}
      page={page}
      hrefForPage={(p) => href({ page: p })}
      retryHref={href({})}
      label={`Trending ${TYPE_LABEL[type].toLowerCase()}`}
    />
  );
}
