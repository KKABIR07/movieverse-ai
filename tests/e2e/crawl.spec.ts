/**
 * @smoke route crawl — read-only, safe against production. Runs on BOTH projects
 * (desktop 1440×900 and mobile 360×780).
 *
 * Hard contract for every route (any markup, old or new):
 *   - HTTP 200 (404 for the not-found probes), no same-origin 5xx / failed requests during load
 *   - 0 console errors / uncaught page errors (tiny allowlist in support/fixtures.ts)
 *   - a non-empty <title> and at least one <h1>
 *   - no horizontal page overflow at the project's viewport
 * Soft SEO checks (listed together, one run shows every gap): exactly one <h1>, <html lang>, meta
 * description + absolute canonical on indexable pages, JSON-LD on detail pages, image alts, footer
 * TMDB attribution.
 *
 * Routes owned by the Pages B branch are tagged @pagesB and annotated; their SEO extras (canonical,
 * JSON-LD, description) are only enforced once E2E_PAGES_B=1 — the hard contract always applies.
 * Routes that render TMDB data are skipped with a clear reason when the server can't reach TMDB.
 */
import type { APIRequestContext, Page } from '@playwright/test';
import { test, expect, settle } from './support/fixtures';
import { isPagesBRoute, PAGES_B_MERGED, requirePagesB, requireTmdb } from './support/env';

interface RouteSpec {
  path: string;
  /** Indexable content page → meta description + canonical expected. */
  content?: boolean;
  /** Detail page → at least one JSON-LD block that parses. */
  jsonLd?: boolean;
  /** Renders TMDB data server-side → skipped when TMDB is unreachable. */
  tmdb?: boolean;
}

const ROUTES: RouteSpec[] = [
  { path: '/', content: true, tmdb: true },
  { path: '/trending', content: true, tmdb: true },
  { path: '/top-rated', content: true, tmdb: true },
  { path: '/movies', content: true, tmdb: true },
  { path: '/tv', content: true, tmdb: true },
  { path: '/discover', content: true, tmdb: true },
  { path: '/discover?type=tv&sort=vote_average.desc', tmdb: true },
  { path: '/search' },
  { path: '/search?q=batman', tmdb: true },
  { path: '/stars', content: true, tmdb: true },
  { path: '/genre/28', content: true, tmdb: true },
  // ── Pages B ──
  { path: '/movie/550', content: true, jsonLd: true, tmdb: true },
  { path: '/tv/1399', content: true, jsonLd: true, tmdb: true },
  { path: '/person/287', content: true, jsonLd: true, tmdb: true },
  { path: '/shorts', content: true },
  { path: '/about', content: true },
  { path: '/blog', content: true },
  { path: '/feed' },
  { path: '/following' },
  { path: '/watchlist' },
  { path: '/watchlist/share' },
  { path: '/profile' },
];

const NOT_FOUND: RouteSpec[] = [
  { path: '/nope-this-route-does-not-exist' },
  { path: '/movie/999999999', tmdb: true },
  { path: '/genre/999999', tmdb: true },
];
const ATTRIBUTION = 'This product uses the TMDB API but is not endorsed or certified by TMDB.';

/** Resolve the first blog post slug from /blog (so the suite doesn't hard-code content). */
async function firstBlogPost(request: APIRequestContext): Promise<string | null> {
  const res = await request.get('/blog');
  if (!res.ok()) return null;
  const m = /href="(\/blog\/[a-z0-9][a-z0-9-]*)"/i.exec(await res.text());
  return m ? m[1] : null;
}

