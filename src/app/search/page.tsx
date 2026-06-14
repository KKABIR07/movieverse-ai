'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter, X } from 'lucide-react';
import { tmdb } from '@/lib/tmdb';
import { MovieGrid } from '@/components/movie/MovieGrid';
import { GENRES } from '@/types/tmdb';

const SORT_OPTIONS = [
  { value: 'popularity.desc', label: 'Most Popular' },
  { value: 'vote_average.desc', label: 'Highest Rated' },
  { value: 'release_date.desc', label: 'Newest First' },
  { value: 'revenue.desc', label: 'Highest Grossing' },
];

const YEARS = Array.from({ length: 35 }, (_, i) => (2025 - i).toString());

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get('q') ?? '';

  const [query, setQuery] = useState(initialQuery);
  const [inputValue, setInputValue] = useState(initialQuery);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [sortBy, setSortBy] = useState('popularity.desc');
  const [mediaType, setMediaType] = useState<'movie' | 'tv'>('movie');
  const [page, setPage] = useState(1);

  const hasFilters = !!selectedGenre || !!selectedYear;

  const { data: searchMovies, isLoading: searchMovieLoading } = useQuery({
    queryKey: ['search', 'movie', query, page],
    queryFn: () => tmdb.search.movie(query, page),
    enabled: query.length > 0 && mediaType === 'movie',
  });

  const { data: searchTV, isLoading: searchTVLoading } = useQuery({
    queryKey: ['search', 'tv', query, page],
    queryFn: () => tmdb.search.tv(query, page),
    enabled: query.length > 0 && mediaType === 'tv',
  });

  const { data: discoverResults, isLoading: discoverLoading } = useQuery({
    queryKey: ['discover', mediaType, selectedGenre, selectedYear, sortBy, page],
    queryFn: () =>
      tmdb.movie.discover({
        with_genres: selectedGenre,
        primary_release_year: selectedYear,
        sort_by: sortBy,
        page,
      }),
    enabled: query.length === 0,
  });

  const searchResults = mediaType === 'movie' ? searchMovies : searchTV;
  const searchLoading = mediaType === 'movie' ? searchMovieLoading : searchTVLoading;
  const results = query ? searchResults : discoverResults;
  const isLoading = query ? searchLoading : discoverLoading;
  const items = results?.results ?? [];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery(inputValue.trim());
    setPage(1);
    if (inputValue.trim()) {
      router.replace(`/search?q=${encodeURIComponent(inputValue.trim())}`);
    }
  };

  const clearSearch = () => {
    setInputValue('');
    setQuery('');
    router.replace('/search');
  };

  return (
    <div className="container mx-auto px-4 md:px-8 py-24 min-h-screen">
      <h1 className="text-3xl font-black text-[var(--text-primary)] mb-6">Search</h1>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="relative mb-6">
        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Search movies, TV shows, people..."
          className="w-full bg-[var(--bg-card)] border border-[var(--border)] focus:border-[var(--accent-primary)] rounded-2xl pl-12 pr-32 py-4 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none transition-colors text-base"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {inputValue && (
            <button type="button" onClick={clearSearch} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              <X size={16} />
            </button>
          )}
          <button type="submit" className="px-4 py-1.5 bg-[var(--accent-primary)] text-white text-sm font-medium rounded-xl hover:bg-[var(--accent-secondary)] transition-colors">
            Search
          </button>
        </div>
      </form>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6 items-center">
        <div className="flex rounded-xl border border-[var(--border)] overflow-hidden">
          <button
            onClick={() => setMediaType('movie')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${mediaType === 'movie' ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
          >
            Movies
          </button>
          <button
            onClick={() => setMediaType('tv')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${mediaType === 'tv' ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
          >
            TV Shows
          </button>
        </div>

        <button
          onClick={() => setFilterOpen(!filterOpen)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${filterOpen || hasFilters ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]' : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
        >
          <Filter size={14} />
          Filters {hasFilters && '•'}
        </button>

        <select
          value={sortBy}
          onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-sm text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-primary)]"
        >
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Filter panel */}
      {filterOpen && (
        <div className="glass rounded-2xl p-5 mb-6 grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-2 font-medium">Genre</label>
            <select
              value={selectedGenre}
              onChange={(e) => { setSelectedGenre(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
            >
              <option value="">All Genres</option>
              {GENRES.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-2 font-medium">Year</label>
            <select
              value={selectedYear}
              onChange={(e) => { setSelectedYear(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
            >
              <option value="">All Years</option>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => { setSelectedGenre(''); setSelectedYear(''); setSortBy('popularity.desc'); setPage(1); }}
              className="w-full px-3 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Results count */}
      {results && (
        <p className="text-sm text-[var(--text-muted)] mb-4">
          {(results as { total_results: number }).total_results.toLocaleString()} results
          {query ? ` for "${query}"` : ''}
        </p>
      )}

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <MovieGrid items={items as any[]} mediaType={mediaType} loading={isLoading ?? false} />

      {/* Pagination */}
      {results && (results as { total_pages: number }).total_pages > 1 && (
        <div className="flex justify-center gap-3 mt-10">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-sm text-[var(--text-muted)]">
            {page} / {Math.min((results as { total_pages: number }).total_pages, 500)}
          </span>
          <button
            onClick={() => setPage((p) => Math.min((results as { total_pages: number }).total_pages, p + 1))}
            disabled={page >= (results as { total_pages: number }).total_pages || page >= 500}
            className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchContent />
    </Suspense>
  );
}
