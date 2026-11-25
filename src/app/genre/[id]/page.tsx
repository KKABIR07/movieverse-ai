import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { cache } from 'react';
import { discover, getGenres, type MediaKind } from '@/lib/tmdb/server';
import type { Genre } from '@/types/tmdb';
import { BrowseList } from '@/components/browse/BrowseList';
import { load } from '@/components/browse/BrowseStates';
import { FilterLinks } from '@/components/browse/FilterLinks';
import { genreSwatch } from '@/components/browse/GenreTiles';
import { pageMeta } from '@/components/browse/meta';
import { buildHref, parsePage, pick, type RawParams } from '@/components/browse/params';
import { cn } from '@/components/ui/cn';

const SORTS = ['popular', 'rating', 'newest'] as const;
const SORT_TMDB = { popular: 'popularity.desc', rating: 'vote_average.desc', newest: 'primary_release_date.desc' } as const;
const SORT_LABEL = { popular: 'Popular', rating: 'Top rated', newest: 'Newest' } as const;

type Props = { params: Promise<{ id: string }>; searchParams: Promise<RawParams> };

/**
 * Resolve a genre id against TMDB's movie + TV genre lists (cached 7 days, deduped per request).
 * Returns which media kinds the genre exists for. Throws only if TMDB itself fails.
 */
const resolveGenre = cache(async (rawId: string): Promise<{ genre: Genre; kinds: MediaKind[] } | null> => {
  if (!/^\d{1,9}$/.test(rawId)) return null;
  const id = Number(rawId);
  const [movie, tv] = await Promise.all([getGenres('movie'), getGenres('tv')]);
  const inMovie = movie.find((g) => g.id === id);
  const inTv = tv.find((g) => g.id === id);
  const genre = inMovie ?? inTv;
  if (!genre) return null;
  return { genre, kinds: [...(inMovie ? (['movie'] as const) : []), ...(inTv ? (['tv'] as const) : [])] };
});

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const resolved = await resolveGenre(id).catch(() => null);
  if (!resolved) return { title: 'Genre not found', robots: { index: false } };
  const type = pick(sp.type, resolved.kinds, resolved.kinds[0]);
  const noun = type === 'tv' ? 'TV shows' : 'movies';
  return pageMeta({
    title: `${resolved.genre.name} ${noun}`,
    description: `The most popular ${resolved.genre.name.toLowerCase()} ${noun} right now, with TMDB ratings.`,
    path: buildHref(`/genre/${resolved.genre.id}`, { type }, { type: resolved.kinds[0] }),
  });
}

export default async function GenrePage({ params, searchParams }: Props) {
  await connection();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  // `?name=` from old links is ignored: the name always comes from TMDB.
  const resolved = await resolveGenre(id);
  if (!resolved) notFound();
  const { genre, kinds } = resolved;

  const type = pick(sp.type, kinds, kinds[0]);
  const sort = pick(sp.sort, SORTS, 'popular');
  const page = parsePage(sp.page);
  const base = `/genre/${genre.id}`;
  const href = (p: Partial<{ type: string; sort: string; page: number }>) =>
    buildHref(base, { type, sort, page, ...p }, { type: kinds[0], sort: 'popular' });

  const result = await load(
    `discover/${type}?genre=${genre.id}`,
    discover(type, { genres: [genre.id], sortBy: SORT_TMDB[sort], page }),
  );
  const noun = type === 'tv' ? 'TV shows' : 'movies';

  return (
    <BrowseList
      eyebrow={
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className={cn('inline-block h-1 w-6 rounded-full', genreSwatch(genre.id))} />
          Genre
        </span>
      }
      title={`${genre.name} ${noun}`}
      description={`Browse ${genre.name.toLowerCase()} ${noun}, sorted by ${SORT_LABEL[sort].toLowerCase()}.`}
      filters={
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
          {kinds.length > 1 && (
            <FilterLinks
              label="Content type"
              value={type}
              options={kinds.map((k) => ({ value: k, label: k === 'tv' ? 'TV shows' : 'Movies', href: href({ type: k, page: 1 }) }))}
            />
          )}
          <FilterLinks
            label="Sort by"
            value={sort}
            options={SORTS.map((s) => ({ value: s, label: SORT_LABEL[s], href: href({ sort: s, page: 1 }) }))}
          />
        </div>
      }
      result={result}
      mediaType={type}
      page={page}
      hrefForPage={(p) => href({ page: p })}
      retryHref={href({})}
      label={`${genre.name} ${noun}`}
    />
  );
}
