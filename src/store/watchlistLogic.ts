/**
 * Pure watchlist helpers (no React / zustand) so they can be unit-tested in node.
 *
 * TMDB movie ids and TV ids are separate sequences and DO collide
 * (movie 1399 ≠ tv 1399), so every item is identified by `${media_type}:${id}`.
 */
import type { WatchlistItem } from '../types/tmdb';

export type MediaType = 'movie' | 'tv';

export interface WatchlistList {
  id: string;
  name: string;
  items: WatchlistItem[];
  createdAt: string;
}

export interface WatchlistPersisted {
  lists: WatchlistList[];
  activeListId: string;
}

export const DEFAULT_LIST_ID = 'default';
export const WATCHLIST_VERSION = 4;

export function watchKey(id: number, mediaType: MediaType): string {
  return `${mediaType}:${id}`;
}

export function itemKey(item: Pick<WatchlistItem, 'id' | 'media_type'>): string {
  return watchKey(item.id, item.media_type ?? 'movie');
}

/**
 * Does `item` match (id, mediaType)?
 * - With a mediaType: exact keyed match.
 * - Without one (legacy 1-arg callers): matches items whose media_type is
 *   'movie' or missing, i.e. legacy calls are treated as movie lookups.
 */
export function matchesItem(
  item: Pick<WatchlistItem, 'id' | 'media_type'>,
  id: number,
  mediaType?: MediaType,
): boolean {
  if (item.id !== id) return false;
  if (mediaType) return (item.media_type ?? 'movie') === mediaType;
  return item.media_type === 'movie' || item.media_type == null;
}

export function hasItem(items: readonly WatchlistItem[], id: number, mediaType?: MediaType): boolean {
  return items.some((i) => matchesItem(i, id, mediaType));
}

export function addItem(
  items: readonly WatchlistItem[],
  item: Omit<WatchlistItem, 'addedAt'>,
  now: string = new Date().toISOString(),
): WatchlistItem[] {
  const normalized = { ...item, media_type: item.media_type ?? 'movie' } as WatchlistItem;
  if (items.some((i) => itemKey(i) === itemKey(normalized))) return items as WatchlistItem[];
  return [{ ...normalized, addedAt: now }, ...items];
}

export function removeItem(items: readonly WatchlistItem[], id: number, mediaType?: MediaType): WatchlistItem[] {
  return items.filter((i) => !matchesItem(i, id, mediaType));
}

export function defaultList(items: WatchlistItem[] = [], now: string = new Date().toISOString()): WatchlistList {
  return { id: DEFAULT_LIST_ID, name: 'My Watchlist', items, createdAt: now };
}

/** Normalise one list: fill missing media_type with 'movie', drop malformed + duplicate keys. */
function normalizeItems(items: unknown): WatchlistItem[] {
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  const out: WatchlistItem[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Partial<WatchlistItem>;
    if (typeof r.id !== 'number') continue;
    const media_type: MediaType = r.media_type === 'tv' ? 'tv' : 'movie';
    const item = { ...r, media_type } as WatchlistItem;
    const key = itemKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/**
 * zustand `persist.migrate` for the watchlist.
 * v0/v1: `{ items: WatchlistItem[] }` (single flat list)
 * v2:    `{ lists, activeListId }` keyed by bare id
 * v3:    same shape, every item has media_type, deduped by `${type}:${id}`
 * v4:    every list folded into the default list (the server watchlist is a single list)
 */
export function migrateWatchlist(persisted: unknown, version: number): WatchlistPersisted {
  const p = (persisted ?? {}) as { items?: unknown; lists?: unknown; activeListId?: unknown };
  let lists: WatchlistList[];

  if (version < 2 || !Array.isArray(p.lists)) {
    lists = [defaultList(normalizeItems(p.items))];
  } else {
    lists = (p.lists as Partial<WatchlistList>[])
      .filter((l) => l && typeof l.id === 'string')
      .map((l) => ({
        id: l.id as string,
        name: typeof l.name === 'string' && l.name ? l.name : 'My Watchlist',
        createdAt: typeof l.createdAt === 'string' ? l.createdAt : new Date().toISOString(),
        items: normalizeItems(l.items),
      }));
    if (!lists.length) lists = [defaultList()];
  }

  if (version < 4) {
    // v4: one list. The server watchlist is a single list, so custom local lists are folded
    // into the default one (deduped, newest first) instead of silently becoming unsyncable.
    return { lists: [flattenLists(lists)], activeListId: DEFAULT_LIST_ID };
  }

  const activeListId =
    typeof p.activeListId === 'string' && lists.some((l) => l.id === p.activeListId)
      ? (p.activeListId as string)
      : lists[0].id;

  return { lists, activeListId };
}

/** Merge every list into the default one: unique by key, newest addedAt first. */
export function flattenLists(lists: readonly WatchlistList[]): WatchlistList {
  const base = lists.find((l) => l.id === DEFAULT_LIST_ID);
  const byKey = new Map<string, WatchlistItem>();
  for (const l of lists) {
    for (const i of l.items) {
      const k = itemKey(i);
      const prev = byKey.get(k);
      if (!prev || (Date.parse(i.addedAt) || 0) > (Date.parse(prev.addedAt) || 0)) byKey.set(k, i);
    }
  }
  const items = [...byKey.values()]
    .map((it, idx) => ({ it, idx }))
    .sort((a, b) => (Date.parse(b.it.addedAt) || 0) - (Date.parse(a.it.addedAt) || 0) || a.idx - b.idx)
    .map((x) => x.it);
  return {
    id: DEFAULT_LIST_ID,
    name: base?.name || 'My Watchlist',
    createdAt: base?.createdAt ?? lists[0]?.createdAt ?? new Date().toISOString(),
    items,
  };
}

/** Total items across every list (unique by key). */
export function countUnique(lists: readonly WatchlistList[]): number {
  const keys = new Set<string>();
  for (const l of lists) for (const i of l.items) keys.add(itemKey(i));
  return keys.size;
}
