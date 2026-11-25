import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * Integration tests for the zustand stores in node. A Map-backed localStorage
 * (and `window`) is installed BEFORE the stores are imported so the persist
 * middleware has real storage to write to and clear.
 */
class MemoryStorage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(k: string) {
    return this.map.has(k) ? (this.map.get(k) as string) : null;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  setItem(k: string, v: string) {
    this.map.set(k, String(v));
  }
}

const storage = new MemoryStorage();
const g = globalThis as unknown as { localStorage: MemoryStorage; window: unknown };
g.localStorage = storage;
g.window = globalThis;

type Stores = typeof import('./index');
type Hydration = typeof import('./hydration');
type Following = typeof import('./followingStore');
let S: Stores;
let H: Hydration;
let F: Following;

beforeAll(async () => {
  S = await import('./index');
  H = await import('./hydration');
  F = await import('./followingStore');
});

const item = (id: number, media_type: 'movie' | 'tv') => ({
  id,
  title: `${media_type} ${id}`,
  poster_path: null,
  release_date: '2021-01-01',
  vote_average: 8,
  media_type,
});

beforeEach(() => {
  storage.clear();
  S.useWatchlistStore.getState().reset();
  S.useRatingsStore.getState().reset();
  S.useReviewsStore.getState().reset();
  F.useFollowingStore.getState().reset();
  storage.clear();
});

describe('watchlist store (keyed by media type)', () => {
  it('keeps a movie and a TV show with the same id apart', () => {
    const w = S.useWatchlistStore.getState();
    w.add(item(1399, 'movie'));
    w.add(item(1399, 'tv'));
    const s = S.useWatchlistStore.getState();
    expect(s.getActiveItems()).toHaveLength(2);
    expect(s.has(1399, 'movie')).toBe(true);
    expect(s.has(1399, 'tv')).toBe(true);

    s.remove(1399, 'tv');
    expect(S.useWatchlistStore.getState().has(1399, 'tv')).toBe(false);
    expect(S.useWatchlistStore.getState().has(1399, 'movie')).toBe(true);
  });

  it('legacy 1-arg has/remove target movies only', () => {
    const w = S.useWatchlistStore.getState();
    w.add(item(42, 'tv'));
    w.add(item(42, 'movie'));
    expect(S.useWatchlistStore.getState().has(42)).toBe(true);
    S.useWatchlistStore.getState().remove(42);
    expect(S.useWatchlistStore.getState().has(42, 'movie')).toBe(false);
    expect(S.useWatchlistStore.getState().has(42, 'tv')).toBe(true);
  });

  it('toggle adds then removes and reports the new state', () => {
    const w = S.useWatchlistStore.getState();
    expect(w.toggle(item(7, 'tv'))).toBe(true);
    expect(S.useWatchlistStore.getState().has(7, 'tv')).toBe(true);
    expect(S.useWatchlistStore.getState().toggle(item(7, 'tv'))).toBe(false);
    expect(S.useWatchlistStore.getState().has(7, 'tv')).toBe(false);
  });

  it('hasInAny / removeFromList honour the media type', () => {
    const w = S.useWatchlistStore.getState();
    const listId = w.createList('Weekend');
    S.useWatchlistStore.getState().addToList(listId, item(5, 'tv'));
    expect(S.useWatchlistStore.getState().hasInAny(5, 'tv')).toBe(true);
    expect(S.useWatchlistStore.getState().hasInAny(5, 'movie')).toBe(false);
    S.useWatchlistStore.getState().removeFromList(listId, 5, 'tv');
    expect(S.useWatchlistStore.getState().hasInAny(5, 'tv')).toBe(false);
  });

  it('persists with version 4', () => {
    S.useWatchlistStore.getState().add(item(1, 'movie'));
    const raw = JSON.parse(storage.getItem('mkmovies-watchlist') ?? '{}');
    expect(raw.version).toBe(4);
    expect(raw.state.lists[0].items[0]).toMatchObject({ id: 1, media_type: 'movie' });
  });

  it('rehydrates and migrates a v2 payload from storage', async () => {
    storage.setItem(
      'mkmovies-watchlist',
      JSON.stringify({
        version: 2,
        state: { lists: [{ id: 'default', name: 'Old', createdAt: 'x', items: [{ id: 9, title: 'Nine' }] }], activeListId: 'default' },
      }),
    );
    await S.useWatchlistStore.persist.rehydrate();
    const s = S.useWatchlistStore.getState();
    expect(s.has(9, 'movie')).toBe(true);
    expect(s.lists[0].name).toBe('Old');
  });
});

