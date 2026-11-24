/**
 * Browser helpers for the YouTube shorts feature. Talks only to our own API:
 *   GET /api/youtube/status  → { configured }   (no quota cost)
 *   GET /api/youtube/shorts  → { items }        (server-side 24h cache)
 */

export interface YTShort {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  /** Which movie this short is associated with */
  relatedMovie: string;
  relatedMovieId: number;
  relatedMoviePoster: string | null;
  relatedMovieRating: number;
  relatedMovieType: 'movie' | 'tv';
  relatedMovieDate?: string;
}

export type YTShortItem = Pick<YTShort, 'videoId' | 'title' | 'channelTitle' | 'thumbnail'>;

const CACHE_MAX = 200;
const cache = new Map<string, YTShortItem[]>();
const inflight = new Map<string, Promise<YTShortItem[]>>();

function remember(key: string, items: YTShortItem[]): void {
  cache.delete(key);
  while (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(key, items);
}

async function searchYT(movieTitle: string, n: number, type: 'shorts' | 'videos' = 'shorts'): Promise<YTShortItem[]> {
  const q = movieTitle.trim().slice(0, 100);
  if (!q) return [];
  const key = `${type}::${q.toLowerCase()}::${n}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const pending = inflight.get(key);
  if (pending) return pending;

  const p = (async () => {
    try {
      const res = await fetch(`/api/youtube/shorts?${new URLSearchParams({ q, n: String(n), type })}`);
      if (!res.ok) return [];
      const { items } = (await res.json()) as { items?: YTShortItem[] };
      const result = items ?? [];
      remember(key, result);
      return result;
    } catch {
      return [];
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

export async function fetchMovieShorts(
  movie: {
    title: string;
    id: number;
    poster_path: string | null;
    vote_average: number;
    type: 'movie' | 'tv';
    date?: string;
  },
  n = 3,
  type: 'shorts' | 'videos' = 'shorts',
): Promise<YTShort[]> {
  const items = await searchYT(movie.title, n, type);
  return items.map((item) => ({
    ...item,
    relatedMovie: movie.title,
    relatedMovieId: movie.id,
    relatedMoviePoster: movie.poster_path,
    relatedMovieRating: movie.vote_average,
    relatedMovieType: movie.type,
    relatedMovieDate: movie.date,
  }));
}

let statusPromise: Promise<boolean> | null = null;

/** True if YOUTUBE_API_KEY is configured on the server. Does not spend YouTube quota. */
export async function checkYouTubeKey(): Promise<boolean> {
  statusPromise ??= (async () => {
    try {
      const res = await fetch('/api/youtube/status');
      if (!res.ok) return false;
      const { configured } = (await res.json()) as { configured?: boolean };
      return configured === true;
    } catch {
      statusPromise = null; // allow retry after a network error
      return false;
    }
  })();
  return statusPromise;
}
