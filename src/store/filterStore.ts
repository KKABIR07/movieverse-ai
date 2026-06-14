'use client';

import { create } from 'zustand';

export interface Region {
  key: string;
  label: string;
  emoji: string;
  language: string;
  genre?: number; // optional genre override (e.g. anime = animation genre)
  region?: string; // TMDB region code
}

export const REGIONS: Region[] = [
  { key: 'all',       label: 'All',         emoji: '🌍', language: '' },
  { key: 'hollywood', label: 'Hollywood',   emoji: '🎬', language: 'en', region: 'US' },
  { key: 'bollywood', label: 'Bollywood',   emoji: '🇮🇳', language: 'hi' },
  { key: 'anime',     label: 'Anime',       emoji: '🎌', language: 'ja', genre: 16 },
  { key: 'korean',    label: 'Korean',      emoji: '🇰🇷', language: 'ko' },
  { key: 'chinese',   label: 'Chinese',     emoji: '🇨🇳', language: 'zh' },
  { key: 'spanish',   label: 'Spanish',     emoji: '🇪🇸', language: 'es' },
  { key: 'french',    label: 'French',      emoji: '🇫🇷', language: 'fr' },
  { key: 'turkish',   label: 'Turkish',     emoji: '🇹🇷', language: 'tr' },
  { key: 'thai',      label: 'Thai',        emoji: '🇹🇭', language: 'th' },
  { key: 'german',    label: 'German',      emoji: '🇩🇪', language: 'de' },
  { key: 'italian',   label: 'Italian',     emoji: '🇮🇹', language: 'it' },
  { key: 'arabic',    label: 'Arabic',      emoji: '🇸🇦', language: 'ar' },
  { key: 'portuguese',label: 'Portuguese',  emoji: '🇧🇷', language: 'pt' },
  { key: 'russian',   label: 'Russian',     emoji: '🇷🇺', language: 'ru' },
];

export const CONTENT_RATINGS = [
  { label: 'Any',    value: '' },
  { label: '6.0+',   value: '6' },
  { label: '7.0+',   value: '7' },
  { label: '7.5+',   value: '7.5' },
  { label: '8.0+',   value: '8' },
];

interface FilterStore {
  sidebarOpen: boolean;
  activeRegion: string;
  activeGenres: number[];
  activeContentType: 'movie' | 'tv' | 'both';
  minRating: string;
  sortBy: string;
  yearFrom: string;
  yearTo: string;

  setSidebarOpen: (v: boolean) => void;
  toggleSidebar: () => void;
  setRegion: (key: string) => void;
  toggleGenre: (id: number) => void;
  clearGenres: () => void;
  setContentType: (t: 'movie' | 'tv' | 'both') => void;
  setMinRating: (v: string) => void;
  setSortBy: (v: string) => void;
  setYearFrom: (v: string) => void;
  setYearTo: (v: string) => void;
  clearAll: () => void;

  getDiscoverParams: () => Record<string, string>;
}

export const useFilterStore = create<FilterStore>()((set, get) => ({
  sidebarOpen: true,
  activeRegion: 'all',
  activeGenres: [],
  activeContentType: 'both',
  minRating: '',
  sortBy: 'popularity.desc',
  yearFrom: '',
  yearTo: '',

  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setRegion: (key) => set({ activeRegion: key }),
  toggleGenre: (id) =>
    set((s) => ({
      activeGenres: s.activeGenres.includes(id)
        ? s.activeGenres.filter((g) => g !== id)
        : [...s.activeGenres, id],
    })),
  clearGenres: () => set({ activeGenres: [] }),
  setContentType: (t) => set({ activeContentType: t }),
  setMinRating: (v) => set({ minRating: v }),
  setSortBy: (v) => set({ sortBy: v }),
  setYearFrom: (v) => set({ yearFrom: v }),
  setYearTo: (v) => set({ yearTo: v }),
  clearAll: () =>
    set({ activeRegion: 'all', activeGenres: [], activeContentType: 'both', minRating: '', sortBy: 'popularity.desc', yearFrom: '', yearTo: '' }),

  getDiscoverParams: () => {
    const { activeRegion, activeGenres, minRating, sortBy, yearFrom, yearTo, activeContentType } = get();
    const region = REGIONS.find((r) => r.key === activeRegion);
    const params: Record<string, string> = { sort_by: sortBy };
    if (region?.language) params['with_original_language'] = region.language;
    if (region?.genre) {
      params['with_genres'] = activeGenres.length
        ? [...activeGenres, region.genre].join(',')
        : String(region.genre);
    } else if (activeGenres.length) {
      params['with_genres'] = activeGenres.join(',');
    }
    if (minRating) params['vote_average.gte'] = minRating;
    // Year range — use the right TMDB date field per content type
    const datePrefix = activeContentType === 'tv' ? 'first_air_date' : 'primary_release_date';
    if (yearFrom) params[`${datePrefix}.gte`] = `${yearFrom}-01-01`;
    if (yearTo)   params[`${datePrefix}.lte`] = `${yearTo}-12-31`;
    return params;
  },
}));
