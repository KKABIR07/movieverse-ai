'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Film } from 'lucide-react';
import { tmdb } from '@/lib/tmdb';
import { MovieGrid } from '@/components/movie/MovieGrid';

const CATEGORIES = [
  { key: 'popular', label: 'Popular' },
  { key: 'now_playing', label: 'Now Playing' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'top_rated', label: 'Top Rated' },
] as const;

type Category = (typeof CATEGORIES)[number]['key'];

export default function MoviesPage() {
  const [category, setCategory] = useState<Category>('popular');
  const [page, setPage] = useState(1);

  const queryFnMap: Record<Category, (p: number) => ReturnType<typeof tmdb.movie.popular>> = {
    popular: (p) => tmdb.movie.popular(p),
    now_playing: (p) => tmdb.movie.nowPlaying(p),
    upcoming: (p) => tmdb.movie.upcoming(p),
    top_rated: (p) => tmdb.movie.topRated(p),
  };

  const { data, isLoading } = useQuery({
    queryKey: ['movies', category, page],
    queryFn: () => queryFnMap[category](page),
  });

  const handleCategory = (cat: Category) => {
    setCategory(cat);
    setPage(1);
  };

  return (
    <div className="container mx-auto px-4 md:px-8 py-24 min-h-screen">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
          <Film size={22} />
        </div>
        <h1 className="text-3xl font-black text-[var(--text-primary)]">Movies</h1>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        {CATEGORIES.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleCategory(key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${category === key ? 'bg-[var(--accent-primary)] text-white' : 'border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <MovieGrid items={data?.results ?? []} mediaType="movie" loading={isLoading} />

      {data && data.total_pages > 1 && (
        <div className="flex justify-center gap-3 mt-10">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            Previous
          </button>
          <span className="px-4 py-2 text-sm text-[var(--text-muted)]">{page} / {Math.min(data.total_pages, 500)}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page >= data.total_pages || page >= 500} className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            Next
          </button>
        </div>
      )}
    </div>
  );
}
