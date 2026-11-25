/**
 * @smoke route crawl — read-only, safe against production.
 * For every public route: HTTP status, one <h1>, <html lang>, SEO head, image alts, JSON-LD on
 * detail pages, footer TMDB attribution, no console errors / same-origin 5xx, and no horizontal
 * overflow on the mobile project.
 *
 * Page checks are SOFT: one run lists every gap on a page instead of stopping at the first one.
 */
import type { APIRequestContext, Page } from '@playwright/test';
import { test, expect, settle, isMobileProject } from './support/fixtures';

interface RouteSpec {
  path: string;
  /** Indexable content page → title + meta description + canonical required. */
  content?: boolean;
  /** Detail page → at least one JSON-LD block that parses. */
  jsonLd?: boolean;
}

const ROUTES: RouteSpec[] = [
  { path: '/', content: true },
  { path: '/trending', content: true },
  { path: '/top-rated', content: true },
  { path: '/movies', content: true },
  { path: '/tv', content: true },
  { path: '/discover', content: true },
  { path: '/search?q=batman' },
  { path: '/stars', content: true },
  { path: '/shorts', content: true },
  { path: '/about', content: true },
  { path: '/blog', content: true },
  { path: '/movie/550', content: true, jsonLd: true },
  { path: '/tv/1399', content: true, jsonLd: true },
  { path: '/person/287', content: true, jsonLd: true },
  { path: '/genre/28', content: true },
  { path: '/watchlist' },
  { path: '/profile' },
];

const NOT_FOUND = ['/movie/999999999', '/genre/999999', '/nope'];
const ATTRIBUTION = 'This product uses the TMDB API but is not endorsed or certified by TMDB.';

/** Resolve the first blog post slug from /blog (so the suite doesn't hard-code content). */
async function firstBlogPost(request: APIRequestContext): Promise<string | null> {
  const res = await request.get('/blog');
  if (!res.ok()) return null;
  const m = /href="(\/blog\/[a-z0-9][a-z0-9-]*)"/i.exec(await res.text());
  return m ? m[1] : null;
}

async function checkHtmlPage(page: Page, spec: RouteSpec, mobile: boolean): Promise<void> {
  const soft = expect.soft;
  // Client-rendered pages may add their <h1> after hydration.
  await page.locator('h1').first().waitFor({ state: 'attached', timeout: 5_000 }).catch(() => undefined);

  soft(await page.locator('html').getAttribute('lang'), '<html lang>').toMatch(/^[a-z]{2}(-[A-Za-z]{2})?$/);
  soft(await page.locator('h1').count(), 'exactly one <h1>').toBe(1);

  if (spec.content) {
    soft((await page.title()).trim().length, '<title> length').toBeGreaterThan(2);
    const desc = page.locator('head meta[name="description"]');
    soft(await desc.count(), 'one meta description').toBe(1);
    const descText = (await desc.count()) ? ((await desc.first().getAttribute('content')) ?? '') : '';
    soft(descText.trim().length, 'meta description length').toBeGreaterThan(20);
    const canonical = page.locator('head link[rel="canonical"]');
    const nCanonical = await canonical.count();
    soft(nCanonical, 'one canonical link').toBe(1);
    if (nCanonical) soft(await canonical.first().getAttribute('href'), 'absolute canonical URL').toMatch(/^https?:\/\//);
  }

  if (spec.jsonLd) {
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

  if (mobile) {
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      const wide = [...document.querySelectorAll<HTMLElement>('body *')]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.right > window.innerWidth + 1 && getComputedStyle(el).position !== 'fixed';
        })
        // ignore elements inside horizontal scrollers (rails) — they are clipped by design
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
    soft(overflow.scrollWidth, `no horizontal overflow (offenders: ${overflow.wide.join(', ')})`).toBeLessThanOrEqual(
      overflow.innerWidth + 1,
    );
  }
}

test.describe('crawl @smoke', () => {
  for (const spec of ROUTES) {
    test(`GET ${spec.path} @smoke`, async ({ page, issues }, info) => {
      const res = await page.goto(spec.path, { waitUntil: 'domcontentloaded' });
      expect(res, 'navigation response').not.toBeNull();
      expect(res!.status(), `HTTP status for ${spec.path}`).toBe(200);
      await settle(page);
      await checkHtmlPage(page, spec, isMobileProject(info.project.name));
      issues.expectClean();
    });
  }

  test('GET first blog post @smoke', async ({ page, request, issues }, info) => {
    const path = await firstBlogPost(request);
    expect(path, 'a /blog/<slug> link on /blog').not.toBeNull();
    const res = await page.goto(path!, { waitUntil: 'domcontentloaded' });
    expect(res!.status()).toBe(200);
    await settle(page);
    await checkHtmlPage(page, { path: path!, content: true, jsonLd: true }, isMobileProject(info.project.name));
    issues.expectClean();
  });

  for (const path of NOT_FOUND) {
    test(`GET ${path} → 404 @smoke`, async ({ page }) => {
      const res = await page.goto(path, { waitUntil: 'domcontentloaded' });
      expect(res!.status(), `status for ${path}`).toBe(404);
      await settle(page, 5_000);
      expect.soft(await page.locator('h1').count(), 'exactly one <h1> on the 404 page').toBe(1);
      // A 404 page must not be indexable.
      const robots = page.locator('head meta[name="robots"]');
      if (await robots.count()) expect.soft(await robots.first().getAttribute('content')).toMatch(/noindex/);
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

  test('GET /sitemap.xml @smoke', async ({ request }) => {
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
