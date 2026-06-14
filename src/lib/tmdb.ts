import axios from 'axios';
import type {
  Movie,
  TVShow,
  PaginatedResponse,
  Genre,
  Person,
  SearchMultiResult,
  Credits,
} from '@/types/tmdb';

const BASE_URL = 'https://api.themoviedb.org/3';
const BEARER = process.env.NEXT_PUBLIC_TMDB_BEARER || '';
const API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY || '';

export const TMDB_KEY_MISSING =
  (!BEARER || BEARER.length < 20) && (!API_KEY || API_KEY === 'your_tmdb_api_key_here' || API_KEY.length < 10);

export const IMAGE_BASE = 'https://image.tmdb.org/t/p';

export const tmdbImage = (path: string | null, size: string = 'w500'): string => {
  if (!path) return '/placeholder-poster.svg';
  return `${IMAGE_BASE}/${size}${path}`;
};

export const tmdbBackdrop = (path: string | null): string => {
  if (!path) return '/placeholder-backdrop.svg';
  return `${IMAGE_BASE}/original${path}`;
};

// Prefer Bearer token (v4 auth); fall back to api_key param
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: BEARER
    ? { Authorization: `Bearer ${BEARER}` }
    : {},
  params: BEARER
    ? { language: 'en-US' }
    : { api_key: API_KEY, language: 'en-US' },
});

api.interceptors.request.use((config) => {
  if (TMDB_KEY_MISSING) return Promise.reject(new Error('TMDB_KEY_MISSING'));
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.message === 'TMDB_KEY_MISSING') return Promise.reject(err);
    if (err.response?.status === 401) {
      console.warn('[MovieVerse] TMDB 401: check NEXT_PUBLIC_TMDB_BEARER in .env.local');
    } else {
      console.error('TMDB API Error:', err.response?.status, err.message);
    }
    return Promise.reject(err);
  }
);

// Movies
export const tmdb = {
  movie: {
    trending: (timeWindow: 'day' | 'week' = 'week'): Promise<PaginatedResponse<Movie>> =>
      api.get(`/trending/movie/${timeWindow}`).then((r) => r.data),

    popular: (page = 1): Promise<PaginatedResponse<Movie>> =>
      api.get('/movie/popular', { params: { page } }).then((r) => r.data),

    topRated: (page = 1): Promise<PaginatedResponse<Movie>> =>
      api.get('/movie/top_rated', { params: { page } }).then((r) => r.data),

    nowPlaying: (page = 1): Promise<PaginatedResponse<Movie>> =>
      api.get('/movie/now_playing', { params: { page } }).then((r) => r.data),

    upcoming: (page = 1): Promise<PaginatedResponse<Movie>> =>
      api.get('/movie/upcoming', { params: { page } }).then((r) => r.data),

    detail: (id: number): Promise<Movie> =>
      api
        .get(`/movie/${id}`, {
          params: {
            append_to_response: 'videos,credits,similar,recommendations,watch/providers,keywords,images',
          },
        })
        .then((r) => r.data),

    similar: (id: number, page = 1): Promise<PaginatedResponse<Movie>> =>
      api.get(`/movie/${id}/similar`, { params: { page } }).then((r) => r.data),

    recommendations: (id: number, page = 1): Promise<PaginatedResponse<Movie>> =>
      api.get(`/movie/${id}/recommendations`, { params: { page } }).then((r) => r.data),

    discover: (params: Record<string, string | number>): Promise<PaginatedResponse<Movie>> =>
      api.get('/discover/movie', { params: { sort_by: 'popularity.desc', ...params } }).then((r) => r.data),

    credits: (id: number): Promise<Credits> =>
      api.get(`/movie/${id}/credits`).then((r) => r.data),

    videos: (id: number): Promise<{ results: { key: string; type: string; site: string; official: boolean }[] }> =>
      api.get(`/movie/${id}/videos`).then((r) => r.data),
  },

  tv: {
    trending: (timeWindow: 'day' | 'week' = 'week'): Promise<PaginatedResponse<TVShow>> =>
      api.get(`/trending/tv/${timeWindow}`).then((r) => r.data),

    popular: (page = 1): Promise<PaginatedResponse<TVShow>> =>
      api.get('/tv/popular', { params: { page } }).then((r) => r.data),

    topRated: (page = 1): Promise<PaginatedResponse<TVShow>> =>
      api.get('/tv/top_rated', { params: { page } }).then((r) => r.data),

    detail: (id: number): Promise<TVShow> =>
      api
        .get(`/tv/${id}`, {
          params: { append_to_response: 'videos,credits,similar,recommendations,watch/providers' },
        })
        .then((r) => r.data),

    videos: (id: number): Promise<{ results: { key: string; type: string; site: string; official: boolean }[] }> =>
      api.get(`/tv/${id}/videos`).then((r) => r.data),
  },

  search: {
    multi: (query: string, page = 1): Promise<PaginatedResponse<SearchMultiResult>> =>
      api.get('/search/multi', { params: { query, page, include_adult: false } }).then((r) => r.data),

    movie: (query: string, page = 1): Promise<PaginatedResponse<Movie>> =>
      api.get('/search/movie', { params: { query, page, include_adult: false } }).then((r) => r.data),

    tv: (query: string, page = 1): Promise<PaginatedResponse<TVShow>> =>
      api.get('/search/tv', { params: { query, page } }).then((r) => r.data),

    person: (query: string, page = 1): Promise<PaginatedResponse<Person>> =>
      api.get('/search/person', { params: { query, page } }).then((r) => r.data),
  },

  genre: {
    movieList: (): Promise<{ genres: Genre[] }> =>
      api.get('/genre/movie/list').then((r) => r.data),

    tvList: (): Promise<{ genres: Genre[] }> =>
      api.get('/genre/tv/list').then((r) => r.data),
  },

  person: {
    detail: (id: number): Promise<Person> =>
      api.get(`/person/${id}`, { params: { append_to_response: 'combined_credits,images' } }).then((r) => r.data),

    popular: (page = 1): Promise<PaginatedResponse<Person>> =>
      api.get('/person/popular', { params: { page } }).then((r) => r.data),

    trending: (timeWindow: 'day' | 'week' = 'week', page = 1): Promise<PaginatedResponse<Person>> =>
      api.get(`/trending/person/${timeWindow}`, { params: { page } }).then((r) => r.data),
  },
};

export const getTrailerKey = (videos: { results: { type: string; site: string; key: string; official: boolean }[] } | undefined): string | null => {
  if (!videos?.results?.length) return null;
  const trailer =
    videos.results.find((v) => v.type === 'Trailer' && v.site === 'YouTube' && v.official) ||
    videos.results.find((v) => v.type === 'Trailer' && v.site === 'YouTube') ||
    videos.results.find((v) => v.site === 'YouTube');
  return trailer?.key ?? null;
};

export const formatRuntime = (minutes: number | undefined): string => {
  if (!minutes) return 'N/A';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

export const formatYear = (dateStr: string | undefined): string => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).getFullYear().toString();
};

export const formatRating = (rating: number): string => {
  return rating.toFixed(1);
};

export const getRatingColor = (rating: number): string => {
  if (rating >= 7.5) return '#22c55e';
  if (rating >= 6) return '#f59e0b';
  if (rating >= 4) return '#f97316';
  return '#ef4444';
};
