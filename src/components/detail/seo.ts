/**
 * SEO helpers shared by detail, user and content pages (server + client safe, no secrets).
 */

/** Canonical origin. Configure per environment with NEXT_PUBLIC_SITE_URL. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.mkmovies.site').replace(/\/+$/, '');
export const SITE_NAME = 'mkmovies';

/** `metadataBase` for page metadata (makes canonical / OG URLs absolute). */
export const metadataBase = (() => {
  try {
    return new URL(SITE_URL);
  } catch {
    return new URL('https://www.mkmovies.site');
  }
})();

export const absoluteUrl = (path: string) => `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;

/** Collapse whitespace and cut at a word boundary, ≤ `max` chars (default 155) with an ellipsis. */
export function clampDescription(text: string | null | undefined, max = 155): string {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const atWord = cut.slice(0, Math.max(cut.lastIndexOf(' '), Math.floor(max * 0.6)));
  return `${atWord.replace(/[\s,.;:–—-]+$/, '')}…`;
}

/** Parse a route id: positive int only (rejects "12abc", "-1", "1.5", "0"). */
export function parseId(raw: string | undefined): number | null {
  if (!raw || !/^[1-9]\d{0,9}$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n < 2_147_483_647 ? n : null;
}

/** Private / user pages. */
export const NOINDEX = { index: false, follow: false } as const;
