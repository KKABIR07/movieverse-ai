import { describe, expect, it } from 'vitest';
import { ApiError } from '../../lib/sync/http';
import type { WatchlistItem } from '../../types/tmdb';
import { countByType, describeSaveAll, filterWatchlist, itemKey, saveAllSequential } from './logic';

const w = (id: number, over: Partial<WatchlistItem> = {}): WatchlistItem => ({
  id,
  media_type: 'movie',
  title: `T${id}`,
  poster_path: null,
  release_date: '2020-01-01',
  vote_average: 5,
  addedAt: '2026-01-01T00:00:00Z',
  ...over,
});

const items = [
  w(1, { title: 'Alien', vote_average: 8.5, release_date: '1979-05-25', addedAt: '2026-01-02T00:00:00Z' }),
  w(1, { media_type: 'tv', title: 'Zeta', vote_average: 6, release_date: '', addedAt: '2026-01-04T00:00:00Z' }),
  w(3, { title: 'Brazil', vote_average: 7.9, release_date: '1985-02-20', addedAt: '2026-01-03T00:00:00Z' }),
];

describe('filterWatchlist', () => {
  it('sorts by added (newest first), title, rating and release (unknown last)', () => {
    expect(filterWatchlist(items, {}).map(itemKey)).toEqual(['tv:1', 'movie:3', 'movie:1']);
    expect(filterWatchlist(items, { sort: 'title' }).map((i) => i.title)).toEqual(['Alien', 'Brazil', 'Zeta']);
    expect(filterWatchlist(items, { sort: 'rating' }).map((i) => i.title)).toEqual(['Alien', 'Brazil', 'Zeta']);
    expect(filterWatchlist(items, { sort: 'release' }).map((i) => i.title)).toEqual(['Brazil', 'Alien', 'Zeta']);
  });

  it('filters by type and title, keeping movie:1 and tv:1 distinct', () => {
    expect(filterWatchlist(items, { type: 'tv' }).map(itemKey)).toEqual(['tv:1']);
    expect(filterWatchlist(items, { type: 'movie', query: 'ali' }).map(itemKey)).toEqual(['movie:1']);
  });

  it('does not mutate the input', () => {
    const copy = [...items];
    filterWatchlist(items, { sort: 'title' });
    expect(items).toEqual(copy);
  });

  it('counts by type', () => {
    expect(countByType(items)).toEqual({ all: 3, movie: 2, tv: 1 });
  });
});

describe('saveAllSequential', () => {
  const shared = [w(1), w(1, { media_type: 'tv' }), w(2), w(3)];

  it('skips titles already saved and adds the rest one by one', async () => {
    const calls: string[] = [];
    let inFlight = 0;
    let maxInFlight = 0;
    const progress: number[] = [];
    const r = await saveAllSequential(
      shared,
      new Set(['movie:1']),
      async (i) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await Promise.resolve();
        calls.push(itemKey(i));
        inFlight--;
      },
      (done) => progress.push(done),
    );
    expect(calls).toEqual(['tv:1', 'movie:2', 'movie:3']);
    expect(maxInFlight).toBe(1);
    expect(progress).toEqual([1, 2, 3]);
    expect(r).toEqual({ saved: 3, skipped: 1, failed: 0 });
  });

  it('stops on rate limiting and on auth loss, counts other failures', async () => {
    let n = 0;
    const r = await saveAllSequential(shared, new Set(), async () => {
      n++;
      if (n === 2) throw new ApiError(500, 'INTERNAL', 'x');
      if (n === 3) throw new ApiError(429, 'RATE_LIMITED', 'slow');
    });
    expect(r).toEqual({ saved: 1, skipped: 0, failed: 1, stoppedBy: 'RATE_LIMITED' });

    const r2 = await saveAllSequential(shared, new Set(), async () => {
      throw new ApiError(401, 'UNAUTHORIZED', 'no');
    });
    expect(r2.stoppedBy).toBe('UNAUTHORIZED');
    expect(describeSaveAll(r2)).toContain('sign in again');
  });

  it('describes results honestly', () => {
    expect(describeSaveAll({ saved: 1, skipped: 2, failed: 0 })).toBe('1 title added, 2 already saved.');
    expect(describeSaveAll({ saved: 0, skipped: 0, failed: 0, stoppedBy: 'WATCHLIST_FULL' })).toContain('full');
  });
});
