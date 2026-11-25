/**
 * Discover page state <-> URL. The URL is the single source of truth: the server page parses it,
 * the filter UI builds the next URL from it. Pure; safe on server and client.
 *
 * Canonical params: type, genres (comma ids), year_from, year_to, rating, lang, sort, page.
 * Legacy params from the old sidebar (with_genres, with_original_language, vote_average.gte,
 * sort_by) are still understood so old links keep working.
 */
import type { DiscoverFilters, MediaKind } from '@/lib/tmdb/discover';
import { buildHref, first, parseIds, parsePage, parseRating, parseYear, pick, type RawParams } from '@/components/browse/params';

export const DISCOVER_TYPES = ['movie', 'tv'] as const satisfies readonly MediaKind[];
export const SORT_KEYS = ['popular', 'rating', 'newest', 'revenue'] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const SORT_OPTIONS: readonly { value: SortKey; label: string; movieOnly?: boolean }[] = [
  { value: 'popular', label: 'Most popular' },
  { value: 'rating', label: 'Highest rated' },
  { value: 'newest', label: 'Newest first' },
  { value: 'revenue', label: 'Box office', movieOnly: true },
];

const SORT_TO_TMDB: Record<SortKey, string> = {
  popular: 'popularity.desc',
  rating: 'vote_average.desc',
  newest: 'primary_release_date.desc', // buildDiscoverParams maps this to first_air_date for TV
  revenue: 'revenue.desc',
};

export const RATING_OPTIONS = [6, 7, 7.5, 8] as const;

/** Original-language options (ISO 639-1). Ported from the old sidebar's regions. */
export const LANGUAGE_OPTIONS: readonly { value: string; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'zh', label: 'Chinese' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'tr', label: 'Turkish' },
  { value: 'th', label: 'Thai' },
  { value: 'ar', label: 'Arabic' },
  { value: 'ru', label: 'Russian' },
  { value: 'ta', label: 'Tamil' },
  { value: 'te', label: 'Telugu' },
];

export interface DiscoverState {
  type: MediaKind;
  genres: number[];
  yearFrom?: number;
  yearTo?: number;
  rating?: number;
  lang?: string;
  sort: SortKey;
  page: number;
}

export const DEFAULT_STATE: DiscoverState = { type: 'movie', genres: [], sort: 'popular', page: 1 };

const LEGACY_SORT: Record<string, SortKey> = {
  'popularity.desc': 'popular',
  'vote_average.desc': 'rating',
  'release_date.desc': 'newest',
  'primary_release_date.desc': 'newest',
  'first_air_date.desc': 'newest',
  'revenue.desc': 'revenue',
};

export function parseDiscover(sp: RawParams): DiscoverState {
  const type = pick(sp.type, DISCOVER_TYPES, 'movie');
  const genres = parseIds(sp.genres ?? sp.with_genres);
  let yearFrom = parseYear(sp.year_from);
  let yearTo = parseYear(sp.year_to);
  if (yearFrom && yearTo && yearFrom > yearTo) [yearFrom, yearTo] = [yearTo, yearFrom];
  const rating = parseRating(sp.rating ?? sp['vote_average.gte']);
  const rawLang = first(sp.lang ?? sp.with_original_language)?.toLowerCase();
  const lang = rawLang && /^[a-z]{2}$/.test(rawLang) ? rawLang : undefined;
  const legacySort = LEGACY_SORT[first(sp.sort_by) ?? ''];
  let sort = pick(sp.sort, SORT_KEYS, legacySort ?? 'popular');
  if (type === 'tv' && sort === 'revenue') sort = 'popular';
  return { type, genres, yearFrom, yearTo, rating, lang, sort, page: parsePage(sp.page) };
}

/** Canonical URL for a state (defaults omitted). */
export function discoverHref(s: DiscoverState): string {
  return buildHref(
    '/discover',
    {
      type: s.type,
      genres: s.genres.length ? s.genres.join(',') : undefined,
      year_from: s.yearFrom,
      year_to: s.yearTo,
      rating: s.rating,
      lang: s.lang,
      sort: s.sort,
      page: s.page,
    },
    { type: 'movie', sort: 'popular' },
  );
}

/** Apply a filter change: every change except paging resets to page 1. */
export function withFilters(s: DiscoverState, patch: Partial<Omit<DiscoverState, 'page'>>): DiscoverState {
  const next: DiscoverState = { ...s, ...patch, page: 1 };
  if (next.type === 'tv' && next.sort === 'revenue') next.sort = 'popular';
  if (next.yearFrom && next.yearTo && next.yearFrom > next.yearTo) [next.yearFrom, next.yearTo] = [next.yearTo, next.yearFrom];
  return next;
}

/** TMDB discover filters for the server call. */
export function toDiscoverFilters(s: DiscoverState): DiscoverFilters {
  return {
    page: s.page,
    genres: s.genres,
    yearFrom: s.yearFrom,
    yearTo: s.yearTo,
    minRating: s.rating,
    language: s.lang,
    sortBy: SORT_TO_TMDB[s.sort],
  };
}

/** Number of active filters (type and sort excluded), for the mobile "Filters (n)" button. */
export function activeFilterCount(s: DiscoverState): number {
  return s.genres.length + (s.yearFrom || s.yearTo ? 1 : 0) + (s.rating ? 1 : 0) + (s.lang ? 1 : 0);
}

export const DECADES: readonly { label: string; from: number; to?: number }[] = [
  { label: '2020s', from: 2020 },
  { label: '2010s', from: 2010, to: 2019 },
  { label: '2000s', from: 2000, to: 2009 },
  { label: '1990s', from: 1990, to: 1999 },
  { label: '1980s', from: 1980, to: 1989 },
  { label: 'Before 1980', from: 1900, to: 1979 },
];

/** Human summary used in the page description and metadata, e.g. "Drama · TV shows · 2015 onwards". */
export function describeDiscover(s: DiscoverState, genreNames: ReadonlyMap<number, string>): string {
  const parts: string[] = [];
  const names = s.genres.map((g) => genreNames.get(g)).filter((n): n is string => !!n);
  if (names.length) parts.push(names.join(', '));
  parts.push(s.type === 'tv' ? 'TV shows' : 'Movies');
  if (s.yearFrom && s.yearTo) parts.push(s.yearFrom === s.yearTo ? String(s.yearFrom) : `${s.yearFrom}–${s.yearTo}`);
  else if (s.yearFrom) parts.push(`${s.yearFrom} onwards`);
  else if (s.yearTo) parts.push(`up to ${s.yearTo}`);
  if (s.rating) parts.push(`rated ${s.rating}+`);
  const lang = LANGUAGE_OPTIONS.find((l) => l.value === s.lang);
  if (lang) parts.push(`in ${lang.label}`);
  return parts.join(' · ');
}
