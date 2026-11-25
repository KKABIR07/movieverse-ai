import type { Video } from '../../types/tmdb';
import type { VideoRef } from './Videos';

const TYPE_RANK: Record<string, number> = { Trailer: 0, Teaser: 1, Clip: 2, Featurette: 3, 'Behind the Scenes': 4 };

/** YouTube videos only, trailers first, official first, newest first. Deduped by key. */
export function pickVideos(videos: Video[] | undefined, limit = 12): VideoRef[] {
  const seen = new Set<string>();
  return (videos ?? [])
    .filter((v) => v.site === 'YouTube' && /^[A-Za-z0-9_-]{6,20}$/.test(v.key))
    .sort(
      (a, b) =>
        (TYPE_RANK[a.type] ?? 9) - (TYPE_RANK[b.type] ?? 9) ||
        Number(b.official) - Number(a.official) ||
        (Date.parse(b.published_at) || 0) - (Date.parse(a.published_at) || 0),
    )
    .filter((v) => (seen.has(v.key) ? false : (seen.add(v.key), true)))
    .slice(0, limit)
    .map((v) => ({ key: v.key, name: v.name, type: v.type, published_at: v.published_at }));
}

/** Best trailer (falls back to a teaser), or null. */
export function pickTrailer(videos: Video[] | undefined): VideoRef | null {
  const list = pickVideos(videos, 50);
  return list.find((v) => v.type === 'Trailer') ?? list.find((v) => v.type === 'Teaser') ?? null;
}
