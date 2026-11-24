import 'server-only';
/**
 * Server-side TMDB client (Server Components, route handlers, sitemap). Never ships to the browser.
 *
 *  - native fetch with Next data-cache `revalidate` per endpoint class (lists 1h, details 24h, static 7d)
 *  - 8 s timeout (AbortSignal.timeout), 1 retry on 5xx / network / timeout
 *  - typed TmdbError(status) on failure; detail getters return null on 404 (→ notFound())
 *  - credentials from TMDB_BEARER (v4) or TMDB_API_KEY (v3) via lazy env getters
 */
import type {
  Credits,
  Genre,
  Movie,
  PaginatedResponse,
  Person,
  SearchMultiResult,
  TVShow,
  Video,
  WatchProviders,
} from '@/types/tmdb';
import { getTmdbAuth } from '@/lib/server/env';
import { logger } from '@/lib/server/logger';
import { REVALIDATE, type CacheClass } from './allowlist';
import { buildDiscoverParams, type DiscoverFilters, type MediaKind } from './discover';
import { TmdbError } from './errors';

export { TmdbError } from './errors';
export type { DiscoverFilters, MediaKind } from './discover';

const BASE_URL = 'https://api.themoviedb.org/3';
const TIMEOUT_MS = 8000;
const log = logger.child({ component: 'tmdb' });

export type Params = Record<string, string | number | boolean | undefined | null>;

export interface TmdbFetchOptions {
  /** cache class → revalidate seconds; or pass `revalidate` explicitly */
  cls?: CacheClass;
  revalidate?: number;
  /** optional Next cache tags */
  tags?: string[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Low-level GET against TMDB v3. `path` without leading slash, e.g. "movie/550". */
export async function tmdbFetch<T>(path: string, params: Params = {}, opts: TmdbFetchOptions = {}): Promise<T> {
  const auth = getTmdbAuth(); // ConfigError (503) when not configured
  const url = new URL(`${BASE_URL}/${path.replace(/^\/+/, '')}`);
  const search = new URLSearchParams();
  if (params.language === undefined) search.set('language', 'en-US');
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    search.set(k, String(v));
  }
  if (auth.kind === 'apiKey') search.set('api_key', auth.key);
  search.sort();
  url.search = search.toString();

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (auth.kind === 'bearer') headers.Authorization = `Bearer ${auth.token}`;
  const revalidate = opts.revalidate ?? REVALIDATE[opts.cls ?? 'list'];

  let lastErr: TmdbError | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await sleep(300);
    let res: Response;
    try {
      res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(TIMEOUT_MS),
        next: { revalidate, ...(opts.tags ? { tags: opts.tags } : {}) },
      });
    } catch (err) {
      lastErr = new TmdbError(0, path, `TMDB network error for ${path}`, err);
      log.warn('network error', { path, attempt, err });
      continue;
    }
    if (res.ok) return (await res.json()) as T;

    lastErr = new TmdbError(res.status, path);
    // drain body so the socket can be reused
    await res.body?.cancel().catch(() => undefined);
    if (res.status >= 500) {
      log.warn('upstream 5xx', { path, status: res.status, attempt });
      continue;
    }
    if (res.status === 401 || res.status === 403) log.error('TMDB rejected credentials (check TMDB_BEARER)', { path, status: res.status });
    else if (res.status !== 404) log.warn('upstream error', { path, status: res.status });
    throw lastErr;
  }
  throw lastErr ?? new TmdbError(0, path);
}

/** Returns null on 404, rethrows anything else. */
async function orNull<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch (err) {
    if (err instanceof TmdbError && err.isNotFound) return null;
    throw err;
  }
}

const pg = (page?: number) => Math.min(500, Math.max(1, Math.trunc(page ?? 1) || 1));
const validId = (id: number) => Number.isInteger(id) && id > 0 && id < 2_147_483_647;

export type TimeWindow = 'day' | 'week';
export type VideosResponse = { id?: number; results: Video[] };

// ─── Lists ─────────────────────────────────────────────────────────────────────

export const getTrending = <K extends 'movie' | 'tv' | 'person' | 'all'>(
  kind: K,
  window: TimeWindow = 'week',
  page = 1,
) =>
  tmdbFetch<PaginatedResponse<K extends 'movie' ? Movie : K extends 'tv' ? TVShow : K extends 'person' ? Person : SearchMultiResult>>(
    `trending/${kind}/${window}`,
    { page: pg(page) },
    { cls: 'list' },
  );

export type MovieList = 'popular' | 'top_rated' | 'now_playing' | 'upcoming';
export type TvList = 'popular' | 'top_rated' | 'airing_today' | 'on_the_air';

export const getMovieList = (list: MovieList, page = 1, region?: string) =>
  tmdbFetch<PaginatedResponse<Movie>>(`movie/${list}`, { page: pg(page), region }, { cls: 'list' });

export const getTvList = (list: TvList, page = 1) =>
  tmdbFetch<PaginatedResponse<TVShow>>(`tv/${list}`, { page: pg(page) }, { cls: 'list' });

export const getPopularPeople = (page = 1) =>
  tmdbFetch<PaginatedResponse<Person>>('person/popular', { page: pg(page) }, { cls: 'list' });

export const getTrendingPeople = (window: TimeWindow = 'week', page = 1) => getTrending('person', window, page);

// ─── Details (null on 404) ─────────────────────────────────────────────────────

