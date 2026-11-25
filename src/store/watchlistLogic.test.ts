import { describe, expect, it } from 'vitest';
import {
  addItem,
  countUnique,
  hasItem,
  itemKey,
  matchesItem,
  migrateWatchlist,
  removeItem,
  watchKey,
  WATCHLIST_VERSION,
} from './watchlistLogic';
import type { WatchlistItem } from '../types/tmdb';

const movie = (id: number, extra: Partial<WatchlistItem> = {}): WatchlistItem => ({
  id,
  title: `Movie ${id}`,
  poster_path: null,
  release_date: '2020-01-01',
  vote_average: 7,
  media_type: 'movie',
  addedAt: '2024-01-01T00:00:00.000Z',
  ...extra,
});
const show = (id: number) => movie(id, { media_type: 'tv', title: `Show ${id}` });

describe('keys', () => {
  it('keys by media type and id', () => {
    expect(watchKey(1399, 'tv')).toBe('tv:1399');
    expect(itemKey(movie(1399))).toBe('movie:1399');
    expect(itemKey({ id: 5, media_type: undefined as unknown as 'movie' })).toBe('movie:5');
  });
});

describe('matchesItem / hasItem', () => {
  const items = [movie(550), show(1399)];

  it('matches exactly when a media type is given', () => {
    expect(hasItem(items, 550, 'movie')).toBe(true);
    expect(hasItem(items, 550, 'tv')).toBe(false);
    expect(hasItem(items, 1399, 'tv')).toBe(true);
    expect(hasItem(items, 1399, 'movie')).toBe(false);
  });

  it('legacy 1-arg lookups match movie or missing media_type only', () => {
    expect(hasItem(items, 550)).toBe(true);
    expect(hasItem(items, 1399)).toBe(false);
    const legacy = { ...movie(7), media_type: undefined } as unknown as WatchlistItem;
    expect(matchesItem(legacy, 7)).toBe(true);
  });
});

describe('addItem / removeItem', () => {
  it('adds newest first and refuses duplicates by key', () => {
    let list: WatchlistItem[] = [];
    list = addItem(list, movie(1), 'T1');
    list = addItem(list, show(1), 'T2'); // same id, different type: allowed
    list = addItem(list, movie(1), 'T3'); // duplicate: ignored
    expect(list.map(itemKey)).toEqual(['tv:1', 'movie:1']);
    expect(list[0].addedAt).toBe('T2');
  });

  it('fills a missing media_type with movie', () => {
    const list = addItem([], { ...movie(9), media_type: undefined as unknown as 'movie' });
    expect(list[0].media_type).toBe('movie');
  });

  it('removes only the keyed item', () => {
    const list = [movie(1), show(1)];
    expect(removeItem(list, 1, 'tv').map(itemKey)).toEqual(['movie:1']);
    expect(removeItem(list, 1, 'movie').map(itemKey)).toEqual(['tv:1']);
    // legacy 1-arg removes the movie, never the show
    expect(removeItem(list, 1).map(itemKey)).toEqual(['tv:1']);
  });
});

describe('migrateWatchlist', () => {
  it('migrates v0/v1 flat items into the default list', () => {
    const out = migrateWatchlist({ items: [movie(1), { ...show(2) }] }, 1);
    expect(out.activeListId).toBe('default');
    expect(out.lists).toHaveLength(1);
    expect(out.lists[0].items.map(itemKey)).toEqual(['movie:1', 'tv:2']);
  });

  it('migrates v2 lists: fills media_type, dedupes, drops junk', () => {
    const v2 = {
      lists: [
        {
          id: 'default',
          name: 'Mine',
          createdAt: 'X',
          items: [
            { ...movie(1), media_type: undefined },
            movie(1), // duplicate of the above once normalised
            show(1),
            null,
            { title: 'no id' },
          ],
        },
        { id: 'list_2', name: '', items: 'not-an-array' },
      ],
      activeListId: 'list_2',
    };
    const out = migrateWatchlist(v2, 2);
    expect(out.lists).toHaveLength(1);
    expect(out.lists[0]).toMatchObject({ id: 'default', name: 'Mine' });
    expect(out.lists[0].items.map(itemKey)).toEqual(['movie:1', 'tv:1']);
    expect(out.activeListId).toBe('default');
  });

  it('v4 folds custom lists into the default list, deduped, newest first', () => {
    const v3 = {
      lists: [
        { id: 'default', name: 'Mine', createdAt: 'X', items: [{ ...movie(1), addedAt: '2024-01-01T00:00:00Z' }] },
        {
          id: 'list_2',
          name: 'Weekend',
          createdAt: 'Y',
          items: [
            { ...show(2), addedAt: '2024-03-01T00:00:00Z' },
            { ...movie(1), addedAt: '2024-02-01T00:00:00Z' },
          ],
        },
      ],
      activeListId: 'list_2',
    };
    const out = migrateWatchlist(v3, 3);
    expect(out.activeListId).toBe('default');
    expect(out.lists).toHaveLength(1);
    expect(out.lists[0].items.map(itemKey)).toEqual(['tv:2', 'movie:1']);
    expect(out.lists[0].items[1].addedAt).toBe('2024-02-01T00:00:00Z');
  });

  it('keeps v4 state as is and repairs a dangling activeListId / empty state', () => {
    expect(migrateWatchlist({ lists: [], activeListId: 'gone' }, 4).activeListId).toBe('default');
    expect(migrateWatchlist(undefined, 0).lists[0].items).toEqual([]);
    expect(migrateWatchlist({ lists: [{ id: 'a', items: [] }], activeListId: 'gone' }, 4).activeListId).toBe('a');
  });

  it('is at version 4', () => {
    expect(WATCHLIST_VERSION).toBe(4);
  });
});

describe('countUnique', () => {
  it('counts unique keys across lists', () => {
    expect(
      countUnique([
        { id: 'a', name: 'a', createdAt: '', items: [movie(1), show(1)] },
        { id: 'b', name: 'b', createdAt: '', items: [movie(1), movie(2)] },
      ]),
    ).toBe(3);
  });
});
