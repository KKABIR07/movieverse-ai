import type { Metadata } from 'next';
import { connection } from 'next/server';
import { getTvList, type TvList } from '@/lib/tmdb/server';
import { BrowseList } from '@/components/browse/BrowseList';
import { load } from '@/components/browse/BrowseStates';
import { FilterLinks } from '@/components/browse/FilterLinks';
import { pageMeta } from '@/components/browse/meta';
import { buildHref, parsePage, pick, type RawParams } from '@/components/browse/params';

const LISTS = ['popular', 'airing_today', 'on_the_air', 'top_rated'] as const satisfies readonly TvList[];
const LABEL: Record<TvList, string> = {
  popular: 'Popular',
  airing_today: 'Airing today',
  on_the_air: 'On the air',
  top_rated: 'Top rated',
};
const DESCRIPTION: Record<TvList, string> = {
  popular: 'The series people are watching right now.',
  airing_today: 'Shows with a new episode today.',
  on_the_air: 'Shows with a new episode in the next seven days.',
  top_rated: 'The highest-rated series on TMDB.',
};
type Props = { searchParams: Promise<RawParams> };

const titleFor = (list: TvList) => (list === 'popular' || list === 'top_rated' ? `${LABEL[list]} TV shows` : `TV shows ${LABEL[list].toLowerCase()}`);

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const list = pick((await searchParams).list, LISTS, 'popular');
  return pageMeta({
    title: titleFor(list),
    description: DESCRIPTION[list],
    path: buildHref('/tv', { list }, { list: 'popular' }),
  });
}

export default async function TvPage({ searchParams }: Props) {
  await connection();
  const sp = await searchParams;
  const list = pick(sp.list, LISTS, 'popular');
  const page = parsePage(sp.page);
  const href = (p: Partial<{ list: string; page: number }>) =>
    buildHref('/tv', { list, page, ...p }, { list: 'popular' });

  const result = await load(`tv/${list}`, getTvList(list, page));

  return (
    <BrowseList
      eyebrow="TV shows"
      title={titleFor(list)}
      description={DESCRIPTION[list]}
      filters={
        <FilterLinks
          label="TV list"
          value={list}
          options={LISTS.map((l) => ({ value: l, label: LABEL[l], href: href({ list: l, page: 1 }) }))}
        />
      }
      result={result}
      mediaType="tv"
      page={page}
      hrefForPage={(p) => href({ page: p })}
      retryHref={href({})}
      label={titleFor(list)}
    />
  );
}
