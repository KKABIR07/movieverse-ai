import type { MetadataRoute } from 'next';
import { BLOG_POSTS } from '@/data/blog-posts';

const BASE = 'https://mkmovies.site';

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = [
    { url: BASE, priority: 1.0 },
    { url: `${BASE}/about`, priority: 0.9 },
    { url: `${BASE}/blog`, priority: 0.9 },
    { url: `${BASE}/trending`, priority: 0.8 },
    { url: `${BASE}/movies`, priority: 0.8 },
    { url: `${BASE}/tv`, priority: 0.8 },
    { url: `${BASE}/discover`, priority: 0.8 },
    { url: `${BASE}/top-rated`, priority: 0.7 },
    { url: `${BASE}/stars`, priority: 0.7 },
    { url: `${BASE}/shorts`, priority: 0.6 },
    { url: `${BASE}/search`, priority: 0.5 },
  ].map((p) => ({
    ...p,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
  }));

  const blogPages = BLOG_POSTS.map((post) => ({
    url: `${BASE}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));

  return [...staticPages, ...blogPages];
}
