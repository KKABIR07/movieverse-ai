import type { Metadata } from 'next';
import { connection } from 'next/server';
import { getMovieList, type MovieList } from '@/lib/tmdb/server';
import { BrowseList } from '@/components/browse/BrowseList';
import { load } from '@/components/browse/BrowseStates';
import { FilterLinks } from '@/components/browse/FilterLinks';
import { pageMeta } from '@/components/browse/meta';
import { buildHref, parsePage, pick, type RawParams } from '@/components/browse/params';

const LISTS = ['popular', 'now_playing', 'upcoming', 'top_rated'] as const satisfies readonly MovieList[];
const LABEL: Record<MovieList, string> = {
  popular: 'Popular',
  now_playing: 'Now playing',
  upcoming: 'Coming soon',
  top_rated: 'Top rated',
};
const DESCRIPTION: Record<MovieList, string> = {
  popular: 'The films people are watching and talking about right now.',
  now_playing: 'In cinemas now.',
  upcoming: 'Releasing in cinemas soon.',
  top_rated: 'The highest-rated films on TMDB.',
};
type Props = { searchParams: Promise<RawParams> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const list = pick((await searchParams).list, LISTS, 'popular');
  return pageMeta({
    title: `${LABEL[list]} movies`,
    description: DESCRIPTION[list],
    path: buildHref('/movies', { list }, { list: 'popular' }),
  });
}

export default async function MoviesPage({ searchParams }: Props) {
  await connection();
  const sp = await searchParams;
  const list = pick(sp.list, LISTS, 'popular');
  const page = parsePage(sp.page);
  const href = (p: Partial<{ list: string; page: number }>) =>
    buildHref('/movies', { list, page, ...p }, { list: 'popular' });

  const result = await load(`movie/${list}`, getMovieList(list, page));

  return (
    <BrowseList
      eyebrow="Movies"
      title={`${LABEL[list]} movies`}
      description={DESCRIPTION[list]}
      filters={
        <FilterLinks
          label="Movie list"
          value={list}
          options={LISTS.map((l) => ({ value: l, label: LABEL[l], href: href({ list: l, page: 1 }) }))}
        />
      }
      result={result}
      mediaType="movie"
      page={page}
      hrefForPage={(p) => href({ page: p })}
      retryHref={href({})}
      label={`${LABEL[list]} movies`}
    />
  );
}
