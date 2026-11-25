import { describe, expect, it, vi } from 'vitest';
import type { WatchlistItem } from '../../types/tmdb';
import { ApiError } from './http';
import { createWatchlistApi, fromServerItem, toServerBody } from './watchlistApi';
import { createWatchlistSync, sortByAdded, type SyncNotice } from './watchlistSync';
import type { WatchlistApi } from './watchlistApi';

const it_ = (id: number, media_type: 'movie' | 'tv', addedAt = `2024-01-${String(id).padStart(2, '0')}T00:00:00Z`): WatchlistItem => ({
  id,
  media_type,
  title: `${media_type} ${id}`,
  poster_path: null,
  release_date: '2020-01-01',
  vote_average: 7,
  addedAt,
});
const keys = (items: WatchlistItem[]) => items.map((i) => `${i.media_type}:${i.id}`);

function harness(api: Partial<WatchlistApi>, initial: WatchlistItem[] = []) {
  let items = initial;
  const notices: SyncNotice[] = [];
  const onAuthLost = vi.fn();
  const full: WatchlistApi = {
    list: api.list ?? (async () => []),
    add: api.add ?? (async () => []),
    remove: api.remove ?? (async () => []),
  };
  const sync = createWatchlistSync({
    api: full,
    getItems: () => items,
    setItems: (next) => {
      items = next;
    },
    notify: (n) => notices.push(n),
    onAuthLost,
  });
  return {
    sync,
    notices,
    onAuthLost,
    get items() {
      return items;
    },
    set items(v: WatchlistItem[]) {
      items = v;
    },
  };
}

describe('optimistic add / remove', () => {
  it('keeps an optimistic add when the server accepts it', async () => {
    const add = vi.fn(async () => []);
    const h = harness({ add }, [it_(1, 'movie')]);
    await expect(h.sync.pushAdd(it_(1, 'movie'))).resolves.toBe(true);
    expect(add).toHaveBeenCalledOnce();
    expect(keys(h.items)).toEqual(['movie:1']);
    expect(h.notices).toHaveLength(0);
    expect(h.sync.pendingCount()).toBe(0);
  });

  it('rolls back only the failed add and toasts', async () => {
    const h = harness({ add: async () => Promise.reject(new ApiError(503, 'DB_UNAVAILABLE', 'down')) }, [
      it_(2, 'tv'),
      it_(1, 'movie'),
    ]);
    await expect(h.sync.pushAdd(it_(2, 'tv'))).resolves.toBe(false);
    expect(keys(h.items)).toEqual(['movie:1']);
    expect(h.notices[0]).toMatchObject({ tone: 'danger', title: "Couldn't save to your watchlist" });
    expect(h.notices[0].description).toMatch(/temporarily unavailable/);
  });

  it('restores a failed remove in addedAt order', async () => {
    const h = harness({ remove: async () => Promise.reject(new ApiError(0, 'NETWORK', 'offline')) }, [
      it_(3, 'movie'),
      it_(1, 'movie'),
    ]);
    await expect(h.sync.pushRemove(it_(2, 'tv'))).resolves.toBe(false);
    expect(keys(h.items)).toEqual(['movie:3', 'tv:2', 'movie:1']);
    expect(h.notices[0].title).toBe("Couldn't remove from your watchlist");
  });

  it('a 401 rolls back and reports the lost session', async () => {
    const h = harness({ add: async () => Promise.reject(new ApiError(401, 'UNAUTHORIZED', 'no')) }, [it_(1, 'movie')]);
    await h.sync.pushAdd(it_(1, 'movie'));
    expect(h.items).toEqual([]);
    expect(h.onAuthLost).toHaveBeenCalledOnce();
  });

  it('does not roll back when a newer toggle of the same title superseded a failed one', async () => {
    let rejectFirst!: (e: unknown) => void;
    const add = vi.fn(() => new Promise<WatchlistItem[]>((_, rej) => (rejectFirst = rej)));
    const remove = vi.fn(async () => []);
    const h = harness({ add, remove }, [it_(1, 'movie')]);
    const first = h.sync.pushAdd(it_(1, 'movie'));
    h.items = [];
    await h.sync.pushRemove(it_(1, 'movie'));
    rejectFirst(new ApiError(500, 'X', 'boom'));
    await expect(first).resolves.toBe(false);
    expect(h.items).toEqual([]);
    expect(h.notices).toHaveLength(0);
  });
});

describe('pull', () => {
  it('replaces local items with the server list, keeping in-flight changes', async () => {
    let resolveAdd!: (v: WatchlistItem[]) => void;
    const h = harness(
      {
        list: async () => [it_(5, 'movie'), it_(4, 'tv')],
        add: () => new Promise((r) => (resolveAdd = r)),
      },
      [it_(9, 'movie'), it_(1, 'movie')],
    );
    const pending = h.sync.pushAdd(it_(9, 'movie'));
    await expect(h.sync.pull()).resolves.toBe(true);
    expect(keys(h.items)).toEqual(['movie:9', 'movie:5', 'tv:4']);
    resolveAdd([]);
    await pending;
  });

  it('keeps the cache when the server is unreachable', async () => {
    const h = harness({ list: async () => Promise.reject(new ApiError(503, 'DB_UNAVAILABLE', 'x')) }, [it_(1, 'movie')]);
    await expect(h.sync.pull()).resolves.toBe(false);
    expect(keys(h.items)).toEqual(['movie:1']);
  });
});

