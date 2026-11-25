/**
 * Server watchlist API (`/api/watchlist`) mapped to the client `WatchlistItem` shape.
 */
import type { WatchlistItem } from '../../types/tmdb';
import { apiJson, type FetchLike } from './http';

/** Item as the server returns it. */
export interface ServerWatchlistItem {
  id: number;
  media_type: 'movie' | 'tv';
  title?: string | null;
  name?: string | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number | null;
  release_date?: string | null;
  first_air_date?: string | null;
  addedAt?: string | null;
}

export function fromServerItem(s: ServerWatchlistItem): WatchlistItem | null {
  if (!s || typeof s.id !== 'number' || !Number.isInteger(s.id) || s.id <= 0) return null;
  const media_type = s.media_type === 'tv' ? 'tv' : 'movie';
  return {
    id: s.id,
    media_type,
    title: (media_type === 'tv' ? (s.name ?? s.title) : (s.title ?? s.name)) || 'Untitled',
    poster_path: s.poster_path ?? null,
    release_date: (media_type === 'tv' ? (s.first_air_date ?? s.release_date) : (s.release_date ?? s.first_air_date)) ?? '',
    vote_average: typeof s.vote_average === 'number' ? s.vote_average : 0,
    addedAt: s.addedAt ?? new Date().toISOString(),
  };
}

export function toServerBody(item: Omit<WatchlistItem, 'addedAt'> & { addedAt?: string }): Record<string, unknown> {
  const body: Record<string, unknown> = {
    id: item.id,
    media_type: item.media_type,
    poster_path: item.poster_path ?? undefined,
    vote_average: Number.isFinite(item.vote_average) ? item.vote_average : undefined,
    addedAt: item.addedAt,
  };
  if (item.media_type === 'tv') {
    body.name = item.title;
    if (item.release_date) body.first_air_date = item.release_date;
  } else {
    body.title = item.title;
    if (item.release_date) body.release_date = item.release_date;
  }
  return body;
}

const mapItems = (items: ServerWatchlistItem[] | undefined): WatchlistItem[] =>
  (items ?? []).map(fromServerItem).filter((i): i is WatchlistItem => i !== null);

export interface WatchlistApi {
  list(): Promise<WatchlistItem[]>;
  add(item: WatchlistItem): Promise<WatchlistItem[]>;
  remove(id: number, mediaType: 'movie' | 'tv'): Promise<WatchlistItem[]>;
}

export function createWatchlistApi(fetchImpl?: FetchLike): WatchlistApi {
  return {
    async list() {
      const r = await apiJson<{ items?: ServerWatchlistItem[] }>('/api/watchlist', {}, fetchImpl);
      return mapItems(r.items);
    },
    async add(item) {
      const r = await apiJson<{ items?: ServerWatchlistItem[] }>(
        '/api/watchlist',
        { method: 'POST', body: toServerBody(item) },
        fetchImpl,
      );
      return mapItems(r.items);
    },
    async remove(id, media_type) {
      const r = await apiJson<{ items?: ServerWatchlistItem[] }>(
        '/api/watchlist',
        { method: 'DELETE', body: { id, media_type } },
        fetchImpl,
      );
      return mapItems(r.items);
    },
  };
}