export const MOVIE_APPEND = 'videos,credits,similar,recommendations,watch/providers,keywords,images';
export const TV_APPEND = 'videos,credits,similar,recommendations,watch/providers';
export const PERSON_APPEND = 'combined_credits,images';

export async function getMovie(id: number, append: string = MOVIE_APPEND): Promise<Movie | null> {
  if (!validId(id)) return null;
  return orNull(
    tmdbFetch<Movie>(`movie/${id}`, { append_to_response: append, include_image_language: 'en,null' }, { cls: 'detail' }),
  );
}

export async function getTv(id: number, append: string = TV_APPEND): Promise<TVShow | null> {
  if (!validId(id)) return null;
  return orNull(tmdbFetch<TVShow>(`tv/${id}`, { append_to_response: append }, { cls: 'detail' }));
}

export async function getPerson(id: number, append: string = PERSON_APPEND): Promise<Person | null> {
  if (!validId(id)) return null;
  return orNull(tmdbFetch<Person>(`person/${id}`, { append_to_response: append }, { cls: 'detail' }));
}

export const getCredits = (kind: MediaKind, id: number) =>
  orNull(tmdbFetch<Credits>(`${kind}/${id}/credits`, {}, { cls: 'detail' }));

export const getVideos = (kind: MediaKind, id: number) =>
  orNull(tmdbFetch<VideosResponse>(`${kind}/${id}/videos`, {}, { cls: 'detail' }));

export const getSimilar = <K extends MediaKind>(kind: K, id: number, page = 1) =>
  orNull(
    tmdbFetch<PaginatedResponse<K extends 'movie' ? Movie : TVShow>>(`${kind}/${id}/similar`, { page: pg(page) }, { cls: 'detail' }),
  );

export const getRecommendations = <K extends MediaKind>(kind: K, id: number, page = 1) =>
  orNull(
    tmdbFetch<PaginatedResponse<K extends 'movie' ? Movie : TVShow>>(
      `${kind}/${id}/recommendations`,
      { page: pg(page) },
      { cls: 'detail' },
    ),
  );

export type RegionProviders = WatchProviders['results'][string];

/** Watch providers for one region (default US), or null when none / 404. */
export async function getWatchProviders(kind: MediaKind, id: number, region = 'US'): Promise<RegionProviders | null> {
  if (!validId(id)) return null;
  const data = await orNull(tmdbFetch<WatchProviders>(`${kind}/${id}/watch/providers`, {}, { cls: 'detail' }));
  return data?.results?.[region.toUpperCase()] ?? null;
}

// ─── Discover / search / genres ────────────────────────────────────────────────

export const discover = <K extends MediaKind>(kind: K, filters: DiscoverFilters = {}) =>
  tmdbFetch<PaginatedResponse<K extends 'movie' ? Movie : TVShow>>(
    `discover/${kind}`,
    buildDiscoverParams(kind, filters),
    { cls: 'list' },
  );

export const searchMulti = (q: string, page = 1) =>
  tmdbFetch<PaginatedResponse<SearchMultiResult>>(
    'search/multi',
    { query: q.trim().slice(0, 100), page: pg(page), include_adult: false },
    { cls: 'list' },
  );

export const searchMovies = (q: string, page = 1) =>
  tmdbFetch<PaginatedResponse<Movie>>('search/movie', { query: q.trim().slice(0, 100), page: pg(page), include_adult: false }, { cls: 'list' });

export const searchTv = (q: string, page = 1) =>
  tmdbFetch<PaginatedResponse<TVShow>>('search/tv', { query: q.trim().slice(0, 100), page: pg(page), include_adult: false }, { cls: 'list' });

export const searchPeople = (q: string, page = 1) =>
  tmdbFetch<PaginatedResponse<Person>>('search/person', { query: q.trim().slice(0, 100), page: pg(page), include_adult: false }, { cls: 'list' });

export async function getGenres(kind: MediaKind): Promise<Genre[]> {
  const data = await tmdbFetch<{ genres: Genre[] }>(`genre/${kind}/list`, {}, { cls: 'static' });
  return data.genres ?? [];
}

// ─── Sitemap helper ────────────────────────────────────────────────────────────

/**
 * Up to `n` (≤1000) popular ids for sitemap generation. Uses popular + top_rated lists
 * (person: popular), de-duplicated, cached 24h. Partial results are returned if a later page fails.
 */
export async function getTopIds(kind: 'movie' | 'tv' | 'person', n = 200): Promise<number[]> {
  const want = Math.min(1000, Math.max(0, Math.trunc(n)));
  const ids = new Set<number>();
  const sources: string[] = kind === 'person' ? ['person/popular'] : [`${kind}/popular`, `${kind}/top_rated`];
  for (const src of sources) {
    for (let page = 1; page <= 500 && ids.size < want; page++) {
      let data: PaginatedResponse<{ id: number }>;
      try {
        data = await tmdbFetch<PaginatedResponse<{ id: number }>>(src, { page }, { cls: 'detail' });
      } catch (err) {
        log.warn('getTopIds: stopping early', { src, page, err });
        break;
      }
      for (const r of data.results ?? []) if (validId(r.id)) ids.add(r.id);
      if (page >= (data.total_pages ?? 1)) break;
    }
    if (ids.size >= want) break;
  }
  return [...ids].slice(0, want);
}
