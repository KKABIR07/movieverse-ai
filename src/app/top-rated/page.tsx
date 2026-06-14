'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { tmdb } from '@/lib/tmdb';
import { MovieGrid } from '@/components/movie/MovieGrid';

export default function TopRatedPage() {
  const [mediaType, setMediaType] = useState<'movie' | 'tv'>('movie');
  const [page, setPage] = useState(1);

  const { data: movieData, isLoading: movieLoading } = useQuery({
    queryKey: ['top_rated', 'movie', page],
    queryFn: () => tmdb.movie.topRated(page),
    enabled: mediaType === 'movie',
  });
  const { data: tvData, isLoading: tvLoading } = useQuery({
    queryKey: ['top_rated', 'tv', page],
    queryFn: () => tmdb.tv.topRated(page),
    enabled: mediaType === 'tv',
  });
  const data = mediaType === 'movie' ? movieData : tvData;
  const isLoading = mediaType === 'movie' ? movieLoading : tvLoading;

  return (
    <div className="container mx-auto px-4 md:px-8 py-24 min-h-screen">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl bg-yellow-500/10 text-yellow-400">
          <Star size={22} />
        </div>
        <h1 className="text-3xl font-black text-[var(--text-primary)]">Top Rated</h1>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        <div className="flex rounded-xl border border-[var(--border)] overflow-hidden">
          {(['movie', 'tv'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setMediaType(t); setPage(1); }}
              className={`px-4 py-2 text-sm font-medium transition-colors ${mediaType === t ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
            >
              {t === 'movie' ? 'Movies' : 'TV Shows'}
            </button>
          ))}
        </div>
      </div>

      <MovieGrid items={data?.results ?? []} mediaType={mediaType} loading={isLoading} />

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
