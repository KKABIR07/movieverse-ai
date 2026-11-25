/**
 * Watchlist page helpers (pure, unit-tested): filtering / sorting the saved titles and the
 * "save all" flow of a shared list.
 */
import type { WatchlistItem } from '../../types/tmdb';
import { ApiError } from '../../lib/sync/http';

export type WatchlistSort = 'added' | 'title' | 'release' | 'rating';
export type WatchlistType = 'all' | 'movie' | 'tv';

/** Watchlist identity: `${media_type}:${id}` (movie 1399 and tv 1399 are different titles). */
export const itemKey = (i: Pick<WatchlistItem, 'id' | 'media_type'>) => `${i.media_type ?? 'movie'}:${i.id}`;

const ts = (d: string | undefined | null) => {
  const t = d ? Date.parse(d) : NaN;
  return Number.isFinite(t) ? t : null;
};

export function filterWatchlist(
  items: readonly WatchlistItem[],
  { type = 'all', query = '', sort = 'added' }: { type?: WatchlistType; query?: string; sort?: WatchlistSort },
): WatchlistItem[] {
  const q = query.trim().toLowerCase();
  const out = items.filter((i) => (type === 'all' || (i.media_type ?? 'movie') === type) && (!q || i.title.toLowerCase().includes(q)));
  const byTitle = (a: WatchlistItem, b: WatchlistItem) => a.title.localeCompare(b.title);
  switch (sort) {
    case 'title':
      return out.sort(byTitle);
    case 'rating':
      return out.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0) || byTitle(a, b));
    case 'release':
      // Newest release first; unknown dates last.
      return out.sort((a, b) => {
        const ta = ts(a.release_date);
        const tb = ts(b.release_date);
        if (ta === null && tb === null) return byTitle(a, b);
        if (ta === null) return 1;
        if (tb === null) return -1;
        return tb - ta || byTitle(a, b);
      });
    default:
      return out.sort((a, b) => (ts(b.addedAt) ?? 0) - (ts(a.addedAt) ?? 0));
  }
}

export function countByType(items: readonly WatchlistItem[]): { all: number; movie: number; tv: number } {
  let tv = 0;
  for (const i of items) if (i.media_type === 'tv') tv++;
  return { all: items.length, movie: items.length - tv, tv };
}

export interface SaveAllResult {
  saved: number;
  skipped: number;
  failed: number;
  /** Set when the run stopped early (rate limit, sign-in lost, full list). */
  stoppedBy?: 'RATE_LIMITED' | 'UNAUTHORIZED' | 'WATCHLIST_FULL';
}

/**
 * Add shared titles one at a time (sequential, so a 100-item list never bursts the API rate limit).
 * Titles already saved are skipped. Stops on 401 / 429 / WATCHLIST_FULL; other failures are counted.
 */
export async function saveAllSequential(
  items: readonly Omit<WatchlistItem, 'addedAt'>[],
  existing: ReadonlySet<string>,
  add: (item: WatchlistItem) => Promise<unknown>,
  onProgress?: (done: number, total: number) => void,
): Promise<SaveAllResult> {
  const todo = items.filter((i) => !existing.has(itemKey(i)));
  const result: SaveAllResult = { saved: 0, skipped: items.length - todo.length, failed: 0 };
  let done = 0;
  for (const item of todo) {
    try {
      await add({ ...item, addedAt: new Date().toISOString() });
      result.saved++;
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) return { ...result, stoppedBy: 'UNAUTHORIZED' };
        if (err.status === 429 || err.code === 'RATE_LIMITED') return { ...result, stoppedBy: 'RATE_LIMITED' };
        if (err.code === 'WATCHLIST_FULL') return { ...result, stoppedBy: 'WATCHLIST_FULL' };
      }
      result.failed++;
    }
    done++;
    onProgress?.(done, todo.length);
  }
  return result;
}

/** One-line, honest summary of a save-all run. */
export function describeSaveAll(r: SaveAllResult): string {
  const parts: string[] = [];
  parts.push(`${r.saved} ${r.saved === 1 ? 'title' : 'titles'} added`);
  if (r.skipped) parts.push(`${r.skipped} already saved`);
  if (r.failed) parts.push(`${r.failed} failed`);
  let s = parts.join(', ') + '.';
  if (r.stoppedBy === 'RATE_LIMITED') s += ' Stopped early: too many requests, try again in a minute.';
  if (r.stoppedBy === 'UNAUTHORIZED') s += ' Stopped: please sign in again.';
  if (r.stoppedBy === 'WATCHLIST_FULL') s += ' Stopped: your watchlist is full.';
  return s;
}
