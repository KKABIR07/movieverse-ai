import type { Metadata } from 'next';
import { connection } from 'next/server';
import {
  getGenres,
  getMovieList,
  getTrending,
  getTrendingPeople,
  getTvList,
} from '@/lib/tmdb/server';
import type { Genre } from '@/types/tmdb';
import { MediaCard, PersonCard, POSTER_SIZES, Rail, Top10Rail } from '@/components/media';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { formatYear } from '@/lib/format';
import { HeroCarousel, type HeroSlide } from '@/components/home/HeroCarousel';
import { FilterLinks } from '@/components/browse/FilterLinks';
import { GenreTiles } from '@/components/browse/GenreTiles';
import { load } from '@/components/browse/BrowseStates';
import { pick, type RawParams } from '@/components/browse/params';
import { toPeople, toSummaries } from '@/components/browse/trim';
import type { MediaSummary } from '@/components/media/types';

export const metadata: Metadata = {
  title: { absolute: 'mkmovies: discover movies & TV shows' },
  description:
    'What is trending this week, the top 10 movies today, new releases and the best-rated films and series. Ratings from TMDB.',
  alternates: { canonical: '/' },
};

const PERIODS = ['day', 'week'] as const;
type Period = (typeof PERIODS)[number];

function PosterRail({ title, href, items }: { title: string; href?: string; items: MediaSummary[] }) {
  if (!items.length) return null;
  return (
    <Rail title={title} href={href}>
      {items.map((m) => (
        <MediaCard key={`${m.mediaType}:${m.id}`} item={m} sizes={POSTER_SIZES.rail} />
      ))}
    </Rail>
  );
}

export default async function HomePage({ searchParams }: { searchParams: Promise<RawParams> }) {
  await connection(); // request-time render: the build never calls TMDB
  const sp = await searchParams;
  const period: Period = pick(sp.trending, PERIODS, 'week');

  const [heroRes, trendingRes, top10Res, popularRes, popularTvRes, nowRes, upcomingRes, topRatedRes, peopleRes, movieGenresRes, tvGenresRes] =
    await Promise.all([
      load('trending/all/week', getTrending('all', 'week')),
      period === 'week' ? null : load('trending/all/day', getTrending('all', 'day')),
      load('trending/movie/day', getTrending('movie', 'day')),
      load('movie/popular', getMovieList('popular')),
      load('tv/popular', getTvList('popular')),
      load('movie/now_playing', getMovieList('now_playing')),
      load('movie/upcoming', getMovieList('upcoming')),
      load('movie/top_rated', getMovieList('top_rated')),
      load('trending/person/week', getTrendingPeople('week')),
      load('genre/movie', getGenres('movie')),
      load('genre/tv', getGenres('tv')),
    ]);

  const weekly = heroRes.ok ? toSummaries(heroRes.data.results) : [];
  const trending = period === 'week' ? weekly : trendingRes?.ok ? toSummaries(trendingRes.data.results) : [];

  const genreNames = new Map<number, string>();
  for (const g of [...(movieGenresRes.ok ? movieGenresRes.data : []), ...(tvGenresRes.ok ? tvGenresRes.data : [])]) {
    if (!genreNames.has(g.id)) genreNames.set(g.id, g.name);
  }

  // Hero keeps the overview (cards drop it), so map from the raw results.
  const heroSlides: HeroSlide[] = heroRes.ok
    ? heroRes.data.results
        .filter((r) => r.media_type !== 'person' && (r as { backdrop_path?: string | null }).backdrop_path)
        .slice(0, 5)
        .map((r) => {
          const [base] = toSummaries([r]);
          const raw = r as { overview?: string; genre_ids?: number[] };
          return {
            ...base,
            overview: raw.overview ?? '',
            year: formatYear(base.date, ''),
            genreNames: (raw.genre_ids ?? []).map((id) => genreNames.get(id)).filter((n): n is string => !!n),
          };
        })
    : [];

  const movieGenres: Genre[] = movieGenresRes.ok ? movieGenresRes.data : [];
  const people = peopleRes.ok ? toPeople(peopleRes.data.results).filter((p) => p.profile_path).slice(0, 20) : [];

  return (
    <div className="pb-16">
      <h1 className="sr-only">mkmovies: trending movies and TV shows</h1>

      {heroSlides.length > 0 ? (
        <HeroCarousel slides={heroSlides} />
      ) : (
        <div className="px-gutter pt-10">
          <SectionHeader as="h2" title="Trending this week" description="Live data from TMDB is unavailable right now. Try again shortly." />
        </div>
      )}

      <div className="mt-10 flex flex-col gap-12 md:mt-14 md:gap-14">
        {trending.length > 0 && (
          <div id="trending" className="scroll-mt-24">
            <Rail
              title="Trending"
              href={`/trending?window=${period}`}
              actions={
                <FilterLinks
                  label="Trending period"
                  value={period}
                  size="sm"
                  scrollable={false}
                  keepScroll
                  options={[
                    { value: 'day', label: 'Today', href: '/?trending=day' },
                    {
                      value: 'week',
                      label: (
                        <>
                          <span className="sm:hidden">Week</span>
                          <span className="max-sm:hidden">This week</span>
                        </>
                      ),
                      href: '/',
                    },
                  ]}
                />
              }
            >
              {trending.map((m) => (
                <MediaCard key={`${m.mediaType}:${m.id}`} item={m} sizes={POSTER_SIZES.rail} />
              ))}
            </Rail>
          </div>
        )}

        {top10Res.ok && top10Res.data.results.length > 0 && (
          <Top10Rail title="Top 10 movies today" href="/trending?type=movie&window=day" items={toSummaries(top10Res.data.results, 'movie')} mediaType="movie" />
        )}

        <PosterRail title="Popular movies" href="/movies" items={popularRes.ok ? toSummaries(popularRes.data.results, 'movie') : []} />
        <PosterRail title="Popular TV" href="/tv" items={popularTvRes.ok ? toSummaries(popularTvRes.data.results, 'tv') : []} />
        <PosterRail title="Now playing" href="/movies?list=now_playing" items={nowRes.ok ? toSummaries(nowRes.data.results, 'movie') : []} />
        <PosterRail title="Coming soon" href="/movies?list=upcoming" items={upcomingRes.ok ? toSummaries(upcomingRes.data.results, 'movie') : []} />
        <PosterRail title="Top rated movies" href="/top-rated" items={topRatedRes.ok ? toSummaries(topRatedRes.data.results, 'movie') : []} />

        {people.length > 0 && (
          <Rail title="Trending people" href="/stars?list=trending" variant="person">
            {people.map((p) => (
              <PersonCard key={p.id} person={p} />
            ))}
          </Rail>
        )}

        {movieGenres.length > 0 && (
          <section aria-labelledby="genres-heading" className="px-gutter">
            <SectionHeader id="genres-heading" title="Browse by genre" href="/discover" seeAllLabel="Discover" />
            <GenreTiles genres={movieGenres} />
          </section>
        )}
      </div>
    </div>
  );
}
