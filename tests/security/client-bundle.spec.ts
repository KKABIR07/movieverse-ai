/**
 * @smoke live client-bundle secret scan — read-only, safe against production.
 * Loads a few pages in a real browser, collects every same-origin script/stylesheet/JSON the page
 * downloaded plus the HTML itself, and scans them with the same patterns as scripts/qa/scan-bundle.mjs.
 */
import { test, expect } from '@playwright/test';
import { findSecrets } from '../../scripts/qa/secret-patterns.mjs';

type Hit = { id: string; why: string; sample: string; severity: 'error' | 'warn' };

test('no secrets in HTML or same-origin JS/CSS served to browsers @smoke', async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const bodies = new Map<string, Promise<string>>();
  page.on('response', (res) => {
    const url = res.url();
    if (!url.startsWith(origin) || bodies.has(url)) return;
    const type = res.request().resourceType();
    if (!['document', 'script', 'stylesheet', 'fetch', 'xhr'].includes(type)) return;
    bodies.set(url, res.text().catch(() => ''));
  });

  for (const path of ['/', '/search', '/discover', '/movie/550', '/watchlist']) {
    await page.goto(path, { waitUntil: 'load' });
    await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined);
  }

  const findings: (Hit & { url: string })[] = [];
  for (const [url, p] of bodies) {
    for (const hit of findSecrets(await p) as Hit[]) {
      // An env var NAME in an HTML/JSON body (e.g. a 503 "TMDB_BEARER missing") is not a leak of its value; only flag it in code.
      if (hit.id === 'server-secret-name' && !/\.(js|mjs)(\?|$)/.test(url)) continue;
      if (hit.severity === 'warn') {
        test.info().annotations.push({ type: 'warning', description: `[${hit.id}] ${hit.why} in ${url}: ${hit.sample}` });
        continue;
      }
      findings.push({ url, ...hit });
    }
  }
  expect(bodies.size, 'scanned resources').toBeGreaterThan(3);
  expect(findings, findings.map((f) => `[${f.id}] ${f.why} in ${f.url}: ${f.sample}`).join('\n')).toEqual([]);
});
