/**
 * sitemap.xml builder (pure, unit-tested). The route (src/app/sitemap.ts) feeds it TMDB ids.
 */
import type { MetadataRoute } from 'next';

type Entry = MetadataRoute.Sitemap[number];

/** Public, indexable listing pages. Private pages (/watchlist, /profile, /feed, /following) and /search are excluded. */
export const STATIC_ROUTES: readonly { path: string; priority: number; changeFrequency: Entry['changeFrequency'] }[] = [
  { path: '/', priority: 1, changeFrequency: 'daily' },
  { path: '/trending', priority: 0.9, changeFrequency: 'daily' },
  { path: '/movies', priority: 0.8, changeFrequency: 'daily' },
  { path: '/tv', priority: 0.8, changeFrequency: 'daily' },
  { path: '/top-rated', priority: 0.7, changeFrequency: 'weekly' },
  { path: '/discover', priority: 0.7, changeFrequency: 'weekly' },
  { path: '/stars', priority: 0.7, changeFrequency: 'daily' },
  { path: '/shorts', priority: 0.5, changeFrequency: 'daily' },
  { path: '/blog', priority: 0.6, changeFrequency: 'weekly' },
  { path: '/about', priority: 0.4, changeFrequency: 'monthly' },
];

/** Upper bounds per section (the whole file stays far below the 50,000-URL / 50 MB protocol limit). */
export const SITEMAP_LIMITS = { movie: 200, tv: 200, person: 100, blog: 200 } as const;

export interface SitemapInput {
  /** Origin without trailing slash, e.g. https://www.mkmovies.site */
  base: string;
  now: Date;
  movies?: readonly number[];
  tv?: readonly number[];
  people?: readonly number[];
  posts?: readonly { slug: string; date: string }[];
}

const validId = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0 && n < 2_147_483_647;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function ids(list: readonly number[] | undefined, max: number): number[] {
  return [...new Set((list ?? []).filter(validId))].slice(0, max);
}

export function buildSitemap({ base, now, movies, tv, people, posts }: SitemapInput): MetadataRoute.Sitemap {
  const origin = base.replace(/\/+$/, '');
  const url = (path: string) => (path === '/' ? origin : `${origin}${path}`);
  const out: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: url(r.path),
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  for (const p of (posts ?? []).filter((p) => SLUG.test(p.slug)).slice(0, SITEMAP_LIMITS.blog)) {
    const d = new Date(p.date);
    out.push({
      url: url(`/blog/${p.slug}`),
      lastModified: Number.isNaN(d.getTime()) ? now : d,
      changeFrequency: 'monthly',
      priority: 0.6,
    });
  }

  const add = (prefix: string, list: number[], priority: number) => {
    for (const id of list) out.push({ url: url(`/${prefix}/${id}`), changeFrequency: 'weekly', priority });
  };
  add('movie', ids(movies, SITEMAP_LIMITS.movie), 0.7);
  add('tv', ids(tv, SITEMAP_LIMITS.tv), 0.7);
  add('person', ids(people, SITEMAP_LIMITS.person), 0.5);
  return out;
}
