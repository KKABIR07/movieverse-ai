/**
 * Allowlist for the public TMDB proxy (GET /api/tmdb/[...path]). Pure module → unit-tested.
 *
 * Only these path shapes are forwarded; everything else is a 404. Query params are filtered to a
 * known set with per-key value validation; unknown keys are dropped, invalid values → 400.
 */

export type CacheClass = 'list' | 'detail' | 'static';

/** Seconds — trending/lists/search/discover 1h, details/credits/person 24h, genres/config/providers 7d. */
export const REVALIDATE: Record<CacheClass, number> = {
  list: 60 * 60,
  detail: 60 * 60 * 24,
  static: 60 * 60 * 24 * 7,
};

const ID = '[1-9]\\d{0,9}';
const MOVIE_SUB = 'videos|credits|similar|recommendations|watch/providers|images|keywords|release_dates|external_ids';
const TV_SUB = 'videos|credits|aggregate_credits|similar|recommendations|watch/providers|images|keywords|content_ratings|external_ids';
const PERSON_SUB = 'combined_credits|movie_credits|tv_credits|images|external_ids';

interface Route {
  re: RegExp;
  cls: CacheClass;
  /** which append_to_response values are allowed for this route (detail endpoints only) */
  append?: ReadonlySet<string>;
}

const set = (s: string) => new Set(s.split('|'));

const ROUTES: Route[] = [
  { re: /^trending\/(all|movie|tv|person)\/(day|week)$/, cls: 'list' },
  { re: /^movie\/(popular|top_rated|now_playing|upcoming)$/, cls: 'list' },
  { re: /^tv\/(popular|top_rated|airing_today|on_the_air)$/, cls: 'list' },
  { re: /^person\/popular$/, cls: 'list' },
  { re: /^search\/(multi|movie|tv|person)$/, cls: 'list' },
  { re: /^discover\/(movie|tv)$/, cls: 'list' },
  { re: new RegExp(`^movie\\/${ID}$`), cls: 'detail', append: set(MOVIE_SUB) },
  { re: new RegExp(`^movie\\/${ID}\\/(${MOVIE_SUB})$`), cls: 'detail' },
  { re: new RegExp(`^tv\\/${ID}$`), cls: 'detail', append: set(TV_SUB) },
  { re: new RegExp(`^tv\\/${ID}\\/(${TV_SUB})$`), cls: 'detail' },
  { re: new RegExp(`^tv\\/${ID}\\/season\\/\\d{1,3}$`), cls: 'detail', append: set('videos|credits|images') },
  { re: new RegExp(`^person\\/${ID}$`), cls: 'detail', append: set(PERSON_SUB) },
  { re: new RegExp(`^person\\/${ID}\\/(${PERSON_SUB})$`), cls: 'detail' },
  { re: /^genre\/(movie|tv)\/list$/, cls: 'static' },
  { re: /^watch\/providers\/(movie|tv|regions)$/, cls: 'static' },
  { re: /^configuration$/, cls: 'static' },
];

export interface MatchedPath {
  path: string;
  cls: CacheClass;
  revalidate: number;
  append?: ReadonlySet<string>;
}

/** Normalise + match a proxy path ("movie/550"). Returns null when not allowed. */
export function matchTmdbPath(raw: string | string[]): MatchedPath | null {
  const path = (Array.isArray(raw) ? raw.join('/') : raw).replace(/^\/+|\/+$/g, '');
  if (!path || path.length > 120 || /[^a-z0-9_/]/.test(path)) return null;
  for (const r of ROUTES) {
    if (r.re.test(path)) return { path, cls: r.cls, revalidate: REVALIDATE[r.cls], append: r.append };
  }
  return null;
}

// ─── Query params ──────────────────────────────────────────────────────────────

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const NUM = /^\d{1,4}(\.\d{1,2})?$/;
const INT = /^\d{1,6}$/;
const YEAR = /^(18|19|20|21)\d{2}$/;
const ID_LIST = /^\d{1,10}([,|]\d{1,10}){0,30}$/;

