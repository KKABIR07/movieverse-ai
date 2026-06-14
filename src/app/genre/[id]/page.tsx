'use client';

import { use, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { tmdb } from '@/lib/tmdb';
import { MovieGrid } from '@/components/movie/MovieGrid';

function GenreContent({ genreId }: { genreId: number }) {
  const searchParams = useSearchParams();
  const genreName = searchParams.get('name') ?? 'Genre';
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('popularity.desc');

  const { data, isLoading } = useQuery({
    queryKey: ['genre', genreId, sortBy, page],
    queryFn: () => tmdb.movie.discover({ with_genres: genreId.toString(), sort_by: sortBy, page }),
  });

  return (
    <div className="container mx-auto px-4 md:px-8 py-24 min-h-screen">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <h1 className="text-3xl font-black text-[var(--text-primary)]">{genreName}</h1>
        <select
          value={sortBy}
          onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-sm text-[var(--text-secondary)] focus:outline-none"
        >
          <option value="popularity.desc">Most Popular</option>
          <option value="vote_average.desc">Highest Rated</option>
          <option value="release_date.desc">Newest First</option>
        </select>
      </div>

      {data && (
        <p className="text-sm text-[var(--text-muted)] mb-4">{data.total_results.toLocaleString()} movies</p>
      )}

      <MovieGrid items={data?.results ?? []} mediaType="movie" loading={isLoading} />

      {data && data.total_pages > 1 && (
        <div className="flex justify-center gap-3 mt-10">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-30 transition-colors">
            Previous
          </button>
          <span className="px-4 py-2 text-sm text-[var(--text-muted)]">{page} / {Math.min(data.total_pages, 500)}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page >= data.total_pages || page >= 500} className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-30 transition-colors">
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default function GenrePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense>
      <GenreContent genreId={parseInt(id, 10)} />
    </Suspense>
  );
}
