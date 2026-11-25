/**
 * Playwright globalSetup: probe the target once, export capabilities to every worker via process.env
 * (see support/env.ts), and fail fast with a readable message when the server isn't running at all.
 * Read-only: GET /api/health, /api/ready, /api/tmdb/configuration — safe against production.
 */
import type { FullConfig } from '@playwright/test';

async function probe(url: string, timeoutMs = 20_000): Promise<{ status: number; body: unknown } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { 'user-agent': 'mkmovies-e2e-probe' } });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* not JSON */
    }
    return { status: res.status, body };
  } catch {
    return null;
  }
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  const base = String(config.projects[0]?.use?.baseURL ?? 'http://localhost:3000').replace(/\/+$/, '');

  const health = await probe(`${base}/api/health`, 30_000);
  if (!health || health.status !== 200) {
    throw new Error(
      `E2E target ${base} is not reachable (/api/health → ${health ? health.status : 'no response'}).\n` +
        '  Start it first:  npm run build && npm run start   (or set E2E_START_SERVER=1, or E2E_BASE_URL=<url>)',
    );
  }

  if (!process.env.E2E_DB) {
    const ready = await probe(`${base}/api/ready`);
    const db = (ready?.body as { db?: string } | null)?.db;
    process.env.E2E_DB = ready?.status === 200 && db === 'up' ? 'up' : 'down';
  }
  if (!process.env.E2E_TMDB) {
    const tmdb = await probe(`${base}/api/tmdb/configuration`);
    process.env.E2E_TMDB = tmdb?.status === 200 ? 'up' : 'down';
  }

  const pagesB = process.env.E2E_PAGES_B === '1' ? 'merged' : 'pending (fixme)';
  console.log(`[e2e] target ${base} · db=${process.env.E2E_DB} · tmdb=${process.env.E2E_TMDB} · pagesB=${pagesB}`);
  if (process.env.E2E_DB === 'down') console.log('[e2e] DB-backed tests will be SKIPPED (server reports db=down).');
  if (process.env.E2E_TMDB === 'down') console.log('[e2e] TMDB-backed tests will be SKIPPED (server cannot reach TMDB).');
}