describe('logout / account switch clears per-user data', () => {
  const seed = () => {
    S.useWatchlistStore.getState().add(item(1, 'movie'));
    S.useRatingsStore.getState().rate(1, 8);
    S.useReviewsStore.getState().addReview({
      movieId: 1,
      movieTitle: 'One',
      moviePoster: null,
      rating: 8,
      content: 'Great',
      spoiler: false,
    });
    F.useFollowingStore.setState({
      following: [{ id: 3, name: 'P', profile_path: null, known_for_department: 'Acting', followedAt: 'x' }],
    });
  };
  const isEmpty = () => {
    expect(S.useWatchlistStore.getState().getActiveItems()).toHaveLength(0);
    expect(S.useRatingsStore.getState().ratings).toEqual({});
    expect(S.useReviewsStore.getState().reviews).toEqual([]);
    expect(F.useFollowingStore.getState().following).toEqual([]);
    for (const k of ['mkmovies-watchlist', 'mkmovies-ratings', 'mkmovies-reviews', 'mkmovies-following']) {
      expect(storage.getItem(k)).toBeNull();
    }
  };

  it('wipes memory and storage on logout', () => {
    H.reconcileUserScope('authenticated', 'user-a');
    seed();
    expect(storage.getItem('mkmovies-watchlist')).not.toBeNull();
    H.reconcileUserScope('anonymous', null);
    isEmpty();
    expect(storage.getItem('mkmovies-owner')).toBeNull();
  });

  it('wipes when a different user signs in', () => {
    H.reconcileUserScope('authenticated', 'user-a');
    seed();
    H.reconcileUserScope('authenticated', 'user-b');
    isEmpty();
    expect(storage.getItem('mkmovies-owner')).toBe('user-b');
  });

  it('keeps data for the same user and when status is unknown', () => {
    H.reconcileUserScope('authenticated', 'user-a');
    seed();
    H.reconcileUserScope('authenticated', 'user-a');
    H.reconcileUserScope('unknown', null);
    expect(S.useWatchlistStore.getState().getActiveItems()).toHaveLength(1);
    expect(storage.getItem('mkmovies-owner')).toBe('user-a');
  });

  it('authStore.logout() wipes data even when no owner was recorded (storage blocked)', async () => {
    storage.removeItem('mkmovies-owner');
    seed();
    const { useAuthStore } = await import('./authStore');
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response('{"ok":true}', { status: 200 })) as typeof fetch;
    try {
      await useAuthStore.getState().logout();
    } finally {
      globalThis.fetch = realFetch;
    }
    expect(useAuthStore.getState().status).toBe('anonymous');
    isEmpty();
  });

  it('authStore.logoutAll() keeps data and throws when the server refuses', async () => {
    seed();
    const { useAuthStore } = await import('./authStore');
    useAuthStore.setState({ status: 'authenticated' });
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response('{"error":"DB down"}', { status: 503 })) as typeof fetch;
    try {
      await expect(useAuthStore.getState().logoutAll()).rejects.toThrow('DB down');
    } finally {
      globalThis.fetch = realFetch;
    }
    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(S.useWatchlistStore.getState().getActiveItems()).toHaveLength(1);
    useAuthStore.setState({ status: 'unknown' });
  });

  it('adopts unowned (pre-login) data on first sign-in', () => {
    storage.removeItem('mkmovies-owner');
    seed();
    H.reconcileUserScope('authenticated', 'user-c');
    expect(S.useWatchlistStore.getState().getActiveItems()).toHaveLength(1);
    expect(storage.getItem('mkmovies-owner')).toBe('user-c');
  });
});

describe('ui store', () => {
  it('openAuth sets the tab and opens the dialog', () => {
    S.openAuth('signup');
    expect(S.useUIStore.getState()).toMatchObject({ authOpen: true, authTab: 'signup' });
    S.useUIStore.getState().closeAuth();
    expect(S.useUIStore.getState().authOpen).toBe(false);
  });
});

