'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Compass } from 'lucide-react';
import { tmdb } from '@/lib/tmdb';
import { MovieGrid } from '@/components/movie/MovieGrid';
import { useFilterStore, REGIONS } from '@/store/filterStore';
import { GENRES } from '@/types/tmdb';

function DiscoverContent() {
  const searchParams = useSearchParams();
  const { activeRegion, activeGenres, minRating, sortBy } = useFilterStore();
  const [page, setPage] = useState(1);

  // Build params from URL (applied via sidebar) or from store
  const params: Record<string, string> = { sort_by: sortBy, page: String(page) };

  const urlLang = searchParams.get('with_original_language');
  const urlGenres = searchParams.get('with_genres');
  const urlRating = searchParams.get('vote_average.gte');
  const urlSort = searchParams.get('sort_by');

  if (urlLang) params['with_original_language'] = urlLang;
  else {
    const region = REGIONS.find((r) => r.key === activeRegion);
    if (region?.language) params['with_original_language'] = region.language;
  }
  if (urlGenres) params['with_genres'] = urlGenres;
  else if (activeGenres.length) params['with_genres'] = activeGenres.join(',');
  if (urlRating) params['vote_average.gte'] = urlRating;
  else if (minRating) params['vote_average.gte'] = minRating;
  if (urlSort) params['sort_by'] = urlSort;

  const { data, isLoading } = useQuery({
    queryKey: ['discover', params],
    queryFn: () => tmdb.movie.discover(params),
  });

  // Resolve display labels
  const currentRegion = REGIONS.find(
    (r) => r.language === (urlLang ?? params['with_original_language'])
  );
  const genreIds = (urlGenres ?? params['with_genres'] ?? '')
    .split(',')
    .map(Number)
    .filter(Boolean);
  const genreLabels = GENRES.filter((g) => genreIds.includes(g.id)).map((g) => g.name);

  const title = [
    currentRegion && currentRegion.key !== 'all' ? `${currentRegion.emoji} ${currentRegion.label}` : null,
    genreLabels.length ? genreLabels.join(' · ') : null,
  ].filter(Boolean).join(' — ') || 'Discover';

  return (
    <div className="container mx-auto px-4 md:px-8 py-24 min-h-screen">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
          <Compass size={22} />
        </div>
        <div>
          <h1 className="text-3xl font-black text-[var(--text-primary)]">{title}</h1>
          {data && <p className="text-sm text-[var(--text-muted)] mt-0.5">{data.total_results.toLocaleString()} movies found</p>}
        </div>
      </div>

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

export default function DiscoverPage() {
  return (
    <Suspense>
      <DiscoverContent />
    </Suspense>
  );
}
