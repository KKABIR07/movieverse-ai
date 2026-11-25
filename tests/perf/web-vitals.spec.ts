/**
 * @perf Web-vitals budgets measured in a real browser (read-only → safe against production).
 * Meaningful only against a PRODUCTION build (`next build && next start`, or the live site):
 * `next dev` ships unminified, uncompressed JS and will blow every budget.
 *
 * Budgets (override with env):
 *   PERF_LCP_MS        2500   Largest Contentful Paint, desktop 1440×900, no throttling
 *   PERF_CLS           0.1    Cumulative Layout Shift (after scrolling one viewport)
 *   PERF_HOME_JS_KB    300    first-load JS on "/" in KB, compressed transfer size
 *
 * The Lighthouse runner (scripts/qa/lighthouse.mjs) uses this spec as its fallback.
 */
import { test, expect } from '@playwright/test';
import { requireTmdb, isPagesBRoute, PAGES_B_MERGED } from '../e2e/support/env';

const LCP_MS = Number(process.env.PERF_LCP_MS ?? 2500);
const CLS_MAX = Number(process.env.PERF_CLS ?? 0.1);
const HOME_JS_KB = Number(process.env.PERF_HOME_JS_KB ?? 300);

interface Vitals {
  lcp: number;
  cls: number;
  ttfb: number;
  jsTransferKB: number;
  jsDecodedKB: number;
  scripts: number;
  uncompressed: string[];
}

async function measure(page: import('@playwright/test').Page, path: string): Promise<Vitals> {
  await page.addInitScript(() => {
    const w = window as unknown as { __lcp: number; __cls: number };
    w.__lcp = 0;
    w.__cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) w.__lcp = Math.max(w.__lcp, e.startTime);
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
        if (!e.hadRecentInput) w.__cls += e.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto(path, { waitUntil: 'load' });
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
  // Scroll one viewport (lazy content / late fonts are where CLS usually hides), then settle.
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(1_500);
  return page.evaluate(() => {
    const w = window as unknown as { __lcp: number; __cls: number };
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const scripts = (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).filter(
      (r) => r.initiatorType === 'script' && new URL(r.name).origin === location.origin,
    );
    const sum = (k: 'transferSize' | 'encodedBodySize' | 'decodedBodySize') => scripts.reduce((a, r) => a + (r[k] || 0), 0);
    return {
      lcp: Math.round(w.__lcp),
      cls: +w.__cls.toFixed(4),
      ttfb: Math.round(nav ? nav.responseStart - nav.requestStart : 0),
      // encodedBodySize = bytes on the wire (compressed) excluding headers; survives cache hits better than transferSize
      jsTransferKB: Math.round(sum('encodedBodySize') / 1024),
      jsDecodedKB: Math.round(sum('decodedBodySize') / 1024),
      scripts: scripts.length,
      uncompressed: scripts
        .filter((r) => r.decodedBodySize > 20_000 && r.encodedBodySize >= r.decodedBodySize)
        .map((r) => new URL(r.name).pathname)
        .slice(0, 5),
    };
  });
}

test.describe('web vitals budgets @perf', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop budgets');

  for (const path of ['/', '/movie/550']) {
    test(`${path}: LCP < ${LCP_MS}ms, CLS < ${CLS_MAX} @perf${isPagesBRoute(path) ? ' @pagesB' : ''}`, async ({ page }, info) => {
      requireTmdb(); // both pages are TMDB-driven; numbers are meaningless on an error page
      if (isPagesBRoute(path) && !PAGES_B_MERGED()) {
        info.annotations.push({ type: 'pagesB', description: 'measuring the pre-redesign detail page' });
      }
      const res = await page.request.get(path);
      expect(res.status(), `${path} must render (200) before it can be measured`).toBe(200);
      const v = await measure(page, path);
      await info.attach(`vitals${path.replace(/\W+/g, '-')}.json`, { body: JSON.stringify(v, null, 2), contentType: 'application/json' });
      console.log(`[perf] ${path}`, JSON.stringify(v));
      expect.soft(v.lcp, 'LCP (ms)').toBeGreaterThan(0);
      expect.soft(v.lcp, 'LCP (ms)').toBeLessThan(LCP_MS);
      expect.soft(v.cls, 'CLS').toBeLessThan(CLS_MAX);
      if (path === '/') {
        expect.soft(v.uncompressed, 'large scripts served without compression').toEqual([]);
        expect(v.jsTransferKB, `first-load JS on / (KB compressed; decoded ${v.jsDecodedKB} KB in ${v.scripts} files)`).toBeLessThan(HOME_JS_KB);
      }
    });
  }
});
