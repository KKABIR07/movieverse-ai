/**
 * Pure URL-param helpers shared by the browse pages (trending, top-rated, movies, tv, stars,
 * discover, search, genre). Server- and client-safe; no React.
 */

/** TMDB refuses page > 500. */
export const MAX_PAGE = 500;

/** Next 16 `searchParams` value shape. */
export type RawParams = Record<string, string | string[] | undefined>;

/** First value of a (possibly repeated) search param, trimmed; undefined when empty. */
export function first(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  const t = s?.trim();
  return t ? t : undefined;
}

/** `?page=` → integer clamped to 1..500 (garbage → 1). */
export function parsePage(v: string | string[] | undefined): number {
  const n = Number.parseInt(first(v) ?? '', 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(MAX_PAGE, n);
}

/** Return `v` when it is one of `allowed`, else `fallback`. */
export function pick<T extends string>(v: string | string[] | undefined, allowed: readonly T[], fallback: T): T {
  const s = first(v);
  return s && (allowed as readonly string[]).includes(s) ? (s as T) : fallback;
}

/** Comma-separated positive integer ids (deduplicated, max 10). */
export function parseIds(v: string | string[] | undefined): number[] {
  const s = first(v);
  if (!s) return [];
  const out: number[] = [];
  for (const part of s.split(',')) {
    const n = Number(part.trim());
    if (Number.isInteger(n) && n > 0 && n < 2_147_483_647 && !out.includes(n)) out.push(n);
    if (out.length >= 10) break;
  }
  return out;
}

/** Four-digit year in a sane range, else undefined. */
export function parseYear(v: string | string[] | undefined): number | undefined {
  const s = first(v);
  if (!s || !/^\d{4}$/.test(s)) return undefined;
  const n = Number(s);
  return n >= 1874 && n <= 2100 ? n : undefined;
}

/** Minimum rating 0..10 (one decimal), else undefined. */
export function parseRating(v: string | string[] | undefined): number | undefined {
  const s = first(v);
  if (!s) return undefined;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.min(10, Math.round(n * 10) / 10);
}

/**
 * Build `path?query` from a param object. Undefined / null / '' / default values are dropped so
 * URLs stay canonical; `page` 1 is always dropped.
 */
export function buildHref(
  path: string,
  params: Record<string, string | number | null | undefined>,
  defaults: Record<string, string | number> = {},
): string {
  const sp = new URLSearchParams();
  for (const [k, raw] of Object.entries(params)) {
    if (raw === undefined || raw === null || raw === '') continue;
    const v = String(raw);
    if (k === 'page' && v === '1') continue;
    if (k in defaults && String(defaults[k]) === v) continue;
    sp.set(k, v);
  }
  const qs = sp.toString();
  return qs ? `${path}?${qs}` : path;
}

/** Years from `now` back to `oldest` (inclusive), newest first. */
export function yearOptions(now: number = new Date().getUTCFullYear(), oldest = 1900): number[] {
  const out: number[] = [];
  for (let y = now + 1; y >= oldest; y--) out.push(y);
  return out;
}