describe('ratings store', () => {
  it('migrates v0 numeric keys to movie:<id> and keeps tv separate', () => {
    expect(S.migrateRatings({ ratings: { '550': 8, bad: 3, '12': 'x' } }, 0)).toEqual({ ratings: { 'movie:550': 8 } });
    S.useRatingsStore.getState().rate(1399, 9, 'tv');
    S.useRatingsStore.getState().rate(1399, 4, 'movie');
    expect(S.useRatingsStore.getState().getRating(1399, 'tv')).toBe(9);
    expect(S.useRatingsStore.getState().getRating(1399)).toBe(4);
    S.useRatingsStore.getState().clearRating(1399, 'tv');
    expect(S.useRatingsStore.getState().getRating(1399, 'tv')).toBeNull();
  });
});

describe('server-backed watchlist (signed in)', () => {
  type A = typeof import('./authStore');
  let Auth: A;
  const realFetch = globalThis.fetch;
  const flush = () => new Promise((r) => setTimeout(r, 0));

  beforeAll(async () => {
    Auth = await import('./authStore');
  });

  const signIn = (id = 'u1') =>
    Auth.useAuthStore.setState({
      status: 'authenticated',
      user: { id, name: 'U', email: 'u@x.y', avatar: null, initials: 'U', joinedAt: '2024-01-01' },
    });

  it('rolls back an optimistic add when the API fails', async () => {
    signIn();
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: 'down', code: 'DB_UNAVAILABLE' }), { status: 503 })) as typeof fetch;
    try {
      S.useWatchlistStore.getState().add(item(10, 'tv'));
      expect(S.useWatchlistStore.getState().has(10, 'tv')).toBe(true);
      await flush();
      await flush();
      expect(S.useWatchlistStore.getState().has(10, 'tv')).toBe(false);
    } finally {
      globalThis.fetch = realFetch;
      Auth.useAuthStore.setState({ status: 'unknown', user: null });
    }
  });

  it('merges local items into the account once on login, then marks the merge', async () => {
    S.useWatchlistStore.getState().add(item(1, 'movie'));
    signIn('u2');
    const calls: string[] = [];
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      calls.push(init?.method ?? 'GET');
      if ((init?.method ?? 'GET') === 'GET') return new Response(JSON.stringify({ items: [] }), { status: 200 });
      const body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ items: [body] }), { status: 201 });
    }) as typeof fetch;
    try {
      await S.useWatchlistStore.getState().syncFromServer('u2');
      expect(calls).toEqual(['GET', 'POST']);
      expect(S.useWatchlistStore.getState().mergedFor).toBe('u2');
      expect(S.useWatchlistStore.getState().has(1, 'movie')).toBe(true);
      calls.length = 0;
      await S.useWatchlistStore.getState().syncFromServer('u2');
      expect(calls).toEqual(['GET']); // no second merge
    } finally {
      globalThis.fetch = realFetch;
      Auth.useAuthStore.setState({ status: 'unknown', user: null });
    }
  });
});

describe('following store hydrate vs in-flight clicks', () => {
  const realFetch = globalThis.fetch;
  const person = (id: number) => ({ id, name: `P${id}`, profile_path: null, known_for_department: 'Acting' });
  const serverRow = (id: number) => ({ personId: id, personName: `P${id}` });

  it('a list fetched before a follow/unfollow click does not undo it', async () => {
    F.useFollowingStore.getState().reset();
    F.useFollowingStore.setState({ following: [{ ...person(2), followedAt: '2024-01-01' }] });
    // GET is held open until we release it; it reflects the server BEFORE the clicks (follows 2 and 3).
    let releaseGet!: () => void;
    const getGate = new Promise<void>((r) => (releaseGet = r));
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (method === 'GET') {
        await getGate;
        return new Response(JSON.stringify({ following: [serverRow(2), serverRow(3)] }), { status: 200 });
      }
      return new Response(JSON.stringify({ followerCount: 1 }), { status: method === 'POST' ? 201 : 200 });
    }) as typeof fetch;
    try {
      const hydrating = F.useFollowingStore.getState().hydrate();
      await F.useFollowingStore.getState().follow(person(1)); // new follow while the GET is in flight
      await F.useFollowingStore.getState().unfollow(2); // and an unfollow
      releaseGet();
      await hydrating;
      const ids = F.useFollowingStore.getState().following.map((f) => f.id).sort();
      expect(ids).toEqual([1, 3]); // 1 kept (clicked), 2 stays unfollowed, 3 comes from the server
    } finally {
      globalThis.fetch = realFetch;
      F.useFollowingStore.getState().reset();
    }
  });
});