const PARAM_RULES: Record<string, (v: string) => boolean> = {
  page: (v) => INT.test(v), // clamped separately
  language: (v) => /^[a-z]{2}(-[A-Z]{2})?$/.test(v),
  region: (v) => /^[A-Z]{2}$/.test(v),
  watch_region: (v) => /^[A-Z]{2}$/.test(v),
  query: (v) => v.length >= 1 && v.length <= 100,
  include_adult: () => true, // forced to false below
  sort_by: (v) => /^[a-z_.]{3,40}\.(asc|desc)$/.test(v),
  with_genres: (v) => ID_LIST.test(v),
  without_genres: (v) => ID_LIST.test(v),
  with_keywords: (v) => ID_LIST.test(v),
  with_people: (v) => ID_LIST.test(v),
  with_cast: (v) => ID_LIST.test(v),
  with_crew: (v) => ID_LIST.test(v),
  with_companies: (v) => ID_LIST.test(v),
  with_watch_providers: (v) => ID_LIST.test(v),
  with_original_language: (v) => /^[a-z]{2}(\|[a-z]{2}){0,10}$/.test(v),
  'primary_release_date.gte': (v) => DATE.test(v),
  'primary_release_date.lte': (v) => DATE.test(v),
  'release_date.gte': (v) => DATE.test(v),
  'release_date.lte': (v) => DATE.test(v),
  'first_air_date.gte': (v) => DATE.test(v),
  'first_air_date.lte': (v) => DATE.test(v),
  'air_date.gte': (v) => DATE.test(v),
  'air_date.lte': (v) => DATE.test(v),
  primary_release_year: (v) => YEAR.test(v),
  first_air_date_year: (v) => YEAR.test(v),
  year: (v) => YEAR.test(v),
  'vote_average.gte': (v) => NUM.test(v) && Number(v) <= 10,
  'vote_average.lte': (v) => NUM.test(v) && Number(v) <= 10,
  'vote_count.gte': (v) => INT.test(v),
  'with_runtime.gte': (v) => INT.test(v),
  'with_runtime.lte': (v) => INT.test(v),
  append_to_response: (v) => /^[a-z_/]+(,[a-z_/]+){0,10}$/.test(v),
  include_image_language: (v) => /^[a-z]{2}(,[a-z]{2}|,null){0,5}$/.test(v),
};

export class TmdbParamError extends Error {
  constructor(readonly param: string) {
    super(`Invalid value for "${param}"`);
    this.name = 'TmdbParamError';
  }
}

/**
 * Filter + validate query params for a matched path. Unknown keys are dropped; invalid values throw
 * TmdbParamError. `page` is clamped to 1..500; include_adult is always false; output keys are sorted
 * (stable cache keys).
 */
export function sanitizeTmdbParams(input: URLSearchParams, matched: MatchedPath): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, rawVal] of input) {
    if (key in out) continue; // first value wins
    const rule = PARAM_RULES[key];
    if (!rule) continue;
    const v = rawVal.trim();
    if (!v || v.length > 200 || !rule(v)) throw new TmdbParamError(key);
    if (key === 'append_to_response') {
      if (!matched.append) continue; // only detail endpoints may append
      const parts = v.split(',').filter((p) => matched.append!.has(p));
      if (parts.length) out[key] = parts.join(',');
      continue;
    }
    out[key] = v;
  }
  if (out.page !== undefined) out.page = String(Math.min(500, Math.max(1, Number(out.page) || 1)));
  if (matched.path.startsWith('search/') || matched.path.startsWith('discover/')) out.include_adult = 'false';
  else delete out.include_adult;
  if (matched.path.startsWith('search/') && !out.query) throw new TmdbParamError('query');
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

/** Cache-Control for proxy responses of a given class. */
export function cacheControlFor(cls: CacheClass): string {
  const s = REVALIDATE[cls];
  return `public, max-age=${Math.min(s, 300)}, s-maxage=${s}, stale-while-revalidate=${s}`;
}
