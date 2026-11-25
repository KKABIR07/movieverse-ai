/**
 * Browser TMDB client. Every call goes to our own allowlisted proxy (`/api/tmdb/...`), which adds the
 * credentials server-side — no secrets in the bundle, and users whose ISP blocks api.themoviedb.org
 * still get data. Server Components should import `@/lib/tmdb/server` instead.
 *
 * Call signatures / return shapes are unchanged from the previous axios client.
 */
import type { Movie, TVShow, PaginatedResponse, Genre, Person, SearchMultiResult, Credits, Video, WatchProviders } from '@/types/tmdb';

export {
  IMAGE_BASE,
  tmdbImage,
  tmdbBackdrop,
  tmdbProfile,
  tmdbLogo,
  getTrailerKey,
  formatRuntime,
  formatYear,
  formatDate,
  formatRating,
  getRatingColor,
} from './tmdb/format';

/**
 * @deprecated TMDB credentials are server-side now; the browser cannot know. Always false —
 * a missing server key surfaces as a 503 from /api/tmdb (TmdbClientError.status === 503).
 */
export const TMDB_KEY_MISSING = false;

/** Error thrown by the browser client. `retryable` is a good input for react-query's `retry`. */
export class TmdbClientError extends Error {
  readonly status: number;
  readonly code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'TmdbClientError';
    this.status = status;
    this.code = code;
  }
  get retryable(): boolean {
    return this.status === 0 || this.status === 429 || this.status === 502 || this.status === 503 || this.status === 504;
  }
}

/** react-query helper: `retry: tmdbRetry` → up to 2 retries for transient failures only. */
export const tmdbRetry = (failureCount: number, error: unknown): boolean =>
  failureCount < 2 && error instanceof TmdbClientError && error.retryable;

type Q = Record<string, string | number | boolean | undefined | null>;

async function api<T>(path: string, params: Q = {}): Promise<T> {
  if (typeof window === 'undefined') {
    throw new TmdbClientError(0, 'The browser TMDB client was called on the server — import "@/lib/tmdb/server" instead.');
  }
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  const query = qs.toString();
  const url = `/api/tmdb/${path}${query ? `?${query}` : ''}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: 'application/json' }, credentials: 'omit' });
  } catch {
    throw new TmdbClientError(0, 'Network error — check your connection.');
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    let code: string | undefined;
    try {
      const body = (await res.json()) as { error?: string; code?: string };
      if (body.error) msg = body.error;
      code = body.code;
    } catch {
      /* non-JSON error body */
    }
    throw new TmdbClientError(res.status, msg, code);
  }
  return (await res.json()) as T;
}

type VideosResult = { results: Pick<Video, 'key' | 'type' | 'site' | 'official'>[] };
type TimeWindow = 'day' | 'week';

export const tmdb = {
  movie: {
    trending: (timeWindow: TimeWindow = 'week', page = 1): Promise<PaginatedResponse<Movie>> =>
      api(`trending/movie/${timeWindow}`, { page }),
    popular: (page = 1): Promise<PaginatedResponse<Movie>> => api('movie/popular', { page }),
    topRated: (page = 1): Promise<PaginatedResponse<Movie>> => api('movie/top_rated', { page }),
    nowPlaying: (page = 1): Promise<PaginatedResponse<Movie>> => api('movie/now_playing', { page }),
    upcoming: (page = 1): Promise<PaginatedResponse<Movie>> => api('movie/upcoming', { page }),
    detail: (id: number): Promise<Movie> =>
      api(`movie/${id}`, {
        append_to_response: 'videos,credits,similar,recommendations,watch/providers,keywords,images',
        include_image_language: 'en,null',
      }),
    similar: (id: number, page = 1): Promise<PaginatedResponse<Movie>> => api(`movie/${id}/similar`, { page }),
    recommendations: (id: number, page = 1): Promise<PaginatedResponse<Movie>> =>
      api(`movie/${id}/recommendations`, { page }),
    discover: (params: Record<string, string | number>): Promise<PaginatedResponse<Movie>> =>
      api('discover/movie', { sort_by: 'popularity.desc', ...params }),
    credits: (id: number): Promise<Credits> => api(`movie/${id}/credits`),
    videos: (id: number): Promise<VideosResult> => api(`movie/${id}/videos`),
    watchProviders: (id: number): Promise<WatchProviders> => api(`movie/${id}/watch/providers`),
  },

  tv: {
    trending: (timeWindow: TimeWindow = 'week', page = 1): Promise<PaginatedResponse<TVShow>> =>
      api(`trending/tv/${timeWindow}`, { page }),
    popular: (page = 1): Promise<PaginatedResponse<TVShow>> => api('tv/popular', { page }),
    topRated: (page = 1): Promise<PaginatedResponse<TVShow>> => api('tv/top_rated', { page }),
    airingToday: (page = 1): Promise<PaginatedResponse<TVShow>> => api('tv/airing_today', { page }),
    onTheAir: (page = 1): Promise<PaginatedResponse<TVShow>> => api('tv/on_the_air', { page }),
    detail: (id: number): Promise<TVShow> =>
      api(`tv/${id}`, { append_to_response: 'videos,credits,similar,recommendations,watch/providers' }),
    similar: (id: number, page = 1): Promise<PaginatedResponse<TVShow>> => api(`tv/${id}/similar`, { page }),
    recommendations: (id: number, page = 1): Promise<PaginatedResponse<TVShow>> =>
      api(`tv/${id}/recommendations`, { page }),
    discover: (params: Record<string, string | number>): Promise<PaginatedResponse<TVShow>> =>
      api('discover/tv', { sort_by: 'popularity.desc', ...params }),
    credits: (id: number): Promise<Credits> => api(`tv/${id}/credits`),
    videos: (id: number): Promise<VideosResult> => api(`tv/${id}/videos`),
    watchProviders: (id: number): Promise<WatchProviders> => api(`tv/${id}/watch/providers`),
  },

  search: {
    multi: (query: string, page = 1): Promise<PaginatedResponse<SearchMultiResult>> =>
      api('search/multi', { query: query.slice(0, 100), page }),
    movie: (query: string, page = 1): Promise<PaginatedResponse<Movie>> =>
      api('search/movie', { query: query.slice(0, 100), page }),
    tv: (query: string, page = 1): Promise<PaginatedResponse<TVShow>> => api('search/tv', { query: query.slice(0, 100), page }),
    person: (query: string, page = 1): Promise<PaginatedResponse<Person>> =>
      api('search/person', { query: query.slice(0, 100), page }),
  },

  genre: {
    movieList: (): Promise<{ genres: Genre[] }> => api('genre/movie/list'),
    tvList: (): Promise<{ genres: Genre[] }> => api('genre/tv/list'),
  },

  person: {
    detail: (id: number): Promise<Person> => api(`person/${id}`, { append_to_response: 'combined_credits,images' }),
    popular: (page = 1): Promise<PaginatedResponse<Person>> => api('person/popular', { page }),
    trending: (timeWindow: TimeWindow = 'week', page = 1): Promise<PaginatedResponse<Person>> =>
      api(`trending/person/${timeWindow}`, { page }),
  },
};
