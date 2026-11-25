/**
 * Watchlist share links: `/watchlist/share?d=<payload>`.
 *
 * Payload = base64url(UTF-8 JSON). TextEncoder/TextDecoder make it unicode-safe
 * (btoa alone throws on titles like "Amélie" or "千と千尋の神隠し"). Decoding is
 * strict: anything that fails the zod schema is rejected as a whole.
 */
import { z } from 'zod';
import type { WatchlistItem } from '../../types/tmdb';

export const SHARE_MAX_ITEMS = 100;
/** Hard cap on the encoded string we will even try to parse (≈ 100 items). */
export const SHARE_MAX_ENCODED = 24_000;

/** Compact tuple per item: [type, id, title, poster, date, rating] */
const tuple = z.tuple([
  z.enum(['m', 't']),
  z.number().int().positive().max(2_147_483_647),
  z.string().trim().min(1).max(300),
  z
    .string()
    .regex(/^\/[A-Za-z0-9_\-]+\.(jpg|jpeg|png|webp)$/)
    .nullable(),
  z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/)
    .nullable(),
  z.number().min(0).max(10).nullable(),
]);

const payloadSchema = z.object({
  v: z.literal(1),
  n: z.string().trim().max(80).optional(),
  i: z.array(tuple).max(SHARE_MAX_ITEMS),
});

export interface SharedList {
  name?: string;
  items: Omit<WatchlistItem, 'addedAt'>[];
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Encode up to SHARE_MAX_ITEMS items. Throws only on a broken runtime (caller should try/catch). */
export function encodeShare(items: readonly Omit<WatchlistItem, 'addedAt'>[], name?: string): { code: string; truncated: boolean } {
  const list = items.slice(0, SHARE_MAX_ITEMS);
  const payload = {
    v: 1 as const,
    ...(name?.trim() ? { n: name.trim().slice(0, 80) } : {}),
    i: list.map((it) => [
      it.media_type === 'tv' ? 't' : 'm',
      it.id,
      (it.title || 'Untitled').slice(0, 300),
      it.poster_path && /^\/[A-Za-z0-9_\-]+\.(jpg|jpeg|png|webp)$/.test(it.poster_path) ? it.poster_path : null,
      it.release_date && /^\d{4}-\d{2}-\d{2}$/.test(it.release_date) ? it.release_date : null,
      Number.isFinite(it.vote_average) ? Math.round(Math.min(10, Math.max(0, it.vote_average)) * 10) / 10 : null,
    ]),
  };
  const code = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  return { code, truncated: items.length > list.length };
}

/** Decode + validate. Returns null for anything malformed (never throws). */
export function decodeShare(code: string | null | undefined): SharedList | null {
  if (!code || typeof code !== 'string' || code.length > SHARE_MAX_ENCODED) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(code)) return null;
  try {
    const json = new TextDecoder('utf-8', { fatal: true }).decode(base64UrlToBytes(code));
    const parsed = payloadSchema.safeParse(JSON.parse(json));
    if (!parsed.success) return null;
    const seen = new Set<string>();
    const items: SharedList['items'] = [];
    for (const [t, id, title, poster, date, rating] of parsed.data.i) {
      const media_type = t === 't' ? 'tv' : 'movie';
      const k = `${media_type}:${id}`;
      if (seen.has(k)) continue;
      seen.add(k);
      items.push({ id, media_type, title, poster_path: poster, release_date: date ?? '', vote_average: rating ?? 0 });
    }
    return { name: parsed.data.n || undefined, items };
  } catch {
    return null;
  }
}
