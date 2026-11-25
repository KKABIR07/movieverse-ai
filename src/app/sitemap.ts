import type { MetadataRoute } from 'next';
import { BLOG_POSTS } from '@/data/blog-posts';
import { getTopIds } from '@/lib/tmdb/server';
import { logger } from '@/lib/server/logger';
import { SITE_URL } from '@/components/detail/seo';
import { buildSitemap, SITEMAP_LIMITS } from '@/components/detail/sitemap';

/**
 * Rendered per request so a build without TMDB credentials never bakes in an empty sitemap.
 * The TMDB list calls behind getTopIds are cached by the data cache (24h), so this stays cheap.
 * If TMDB is unreachable the sitemap degrades to the static routes + blog posts.
 */
export const dynamic = 'force-dynamic';

const log = logger.child({ component: 'sitemap' });

async function safeIds(kind: 'movie' | 'tv' | 'person', n: number): Promise<number[]> {
  try {
    return await getTopIds(kind, n);
  } catch (err) {
    log.warn('sitemap ids unavailable', { kind, err });
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [movies, tv, people] = await Promise.all([
    safeIds('movie', SITEMAP_LIMITS.movie),
    safeIds('tv', SITEMAP_LIMITS.tv),
    safeIds('person', SITEMAP_LIMITS.person),
  ]);
  return buildSitemap({ base: SITE_URL, now: new Date(), movies, tv, people, posts: BLOG_POSTS });
}
