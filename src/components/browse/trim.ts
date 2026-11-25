/**
 * Shrink TMDB payloads before they cross the server → client boundary (RSC payload size).
 * Pure; safe on server and client.
 */
import { toMediaSummary, type MediaInput, type MediaSummary, type MediaType } from '@/components/media/types';
import type { PersonLike } from '@/components/media/PersonCard';

/** Normalise and drop people / entries without an id. */
export function toSummaries(items: readonly unknown[] | undefined, mediaType?: MediaType): MediaSummary[] {
  const out: MediaSummary[] = [];
  for (const raw of items ?? []) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as { id?: unknown; media_type?: unknown };
    if (typeof r.id !== 'number') continue;
    if (r.media_type === 'person') continue;
    if (!mediaType && r.media_type !== undefined && r.media_type !== 'movie' && r.media_type !== 'tv') continue;
    const s = toMediaSummary(raw as MediaInput, mediaType);
    out.push({ ...s, overview: '' }); // cards never show the overview
  }
  return out;
}

/** Keep only the fields PersonCard reads. */
export function toPeople(items: readonly { id: number; name: string; profile_path: string | null; known_for_department?: string; media_type?: string }[] | undefined): PersonLike[] {
  return (items ?? [])
    .filter((p) => typeof p.id === 'number' && (p.media_type === undefined || p.media_type === 'person'))
    .map((p) => ({
      id: p.id,
      name: p.name,
      profile_path: p.profile_path ?? null,
      known_for_department: p.known_for_department,
    }));
}
