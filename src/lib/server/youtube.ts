/**
 * YouTube Data API search with a two-level cache:
 *   1. Postgres `youtube_cache` table (24h expires_at; expired rows swept opportunistically + at boot)
 *      — survives restarts, shared across requests
 *   2. In-memory LRU fallback (used when the DB is unavailable, and as a hot front cache)
 * Each uncached search costs 100 quota units, so caching matters a lot (10k units/day free).
 */
import { and, eq, gt, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { maybeSweep } from '@/lib/db/maintenance';
import { youtubeCache, YOUTUBE_CACHE_TTL_SECONDS, type YoutubeCacheItem } from '@/lib/db/schema';
import { getYoutubeApiKey } from './env';
import { HttpError } from './errors';
import { logger } from './logger';

export type YTItem = YoutubeCacheItem;
export type YTSearchType = 'shorts' | 'videos';

const log = logger.child({ component: 'youtube' });

export function cacheKey(q: string, n: number, type: YTSearchType): string {
  const norm = q.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
  return `${type}:${n}:${norm}`.slice(0, 200);
}

// ─── In-memory LRU ─────────────────────────────────────────────────────────────
const MEM_MAX = 500;
const MEM_TTL_MS = YOUTUBE_CACHE_TTL_SECONDS * 1000;
const g = globalThis as typeof globalThis & { __mkYtCache?: Map<string, { items: YTItem[]; exp: number }> };
const mem = (g.__mkYtCache ??= new Map());

function memGet(key: string): YTItem[] | null {
  const hit = mem.get(key);
  if (!hit) return null;
  mem.delete(key);
  if (hit.exp < Date.now()) return null;
  mem.set(key, hit);
  return hit.items;
}

function memSet(key: string, items: YTItem[]): void {
  mem.delete(key);
  while (mem.size >= MEM_MAX) mem.delete(mem.keys().next().value as string);
  mem.set(key, { items, exp: Date.now() + MEM_TTL_MS });
}

export function clearMemoryCache(): void {
  mem.clear();
}

// ─── DB cache (best-effort: any DB failure falls back to memory only) ─────────
async function dbGet(key: string): Promise<YTItem[] | null> {
  try {
    const [row] = await getDb()
      .select({ payload: youtubeCache.payload })
      .from(youtubeCache)
      .where(and(eq(youtubeCache.key, key), gt(youtubeCache.expiresAt, sql`now()`)))
      .limit(1);
    return row && Array.isArray(row.payload) ? row.payload : null;
  } catch (err) {
    log.warn('db cache read failed; using memory cache', { err });
    return null;
  }
}

async function dbSet(key: string, items: YTItem[]): Promise<void> {
  try {
    const db = getDb();
    const expiresAt = new Date(Date.now() + YOUTUBE_CACHE_TTL_SECONDS * 1000);
    await db
      .insert(youtubeCache)
      .values({ key, payload: items, expiresAt })
      .onConflictDoUpdate({ target: youtubeCache.key, set: { payload: items, expiresAt } });
    maybeSweep('youtube', db, 0.05);
  } catch (err) {
    log.warn('db cache write failed', { err });
  }
}

// ─── Upstream ──────────────────────────────────────────────────────────────────
interface YTResponse {
  items?: Array<{
    id?: { videoId?: string };
    snippet?: {
      title?: string;
      channelTitle?: string;
      thumbnails?: { high?: { url?: string }; medium?: { url?: string }; default?: { url?: string } };
    };
  }>;
  error?: { message?: string; errors?: { reason?: string }[] };
}

async function fetchYouTube(key: string, q: string, n: number, type: YTSearchType): Promise<YTItem[]> {
  const params: Record<string, string> = {
    part: 'snippet',
    q: type === 'shorts' ? `${q} #shorts` : q,
    type: 'video',
    maxResults: String(n),
    relevanceLanguage: 'en',
    safeSearch: 'moderate',
    key,
  };
  if (type === 'shorts') params.videoDuration = 'short';

  let res: Response;
  try {
    res = await fetch(`https://www.googleapis.com/youtube/v3/search?${new URLSearchParams(params)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    throw new HttpError(502, 'YouTube is unreachable right now.', { code: 'YOUTUBE_UPSTREAM', cause: err });
  }

  const body = (await res.json().catch(() => ({}))) as YTResponse;
  if (!res.ok) {
    const reason = body.error?.errors?.[0]?.reason;
    log.warn('upstream error', { status: res.status, reason, message: body.error?.message });
    if (res.status === 403 && (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded')) {
      throw new HttpError(503, 'YouTube quota exhausted for today.', {
        code: 'YOUTUBE_QUOTA',
        headers: { 'Retry-After': '3600' },
      });
    }
    throw new HttpError(502, 'YouTube request failed.', { code: 'YOUTUBE_UPSTREAM' });
  }

  return (body.items ?? [])
    .filter((it) => typeof it.id?.videoId === 'string' && /^[\w-]{6,20}$/.test(it.id.videoId))
    .map((it) => ({
      videoId: it.id!.videoId!,
      title: it.snippet?.title ?? '',
      channelTitle: it.snippet?.channelTitle ?? '',
      thumbnail:
        it.snippet?.thumbnails?.high?.url ?? it.snippet?.thumbnails?.medium?.url ?? it.snippet?.thumbnails?.default?.url ?? '',
    }));
}

/** Search with caching. Throws HttpError(503 NO_KEY) when YOUTUBE_API_KEY is not configured. */
export async function searchShorts(
  q: string,
  n: number,
  type: YTSearchType,
): Promise<{ items: YTItem[]; cache: 'memory' | 'db' | 'miss' }> {
  const apiKey = getYoutubeApiKey();
  if (!apiKey) throw new HttpError(503, 'YouTube is not configured.', { code: 'NO_KEY' });

  const key = cacheKey(q, n, type);
  const m = memGet(key);
  if (m) return { items: m, cache: 'memory' };

  const d = await dbGet(key);
  if (d) {
    memSet(key, d);
    return { items: d, cache: 'db' };
  }

  const items = await fetchYouTube(apiKey, q, n, type);
  memSet(key, items);
  await dbSet(key, items);
  return { items, cache: 'miss' };
}
