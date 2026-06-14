'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp } from 'lucide-react';
import { tmdb } from '@/lib/tmdb';
import { MovieGrid } from '@/components/movie/MovieGrid';

export default function TrendingPage() {
  const [timeWindow, setTimeWindow] = useState<'day' | 'week'>('week');
  const [mediaType, setMediaType] = useState<'movie' | 'tv'>('movie');

  const { data: movieData, isLoading: movieLoading } = useQuery({
    queryKey: ['trending', 'movie', timeWindow],
    queryFn: () => tmdb.movie.trending(timeWindow),
    enabled: mediaType === 'movie',
  });
  const { data: tvData, isLoading: tvLoading } = useQuery({
    queryKey: ['trending', 'tv', timeWindow],
    queryFn: () => tmdb.tv.trending(timeWindow),
    enabled: mediaType === 'tv',
  });
  const data = mediaType === 'movie' ? movieData : tvData;
  const isLoading = mediaType === 'movie' ? movieLoading : tvLoading;

  return (
    <div className="container mx-auto px-4 md:px-8 py-24 min-h-screen">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
          <TrendingUp size={22} />
        </div>
        <h1 className="text-3xl font-black text-[var(--text-primary)]">Trending</h1>
      </div>

      {/* Toggles */}
      <div className="flex flex-wrap gap-3 mb-8">
        <div className="flex rounded-xl border border-[var(--border)] overflow-hidden">
          {(['movie', 'tv'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setMediaType(t)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${mediaType === t ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
            >
              {t === 'movie' ? 'Movies' : 'TV Shows'}
            </button>
          ))}
        </div>
        <div className="flex rounded-xl border border-[var(--border)] overflow-hidden">
          {(['day', 'week'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTimeWindow(t)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${timeWindow === t ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
            >
              {t === 'day' ? 'Today' : 'This Week'}
            </button>
          ))}
        </div>
      </div>

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <MovieGrid items={(data?.results ?? []) as any[]} mediaType={mediaType} loading={isLoading ?? false} skeletonCount={20} />
    </div>
  );
}
