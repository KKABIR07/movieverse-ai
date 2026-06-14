'use client';

import { useQuery } from '@tanstack/react-query';
import { tmdb, TMDB_KEY_MISSING } from '@/lib/tmdb';
import { HeroBanner } from '@/components/movie/HeroBanner';
import { HorizontalScroll } from '@/components/movie/HorizontalScroll';
import { TrendingShowcase } from '@/components/movie/TrendingShowcase';
import { GenreSection } from '@/components/movie/GenreSection';
import { PeopleShowcase } from '@/components/people/PeopleShowcase';
import { FollowingShelf } from '@/components/people/FollowingShelf';
import { Skeleton } from '@/components/ui/Skeleton';
import { KeyRound } from 'lucide-react';

export default function HomePage() {
  const { data: trending, isLoading: loadingTrending } = useQuery({
    queryKey: ['trending', 'movie', 'week'],
    queryFn: () => tmdb.movie.trending('week'),
    enabled: !TMDB_KEY_MISSING,
    retry: false,
  });

  const { data: popular } = useQuery({
    queryKey: ['movies', 'popular'],
    queryFn: () => tmdb.movie.popular(),
    enabled: !TMDB_KEY_MISSING,
    retry: false,
  });

  const { data: topRated } = useQuery({
    queryKey: ['movies', 'top_rated'],
    queryFn: () => tmdb.movie.topRated(),
    enabled: !TMDB_KEY_MISSING,
    retry: false,
  });

  const { data: nowPlaying } = useQuery({
    queryKey: ['movies', 'now_playing'],
    queryFn: () => tmdb.movie.nowPlaying(),
    enabled: !TMDB_KEY_MISSING,
    retry: false,
  });

  const { data: trendingTV } = useQuery({
    queryKey: ['trending', 'tv', 'week'],
    queryFn: () => tmdb.tv.trending('week'),
    enabled: !TMDB_KEY_MISSING,
    retry: false,
  });

  const { data: upcoming } = useQuery({
    queryKey: ['movies', 'upcoming'],
    queryFn: () => tmdb.movie.upcoming(),
    enabled: !TMDB_KEY_MISSING,
    retry: false,
  });

  const { data: trendingPeople1 } = useQuery({
    queryKey: ['trending', 'people', 'week', 1],
    queryFn: () => tmdb.person.trending('week', 1),
    enabled: !TMDB_KEY_MISSING,
    retry: false,
  });

  const { data: trendingPeople2 } = useQuery({
    queryKey: ['trending', 'people', 'week', 2],
    queryFn: () => tmdb.person.trending('week', 2),
    enabled: !TMDB_KEY_MISSING && !!(trendingPeople1),
    retry: false,
  });

  const { data: trendingPeople3 } = useQuery({
    queryKey: ['trending', 'people', 'week', 3],
    queryFn: () => tmdb.person.trending('week', 3),
    enabled: !TMDB_KEY_MISSING && !!(trendingPeople2),
    retry: false,
  });

  const trendingPeople50 = [
    ...(trendingPeople1?.results ?? []),
    ...(trendingPeople2?.results ?? []),
    ...(trendingPeople3?.results ?? []),
  ].slice(0, 50);

  const heroMovies = trending?.results?.slice(0, 8) ?? [];

  if (TMDB_KEY_MISSING) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto">
            <KeyRound size={32} className="text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Add your TMDB API key</h1>
          <p className="text-[var(--text-secondary)] leading-relaxed">
            MovieVerse needs a free TMDB API key to fetch movie data. It takes about 2 minutes to set up.
          </p>
          <div className="glass rounded-xl p-4 text-left space-y-3">
            <p className="text-sm font-medium text-[var(--text-primary)]">Quick setup:</p>
            <ol className="space-y-2 text-sm text-[var(--text-secondary)]">
              <li>1. Go to <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener noreferrer" className="text-[var(--accent-primary)] hover:underline">themoviedb.org/settings/api</a> and create a free account</li>
              <li>2. Request an API key (choose "Developer")</li>
              <li>
                3. Open <code className="bg-[var(--bg-hover)] px-1.5 py-0.5 rounded text-xs">movieverse/.env.local</code> and set:
                <pre className="mt-1.5 bg-[var(--bg-secondary)] rounded-lg p-3 text-xs text-amber-300 overflow-auto">
{`NEXT_PUBLIC_TMDB_API_KEY=your_actual_key`}
                </pre>
              </li>
              <li>4. Save the file and restart the dev server</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {loadingTrending ? (
        <div className="h-[100svh] min-h-[600px]">
          <Skeleton className="h-full w-full" rounded="rounded-none" />
        </div>
      ) : heroMovies.length > 0 ? (
        <HeroBanner movies={heroMovies} />
      ) : null}

      <div className="-mt-20 relative z-10">
        <TrendingShowcase
          items={trending?.results ?? []}
          loading={loadingTrending}
        />

        {/* Trending Stars spotlight — up to 50 */}
        {trendingPeople50.length > 0 && (
          <PeopleShowcase people={trendingPeople50} />
        )}

        {/* Followed people shelf (only shown when logged in + has follows) */}
        <FollowingShelf />

        <HorizontalScroll
          title="🎬 Now Playing"
          items={nowPlaying?.results ?? []}
          viewAllHref="/movies"
        />
        <GenreSection />
        <HorizontalScroll
          title="⭐ Top Rated Movies"
          items={topRated?.results ?? []}
          viewAllHref="/top-rated"
        />
        <HorizontalScroll
          title="📺 Trending TV Shows"
          items={trendingTV?.results ?? []}
          mediaType="tv"
          viewAllHref="/tv"
        />
        <HorizontalScroll
          title="🎟️ Upcoming Releases"
          items={upcoming?.results ?? []}
          viewAllHref="/movies"
        />
        <HorizontalScroll
          title="🌟 Popular Right Now"
          items={popular?.results ?? []}
          viewAllHref="/movies"
        />
      </div>
    </div>
  );
}
