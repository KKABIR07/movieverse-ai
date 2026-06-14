'use client';

import { useRouter } from 'next/navigation';
import { X, SlidersHorizontal, ChevronRight } from 'lucide-react';
import { useFilterStore, REGIONS, CONTENT_RATINGS } from '@/store/filterStore';
import { GENRES } from '@/types/tmdb';

const SORT_OPTIONS = [
  { value: 'popularity.desc',   label: 'Most Popular' },
  { value: 'vote_average.desc', label: 'Highest Rated' },
  { value: 'release_date.desc', label: 'Newest First' },
  { value: 'revenue.desc',      label: 'Box Office' },
];

export function Sidebar() {
  const router = useRouter();
  const {
    sidebarOpen, setSidebarOpen,
    activeRegion, setRegion,
    activeGenres, toggleGenre, clearGenres,
    activeContentType, setContentType,
    minRating, setMinRating,
    sortBy, setSortBy,
    clearAll, getDiscoverParams,
  } = useFilterStore();

  const applyFilters = () => {
    const params = getDiscoverParams();
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    router.push(`/discover${qs ? `?${qs}` : ''}`);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const hasActiveFilters = activeRegion !== 'all' || activeGenres.length > 0 || minRating !== '' || activeContentType !== 'both';

  return (
    <>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`fixed top-16 left-0 h-[calc(100vh-4rem)] z-40 flex flex-col bg-[var(--bg-secondary)] border-r border-[var(--border)] transition-all duration-300 overflow-y-auto
          ${sidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full md:w-14 md:translate-x-0'}`}
        style={{ scrollbarWidth: 'thin' }}
      >
        {/* Collapsed icon strip (desktop only) */}
        {!sidebarOpen && (
          <div className="hidden md:flex flex-col items-center py-4 gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
              aria-label="Open sidebar"
            >
              <SlidersHorizontal size={18} />
            </button>
            <div className="h-px w-8 bg-[var(--border)]" />
            {REGIONS.slice(1, 6).map((r) => (
              <button
                key={r.key}
                onClick={() => { setRegion(r.key); setSidebarOpen(true); }}
                title={r.label}
                className={`text-xl p-1 rounded-lg transition-colors ${activeRegion === r.key ? 'bg-[var(--accent-primary)]/20' : 'hover:bg-[var(--bg-hover)]'}`}
              >
                {r.emoji}
              </button>
            ))}
            <ChevronRight size={14} className="text-[var(--text-muted)] mt-2" />
          </div>
        )}

        {/* Expanded content */}
        {sidebarOpen && (
          <div className="flex flex-col flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-[var(--border)] flex-shrink-0">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={16} className="text-[var(--accent-primary)]" />
                <span className="text-sm font-bold text-[var(--text-primary)]">Filters</span>
                {hasActiveFilters && (
                  <span className="w-2 h-2 rounded-full bg-[var(--accent-primary)]" />
                )}
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5" style={{ scrollbarWidth: 'none' }}>
              {/* Content type */}
              <section>
                <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2.5 px-1">Type</h3>
                <div className="flex rounded-xl border border-[var(--border)] overflow-hidden">
                  {(['both', 'movie', 'tv'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setContentType(t)}
                      className={`flex-1 py-1.5 text-xs font-medium capitalize transition-colors ${activeContentType === t ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
                    >
                      {t === 'both' ? 'All' : t === 'movie' ? 'Movies' : 'TV'}
                    </button>
                  ))}
                </div>
              </section>

              {/* Regions */}
              <section>
                <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2.5 px-1">Region / Cinema</h3>
                <div className="space-y-0.5">
                  {REGIONS.map((r) => (
                    <button
                      key={r.key}
                      onClick={() => setRegion(r.key)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors ${
                        activeRegion === r.key
                          ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] font-medium'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <span className="text-base w-6 text-center flex-shrink-0">{r.emoji}</span>
                      <span className="truncate">{r.label}</span>
                      {activeRegion === r.key && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)] flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </section>

              {/* Genres */}
              <section>
                <div className="flex items-center justify-between px-1 mb-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Genres</h3>
                  {activeGenres.length > 0 && (
                    <button onClick={clearGenres} className="text-xs text-[var(--accent-primary)] hover:underline">
                      Clear ({activeGenres.length})
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {GENRES.filter((g) => g.id !== 10770).map((g) => (
                    <button
                      key={g.id}
                      onClick={() => toggleGenre(g.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                        activeGenres.includes(g.id)
                          ? 'bg-[var(--accent-primary)] text-white'
                          : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border)]'
                      }`}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
              </section>

              {/* Min rating */}
              <section>
                <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2.5 px-1">Min Rating</h3>
                <div className="flex flex-wrap gap-1.5">
                  {CONTENT_RATINGS.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => setMinRating(r.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        minRating === r.value
                          ? 'bg-yellow-500 text-black'
                          : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border)]'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </section>

              {/* Sort */}
              <section>
                <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2.5 px-1">Sort By</h3>
                <div className="space-y-0.5">
                  {SORT_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      onClick={() => setSortBy(o.value)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors ${
                        sortBy === o.value
                          ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] font-medium'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </section>
            </div>

            {/* Action buttons */}
            <div className="flex-shrink-0 px-3 py-4 border-t border-[var(--border)] space-y-2">
              <button
                onClick={applyFilters}
                className="w-full py-2.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-white text-sm font-bold rounded-xl transition-colors"
              >
                Apply Filters
              </button>
              {hasActiveFilters && (
                <button
                  onClick={clearAll}
                  className="w-full py-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
