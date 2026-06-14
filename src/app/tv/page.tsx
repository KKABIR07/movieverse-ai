'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tv } from 'lucide-react';
import { tmdb } from '@/lib/tmdb';
import { MovieGrid } from '@/components/movie/MovieGrid';

const CATEGORIES = [
  { key: 'popular', label: 'Popular' },
  { key: 'top_rated', label: 'Top Rated' },
  { key: 'trending', label: 'Trending' },
] as const;

type Category = (typeof CATEGORIES)[number]['key'];

export default function TVPage() {
  const [category, setCategory] = useState<Category>('popular');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['tv', category, page],
    queryFn: () => {
      if (category === 'popular') return tmdb.tv.popular(page);
      if (category === 'top_rated') return tmdb.tv.topRated(page);
      return tmdb.tv.trending('week');
    },
  });

  return (
    <div className="container mx-auto px-4 md:px-8 py-24 min-h-screen">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl bg-[var(--accent-cyan)]/10" style={{ color: 'var(--accent-cyan)' }}>
          <Tv size={22} />
        </div>
        <h1 className="text-3xl font-black text-[var(--text-primary)]">TV Shows</h1>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        {CATEGORIES.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setCategory(key); setPage(1); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${category === key ? 'bg-[var(--accent-primary)] text-white' : 'border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <MovieGrid items={data?.results ?? []} mediaType="tv" loading={isLoading} />

      {data && data.total_pages > 1 && category !== 'trending' && (
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
