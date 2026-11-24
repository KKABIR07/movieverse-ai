/**
 * Typed discover filters (the sidebar/filter UI model) → TMDB /discover query params. Pure.
 */

export type MediaKind = 'movie' | 'tv';

export interface DiscoverFilters {
  page?: number;
  genres?: number[];
  /** inclusive, e.g. 1990 */
  yearFrom?: number | string;
  /** inclusive, e.g. 1999 */
  yearTo?: number | string;
  /** ISO 639-1 original language, e.g. 'ko' */
  language?: string;
  /** minimum vote_average (0..10) */
  minRating?: number | string;
  /** minimum vote_count (defaults to 50 when minRating is set, to avoid 1-vote 10/10 titles) */
  minVotes?: number;
  /** TMDB sort, e.g. 'popularity.desc' | 'vote_average.desc' | 'primary_release_date.desc' */
  sortBy?: string;
  /** TMDB region (ISO 3166-1), movie only */
  region?: string;
  withWatchProviders?: number[];
  watchRegion?: string;
}

const yearOf = (v: number | string | undefined): number | null => {
  if (v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).slice(0, 4));
  return Number.isInteger(n) && n >= 1870 && n <= 2199 ? n : null;
};

const SORT_RE = /^[a-z_.]{3,40}\.(asc|desc)$/;

export function buildDiscoverParams(kind: MediaKind, f: DiscoverFilters = {}): Record<string, string> {
  const p: Record<string, string> = { include_adult: 'false' };
  let sort = f.sortBy && SORT_RE.test(f.sortBy) ? f.sortBy : 'popularity.desc';
  // movie ↔ tv date sort names differ
  if (kind === 'tv') sort = sort.replace(/^(primary_release_date|release_date)\./, 'first_air_date.');
  else sort = sort.replace(/^first_air_date\./, 'primary_release_date.');
  p.sort_by = sort;

  if (f.page) p.page = String(Math.min(500, Math.max(1, Math.trunc(f.page))));
  const genres = (f.genres ?? []).filter((g) => Number.isInteger(g) && g > 0);
  if (genres.length) p.with_genres = [...new Set(genres)].join(',');

  let from = yearOf(f.yearFrom);
  let to = yearOf(f.yearTo);
  if (from && to && from > to) [from, to] = [to, from];
  const dateKey = kind === 'tv' ? 'first_air_date' : 'primary_release_date';
  if (from) p[`${dateKey}.gte`] = `${from}-01-01`;
  if (to) p[`${dateKey}.lte`] = `${to}-12-31`;

  if (f.language && /^[a-z]{2}$/.test(f.language)) p.with_original_language = f.language;

  const min = f.minRating === undefined || f.minRating === '' ? NaN : Number(f.minRating);
  if (Number.isFinite(min) && min > 0) {
    p['vote_average.gte'] = String(Math.min(10, min));
    p['vote_count.gte'] = String(f.minVotes ?? 50);
  } else if (f.minVotes) {
    p['vote_count.gte'] = String(f.minVotes);
  } else if (sort.startsWith('vote_average')) {
    p['vote_count.gte'] = '200'; // rating sorts are meaningless without a vote floor
  }

  if (kind === 'movie' && f.region && /^[A-Z]{2}$/.test(f.region)) p.region = f.region;
  const providers = (f.withWatchProviders ?? []).filter((n) => Number.isInteger(n) && n > 0);
  if (providers.length && f.watchRegion && /^[A-Z]{2}$/.test(f.watchRegion)) {
    p.with_watch_providers = providers.join('|');
    p.watch_region = f.watchRegion;
  }
  return p;
}
