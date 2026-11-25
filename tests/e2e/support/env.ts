/**
 * Capability gates for the Playwright suites.
 *
 * tests/e2e/global-setup.ts probes the TARGET server once per run and exports the result through
 * process.env (Playwright passes globalSetup's env changes on to every worker):
 *
 *   E2E_DB    up | down | unknown   ← GET /api/ready  (the server's own DATABASE_URL / Postgres)
 *   E2E_TMDB  up | down | unknown   ← GET /api/tmdb/configuration via the server's TMDB proxy
 *
 * Tests that need a capability call `requireDb()` / `requireTmdb()` at the top, which SKIPS them with
 * an explicit reason instead of letting them fail for an environmental reason (no Postgres running,
 * or the local ISP's DNS sinkholing api.themoviedb.org — see CLAUDE_REFERENCE/testing.md).
 * Set E2E_REQUIRE_ALL=1 (CI / pre-deploy) to turn those skips into hard failures.
 *
 * Pages B gate: person, shorts, feed, following, watchlist(+share), profile, about, blog, sitemap and
 * the movie/tv detail pages are being redesigned on a separate branch. Tests that depend on THEIR
 * markup (buttons, sections) call `requirePagesB()`; they are reported as "fixme" (not silently
 * passing on the old markup) until E2E_PAGES_B=1 is set after that branch is merged.
 */
import { test } from '@playwright/test';

type Cap = 'up' | 'down' | 'unknown';
const cap = (name: string): Cap => {
  const v = process.env[name];
  return v === 'up' || v === 'down' ? v : 'unknown';
};

export const DB_STATE = (): Cap => cap('E2E_DB');
export const TMDB_STATE = (): Cap => cap('E2E_TMDB');
export const PAGES_B_MERGED = (): boolean => process.env.E2E_PAGES_B !== '0';
const REQUIRE_ALL = (): boolean => process.env.E2E_REQUIRE_ALL === '1';

export const DB_SKIP_REASON =
  'needs a database: the server under test reports db=down on /api/ready. Start Postgres and point the ' +
  "server's DATABASE_URL at it (e.g. `docker run -p 5434:5432 postgres:17-alpine`), then re-run.";
export const TMDB_SKIP_REASON =
  'needs TMDB: the server cannot reach api.themoviedb.org (/api/tmdb/configuration failed). On this PC the ' +
  'ISP sinkholes the hostname — start the server with NODE_OPTIONS=--require=<dev-dns.cjs>, or check TMDB_BEARER.';
export const PAGES_B_REASON =
  'Pages B redesign (person/shorts/feed/following/watchlist/profile/about/blog/sitemap/movie+tv detail) not merged ' +
  'yet — this test targets the NEW markup. Set E2E_PAGES_B=1 once it is merged.';

function gate(ok: boolean, reason: string): void {
  if (ok) return;
  if (REQUIRE_ALL()) throw new Error(`E2E_REQUIRE_ALL=1 but this test ${reason}`);
  test.skip(true, reason);
}

/** Skip (with a clear reason) unless the server's Postgres is reachable. */
export function requireDb(): void {
  gate(DB_STATE() !== 'down', DB_SKIP_REASON);
}

/** Skip (with a clear reason) unless the server can reach TMDB. */
export function requireTmdb(): void {
  gate(TMDB_STATE() !== 'down', TMDB_SKIP_REASON);
}

/** Mark a test that depends on Pages B markup as fixme until E2E_PAGES_B=1. */
export function requirePagesB(): void {
  test.fixme(!PAGES_B_MERGED(), PAGES_B_REASON);
}

/** Route prefixes owned by the Pages B branch (crawl annotates these). */
export const PAGES_B_PREFIXES = [
  '/person/',
  '/shorts',
  '/feed',
  '/following',
  '/watchlist',
  '/profile',
  '/about',
  '/blog',
  '/sitemap',
  '/movie/',
  '/tv/',
] as const;

export function isPagesBRoute(path: string): boolean {
  return PAGES_B_PREFIXES.some((p) => path === p || path.startsWith(p));
}
