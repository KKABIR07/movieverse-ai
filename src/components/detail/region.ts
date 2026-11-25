/**
 * Watch-provider region for the current request (pure; pass a header getter).
 * Order: CDN geo headers → first Accept-Language tag with a region → 'US'.
 */
const GEO_HEADERS = ['x-vercel-ip-country', 'cf-ipcountry', 'cloudfront-viewer-country', 'x-country-code', 'x-geo-country'];
/** Placeholder codes some CDNs send (unknown / Tor). */
const INVALID = new Set(['XX', 'T1', 'A1', 'A2', 'O1', 'EU', 'AP']);

const valid = (code: string | null | undefined): string | null => {
  const c = (code ?? '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) && !INVALID.has(c) ? c : null;
};

export function regionFromHeaders(get: (name: string) => string | null | undefined, fallback = 'US'): string {
  for (const h of GEO_HEADERS) {
    const r = valid(get(h));
    if (r) return r;
  }
  const al = get('accept-language') ?? '';
  for (const part of al.split(',').slice(0, 8)) {
    const tag = part.split(';')[0].trim();
    // en-GB, pt-BR, zh-Hant-TW → last 2-letter subtag after the language
    const subtags = tag.split('-').slice(1);
    for (let i = subtags.length - 1; i >= 0; i--) {
      const r = valid(subtags[i].length === 2 ? subtags[i] : null);
      if (r) return r;
    }
  }
  return fallback;
}

/** "GB" → "United Kingdom" (falls back to the code). */
export function regionName(code: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}
