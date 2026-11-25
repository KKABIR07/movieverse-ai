/**
 * Browser helpers for the YouTube features. Talks only to our own API:
 *   GET /api/youtube/status  → { configured }   (no quota cost)
 *   GET /api/youtube/shorts  → { items }        (server-side 24h cache; each miss costs quota)
 *
 * Quota hygiene: results are memoised in memory AND sessionStorage (6h) so reloads and
 * page hops don't re-ask; identical concurrent requests share one fetch.
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

/** Thrown by `searchYouTube` (status 0 = network; 429/403/503 usually = quota or not configured). */
export class YouTubeError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(`YouTube request failed (${status} ${code})`);
    this.name = 'YouTubeError';
  }
}

const CACHE_MAX = 200;
const SESSION_TTL = 6 * 60 * 60 * 1000;
const SESSION_PREFIX = 'mkmovies-yt:';
const cache = new Map<string, YTShortItem[]>();
const inflight = new Map<string, Promise<YTShortItem[]>>();

function remember(key: string, items: YTShortItem[]): void {
  cache.delete(key);
  while (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(key, items);
  try {
    sessionStorage.setItem(SESSION_PREFIX + key, JSON.stringify({ t: Date.now(), items }));
  } catch {
    /* storage full / blocked */
  }
}

function recall(key: string): YTShortItem[] | null {
  const hit = cache.get(key);
  if (hit) return hit;
  try {
    const raw = sessionStorage.getItem(SESSION_PREFIX + key);
    if (!raw) return null;
    const { t, items } = JSON.parse(raw) as { t: number; items: YTShortItem[] };
    if (Date.now() - t > SESSION_TTL || !Array.isArray(items)) return null;
    cache.set(key, items);
    return items;
  } catch {
    return null;
  }
}

const isItem = (x: unknown): x is YTShortItem =>
  !!x && typeof (x as YTShortItem).videoId === 'string' && /^[A-Za-z0-9_-]{6,20}$/.test((x as YTShortItem).videoId);

/** Search via our API. Throws `YouTubeError` on failure (so callers can show a quota message). */
export async function searchYouTube(query: string, n = 3, type: 'shorts' | 'videos' = 'shorts'): Promise<YTShortItem[]> {
  const q = query.trim().slice(0, 100);
  const count = Math.min(10, Math.max(1, Math.trunc(n)));
  if (!q) return [];
  const key = `${type}::${q.toLowerCase()}::${count}`;
  const hit = recall(key);
  if (hit) return hit;
  const pending = inflight.get(key);
  if (pending) return pending;

  const p = (async () => {
    try {
      let res: Response;
      try {
        res = await fetch(`/api/youtube/shorts?${new URLSearchParams({ q, n: String(count), type })}`);
      } catch {
        throw new YouTubeError(0, 'NETWORK');
      }
      if (!res.ok) {
        let code = `HTTP_${res.status}`;
        try {
          const body = (await res.json()) as { code?: string };
          if (body.code) code = body.code;
        } catch {
          /* ignore */
        }
        throw new YouTubeError(res.status, code);
      }
      const { items } = (await res.json()) as { items?: unknown[] };
      const result = (items ?? []).filter(isItem);
      remember(key, result);
      return result;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

/** Regular videos (not shorts) for a phrase. Throws on failure. */
export const fetchYouTubeVideos = (query: string, n = 6) => searchYouTube(query, n, 'videos');

/** Shorts for one title, annotated with the title's info. Never throws (empty on failure). */
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
  let items: YTShortItem[];
  try {
    items = await searchYouTube(movie.title, n, type);
  } catch {
    return [];
  }
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