describe('syncOnLogin', () => {
  it('merges local items the server lacks (oldest first), then adopts the server list', async () => {
    const server: WatchlistItem[] = [it_(1, 'movie')];
    const add = vi.fn(async (item: WatchlistItem) => {
      server.unshift(item);
      return [...server];
    });
    const h = harness({ list: async () => [...server], add }, [it_(3, 'tv'), it_(2, 'movie'), it_(1, 'movie')]);
    const r = await h.sync.syncOnLogin(true);
    expect(r).toEqual({ ok: true, pushed: 2, skipped: 0 });
    expect(add.mock.calls.map(([i]) => `${i.media_type}:${i.id}`)).toEqual(['movie:2', 'tv:3']);
    expect(keys(h.items)).toEqual(['tv:3', 'movie:2', 'movie:1']);
    expect(h.notices.at(-1)).toMatchObject({ tone: 'success', title: 'Watchlist synced' });
  });

  it('without merge, the server list wins (deleted elsewhere stays deleted)', async () => {
    const add = vi.fn();
    const h = harness({ list: async () => [it_(7, 'tv')], add }, [it_(1, 'movie')]);
    await h.sync.syncOnLogin(false);
    expect(add).not.toHaveBeenCalled();
    expect(keys(h.items)).toEqual(['tv:7']);
  });

  it('keeps local data and reports failure when the server is down', async () => {
    const h = harness({ list: async () => Promise.reject(new ApiError(503, 'DB_UNAVAILABLE', 'x')) }, [it_(1, 'movie')]);
    const r = await h.sync.syncOnLogin(true);
    expect(r.ok).toBe(false);
    expect(keys(h.items)).toEqual(['movie:1']);
  });

  it('aborts the merge (to retry later) on a 5xx mid-way', async () => {
    let n = 0;
    const h = harness(
      {
        list: async () => [],
        add: async () => {
          if (++n === 2) throw new ApiError(500, 'INTERNAL', 'x');
          return [];
        },
      },
      [it_(2, 'movie'), it_(1, 'movie')],
    );
    const r = await h.sync.syncOnLogin(true);
    expect(r.ok).toBe(false);
    expect(keys(h.items)).toEqual(['movie:2', 'movie:1']);
  });

  it('stops at WATCHLIST_FULL and still adopts the server list', async () => {
    const h = harness(
      {
        list: async () => [it_(1, 'movie')],
        add: async () => Promise.reject(new ApiError(409, 'WATCHLIST_FULL', 'full')),
      },
      [it_(3, 'movie'), it_(2, 'movie')],
    );
    const r = await h.sync.syncOnLogin(true);
    expect(r).toEqual({ ok: true, pushed: 0, skipped: 2 });
    expect(keys(h.items)).toEqual(['movie:1']);
    expect(h.notices[0].title).toBe('Watchlist is full');
  });
});

describe('watchlist API mapping', () => {
  it('maps TV name / first_air_date and drops junk', () => {
    expect(fromServerItem({ id: 1399, media_type: 'tv', name: 'GoT', first_air_date: '2011-04-17', addedAt: 'A' })).toMatchObject({
      id: 1399,
      media_type: 'tv',
      title: 'GoT',
      release_date: '2011-04-17',
    });
    expect(fromServerItem({ id: -1, media_type: 'movie' })).toBeNull();
  });

  it('sends name for TV and title for movies', () => {
    expect(toServerBody(it_(1, 'tv'))).toMatchObject({ id: 1, media_type: 'tv', name: 'tv 1', first_air_date: '2020-01-01' });
    expect(toServerBody(it_(1, 'movie'))).toMatchObject({ title: 'movie 1', release_date: '2020-01-01' });
  });

  it('sends JSON with the right method and parses error envelopes', async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') {
        return new Response(JSON.stringify({ error: 'Sign in', code: 'UNAUTHORIZED', requestId: 'r1' }), { status: 401 });
      }
      return new Response(JSON.stringify({ items: [{ id: 2, media_type: 'movie', title: 'Two' }] }), { status: 201 });
    });
    const api = createWatchlistApi(fetchImpl);
    const items = await api.add(it_(2, 'movie'));
    expect(items.map((i) => i.title)).toEqual(['Two']);
    const [, init] = fetchImpl.mock.calls[0];
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    await expect(api.remove(2, 'movie')).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED', requestId: 'r1' });
  });
});

describe('sortByAdded', () => {
  it('sorts newest first and is stable', () => {
    const a = it_(1, 'movie', '2024-01-01T00:00:00Z');
    const b = it_(2, 'movie', '2024-01-01T00:00:00Z');
    const c = it_(3, 'movie', '2025-01-01T00:00:00Z');
    expect(keys(sortByAdded([a, b, c]))).toEqual(['movie:3', 'movie:1', 'movie:2']);
  });
});
