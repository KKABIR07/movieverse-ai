import { describe, expect, it } from 'vitest';
import { buildSitemap, SITEMAP_LIMITS, STATIC_ROUTES } from './sitemap';

const now = new Date('2026-01-01T00:00:00Z');

describe('buildSitemap', () => {
  it('lists static routes on the canonical origin, without private pages', () => {
    const map = buildSitemap({ base: 'https://www.mkmovies.site/', now });
    expect(map).toHaveLength(STATIC_ROUTES.length);
    expect(map[0].url).toBe('https://www.mkmovies.site');
    const urls = map.map((e) => e.url);
    expect(urls).toContain('https://www.mkmovies.site/trending');
    for (const priv of ['/watchlist', '/profile', '/feed', '/following', '/search']) {
      expect(urls.some((u) => u.endsWith(priv))).toBe(false);
    }
  });

  it('adds blog posts with their date and skips bad slugs', () => {
    const map = buildSitemap({
      base: 'https://x.test',
      now,
      posts: [
        { slug: 'good-post', date: '2025-06-10' },
        { slug: '../evil', date: '2025-06-10' },
        { slug: 'bad-date', date: 'nope' },
      ],
    });
    const blog = map.filter((e) => e.url.includes('/blog/'));
    expect(blog.map((e) => e.url)).toEqual(['https://x.test/blog/good-post', 'https://x.test/blog/bad-date']);
    expect(blog[0].lastModified).toEqual(new Date('2025-06-10'));
    expect(blog[1].lastModified).toBe(now);
  });

  it('adds de-duplicated, valid TMDB ids per kind and caps each section', () => {
    const many = Array.from({ length: 500 }, (_, i) => i + 1);
    const map = buildSitemap({ base: 'https://x.test', now, movies: [550, 550, -1, 1.5, 13], tv: many, people: many });
    const urls = map.map((e) => e.url);
    expect(urls.filter((u) => u.includes('/movie/'))).toEqual(['https://x.test/movie/550', 'https://x.test/movie/13']);
    expect(urls.filter((u) => u.includes('/tv/'))).toHaveLength(SITEMAP_LIMITS.tv);
    expect(urls.filter((u) => u.includes('/person/'))).toHaveLength(SITEMAP_LIMITS.person);
    expect(new Set(urls).size).toBe(urls.length);
  });
});