/** Elements sticking out past the viewport's right edge (ignores clipped scrollers like rails). */
async function horizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const wide = [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.right > window.innerWidth + 1 && getComputedStyle(el).position !== 'fixed';
      })
      .filter((el) => {
        for (let p = el.parentElement; p; p = p.parentElement) {
          const ox = getComputedStyle(p).overflowX;
          if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') return false;
        }
        return true;
      })
      .slice(0, 5)
      .map((el) => {
        const cls = typeof el.className === 'string' ? el.className.split(/\s+/).slice(0, 3).join('.') : '';
        return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${cls ? `.${cls}` : ''} right=${Math.round(el.getBoundingClientRect().right)}`;
      });
    return { scrollWidth: doc.scrollWidth, innerWidth: window.innerWidth, wide };
  });
}

async function checkHardContract(page: Page): Promise<void> {
  // Client-rendered pages may add their <h1> after hydration.
  await page.locator('h1').first().waitFor({ state: 'attached', timeout: 8_000 }).catch(() => undefined);
  expect((await page.title()).trim().length, '<title> is set').toBeGreaterThan(2);
  expect(await page.locator('h1').count(), 'has an <h1>').toBeGreaterThanOrEqual(1);
  const o = await horizontalOverflow(page);
  expect(o.scrollWidth, `no horizontal overflow at ${o.innerWidth}px (offenders: ${o.wide.join(', ') || 'n/a'})`).toBeLessThanOrEqual(
    o.innerWidth + 1,
  );
}

async function checkSeo(page: Page, spec: RouteSpec, enforceExtras: boolean): Promise<void> {
  const soft = expect.soft;
  soft(await page.locator('html').getAttribute('lang'), '<html lang>').toMatch(/^[a-z]{2}(-[A-Za-z]{2})?$/);
  soft(await page.locator('h1').count(), 'exactly one <h1>').toBe(1);

  if (spec.content && enforceExtras) {
    const desc = page.locator('meta[name="description"]'); // streamed into <body> for browsers, like the canonical
    soft(await desc.count(), 'one meta description').toBe(1);
    const descText = (await desc.count()) ? ((await desc.first().getAttribute('content')) ?? '') : '';
    soft(descText.trim().length, 'meta description length').toBeGreaterThan(20);
    // Next 16 streams generateMetadata output into <body> for browsers on dynamic routes (it stays in <head> for
    // HTML-limited bots), so accept it anywhere here; "detail metadata is in <head> for bots" checks the bot case.
    const canonical = page.locator('link[rel="canonical"]');
    const nCanonical = await canonical.count();
    soft(nCanonical, 'one canonical link').toBe(1);
    if (nCanonical) soft(await canonical.first().getAttribute('href'), 'absolute canonical URL').toMatch(/^https?:\/\//);
  }

  if (spec.jsonLd && enforceExtras) {
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    soft(blocks.length, 'JSON-LD blocks').toBeGreaterThan(0);
    for (const b of blocks) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(b);
      } catch (e) {
        soft(String(e), 'JSON-LD parses').toBe('');
        continue;
      }
      const first = (Array.isArray(parsed) ? parsed[0] : parsed) as Record<string, unknown> | undefined;
      soft(Boolean(first?.['@context'] || first?.['@graph']), 'JSON-LD has @context').toBe(true);
    }
  }

  // Every <img> needs an alt attribute (empty alt = decorative, which is allowed).
  const missingAlt = await page
    .locator('img:not([alt])')
    .evaluateAll((els) => els.map((e) => (e as HTMLImageElement).currentSrc || (e as HTMLImageElement).src).slice(0, 10));
  soft(missingAlt, 'images without alt').toEqual([]);

  const footer = page.getByRole('contentinfo');
  soft((await footer.count()) ? await footer.first().innerText() : '(no footer landmark)', 'footer TMDB attribution').toContain(
    ATTRIBUTION,
  );
}

function titleFor(path: string, suffix = ''): string {
  return `GET ${path}${suffix} @smoke${isPagesBRoute(path) ? ' @pagesB' : ''}`;
}

test.describe('crawl @smoke', () => {
  for (const spec of ROUTES) {
    test(titleFor(spec.path), async ({ page, issues }) => {
      if (spec.tmdb) requireTmdb();
      const pagesB = isPagesBRoute(spec.path);
      if (pagesB && !PAGES_B_MERGED()) {
        test.info().annotations.push({ type: 'pagesB', description: 'old markup — SEO extras not enforced until E2E_PAGES_B=1' });
      }
      const res = await page.goto(spec.path, { waitUntil: 'domcontentloaded' });
      expect(res, 'navigation response').not.toBeNull();
      expect(res!.status(), `HTTP status for ${spec.path}`).toBe(200);
      await settle(page);
      await checkHardContract(page);
      await checkSeo(page, spec, !pagesB || PAGES_B_MERGED());
      issues.expectClean();
    });
  }

  test('GET first blog post @smoke @pagesB', async ({ page, request, issues }) => {
    const path = await firstBlogPost(request);
    expect(path, 'a /blog/<slug> link on /blog').not.toBeNull();
    const res = await page.goto(path!, { waitUntil: 'domcontentloaded' });
    expect(res!.status()).toBe(200);
    await settle(page);
    await checkHardContract(page);
    await checkSeo(page, { path: path!, content: true, jsonLd: true }, PAGES_B_MERGED());
    issues.expectClean();
  });

  for (const spec of NOT_FOUND) {
    test(titleFor(spec.path, ' → 404'), async ({ page }) => {
      if (spec.tmdb) requireTmdb();
      const res = await page.goto(spec.path, { waitUntil: 'domcontentloaded' });
      await settle(page, 5_000);
      const status = res!.status();
      const robots = await page.locator('meta[name="robots"]').evaluateAll((els) => els.map((e) => e.getAttribute('content') ?? ''));
      const noindex = robots.some((c) => /noindex/i.test(c));
      if (status === 200) {
        // Next 16: once a response has started STREAMING (root app/loading.tsx → Suspense), notFound()
        // can no longer change the status; Next sends 200 + <meta name="robots" content="noindex">
        // ("soft 404", documented in next/dist/docs/.../loading.md#status-codes). Accept that, but say so.
        test.info().annotations.push({ type: 'soft-404', description: `${spec.path} answered 200 + noindex (streamed notFound)` });
        expect(noindex, `${spec.path} answered 200: it must at least carry <meta name="robots" content="noindex">`).toBe(true);
      } else {
        expect(status, `status for ${spec.path}`).toBe(404);
      }
      await checkHardContract(page);
      // A 404 page must not be indexable.
      if (robots.length) expect.soft(noindex, 'robots meta on a 404 says noindex').toBe(true);
    });
  }
});

test.describe('detail metadata is in <head> for bots @smoke @pagesB', () => {
  for (const path of ['/movie/550', '/tv/1399', '/person/287']) {
    test(`${path} canonical + description in <head> for Bingbot @smoke @pagesB`, async ({ request }) => {
      requirePagesB();
      requireTmdb();
      const res = await request.get(path, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)' } });
      expect(res.status()).toBe(200);
      const head = (await res.text()).split('</head>')[0];
      expect(head).toMatch(new RegExp(`<link rel="canonical" href="https?://[^"]+${path}"`));
      expect(head).toMatch(/<meta name="description" content="[^"]{20,}"/);
    });
  }
});

test.describe('crawl metadata files @smoke', () => {
  test.skip(({ isMobile }) => isMobile, 'viewport-independent');

  test('GET /robots.txt @smoke', async ({ request }) => {
    const res = await request.get('/robots.txt');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toMatch(/text\/plain/);
    const txt = await res.text();
    expect(txt).toMatch(/User-Agent:\s*\*/i);
    expect(txt).toMatch(/Disallow:\s*\/api\//i);
    expect(txt).toMatch(/Sitemap:\s*https?:\/\/\S+\/sitemap\.xml/i);
  });

  test('GET /sitemap.xml @smoke @pagesB', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toMatch(/xml/);
    const xml = await res.text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs.length).toBeGreaterThan(5);
    // Every URL must be on the same host as the sitemap advertised in robots.txt (the canonical host).
    const robots = await (await request.get('/robots.txt')).text();
    const sitemapUrl = /Sitemap:\s*(\S+)/i.exec(robots)?.[1];
    expect(sitemapUrl).toBeTruthy();
    const canonicalHost = new URL(sitemapUrl!).host;
    const offHost = locs.filter((l) => new URL(l).host !== canonicalHost);
    expect(offHost, `sitemap URLs not on canonical host ${canonicalHost}`).toEqual([]);
  });
});
