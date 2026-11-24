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

  it('persists with version 3', () => {
    S.useWatchlistStore.getState().add(item(1, 'movie'));
    const raw = JSON.parse(storage.getItem('mkmovies-watchlist') ?? '{}');
    expect(raw.version).toBe(3);
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
