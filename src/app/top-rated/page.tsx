import type { Metadata } from 'next';
import { connection } from 'next/server';
import { getMovieList, getTvList } from '@/lib/tmdb/server';
import { BrowseList } from '@/components/browse/BrowseList';
import { load } from '@/components/browse/BrowseStates';
import { FilterLinks } from '@/components/browse/FilterLinks';
import { pageMeta } from '@/components/browse/meta';
import { buildHref, parsePage, pick, type RawParams } from '@/components/browse/params';

const TYPES = ['movie', 'tv'] as const;
type Props = { searchParams: Promise<RawParams> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const type = pick((await searchParams).type, TYPES, 'movie');
  return pageMeta({
    title: type === 'tv' ? 'Top rated TV shows' : 'Top rated movies',
    description: `The highest-rated ${type === 'tv' ? 'series' : 'films'} of all time, ranked by TMDB members.`,
    path: buildHref('/top-rated', { type }, { type: 'movie' }),
  });
}

export default async function TopRatedPage({ searchParams }: Props) {
  await connection();
  const sp = await searchParams;
  const type = pick(sp.type, TYPES, 'movie');
  const page = parsePage(sp.page);
  const href = (p: Partial<{ type: string; page: number }>) =>
    buildHref('/top-rated', { type, page, ...p }, { type: 'movie' });

  const result =
    type === 'tv' ? await load('tv/top_rated', getTvList('top_rated', page)) : await load('movie/top_rated', getMovieList('top_rated', page));

  return (
    <BrowseList
      eyebrow="All-time best"
      title={type === 'tv' ? 'Top rated TV shows' : 'Top rated movies'}
      description="Ranked by TMDB member ratings, with a minimum number of votes."
      filters={
        <FilterLinks
          label="Content type"
          value={type}
          options={[
            { value: 'movie', label: 'Movies', href: href({ type: 'movie', page: 1 }) },
            { value: 'tv', label: 'TV shows', href: href({ type: 'tv', page: 1 }) },
          ]}
        />
      }
      result={result}
      mediaType={type}
      page={page}
      hrefForPage={(p) => href({ page: p })}
      retryHref={href({})}
      label={type === 'tv' ? 'Top rated TV shows' : 'Top rated movies'}
    />
  );
}
