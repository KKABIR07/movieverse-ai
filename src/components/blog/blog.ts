/**
 * Blog helpers (pure): dates, neighbours and schema.org JSON-LD. Server + client safe.
 */
import type { BlogPost } from '../../data/blog-posts';
import { absoluteUrl, SITE_NAME } from '../detail/seo';
import { formatDate } from '../../lib/format';

export const formatPostDate = (d: string) => formatDate(d, { year: 'numeric', month: 'long', day: 'numeric' });

/** Newest first (stable for equal dates). */
export function sortPosts(posts: readonly BlogPost[]): BlogPost[] {
  return posts
    .map((p, i) => ({ p, i }))
    .sort((a, b) => Date.parse(b.p.date) - Date.parse(a.p.date) || a.i - b.i)
    .map((x) => x.p);
}

/** Previous (older) and next (newer) post in date order. */
export function neighbours(posts: readonly BlogPost[], slug: string): { older: BlogPost | null; newer: BlogPost | null } {
  const sorted = sortPosts(posts);
  const i = sorted.findIndex((p) => p.slug === slug);
  if (i < 0) return { older: null, newer: null };
  return { newer: sorted[i - 1] ?? null, older: sorted[i + 1] ?? null };
}

const publisher = { '@type': 'Organization', name: SITE_NAME, url: absoluteUrl('/') } as const;

export function blogPostingJsonLd(post: BlogPost): Record<string, unknown> {
  const url = absoluteUrl(`/blog/${post.slug}`);
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': url,
    url,
    mainEntityOfPage: url,
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    keywords: post.keywords.join(', '),
    articleSection: post.category,
    author: { '@type': 'Organization', name: post.author || `${SITE_NAME} Editorial`, url: absoluteUrl('/about') },
    publisher,
  };
}

export function blogJsonLd(posts: readonly BlogPost[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: `${SITE_NAME} blog`,
    url: absoluteUrl('/blog'),
    publisher,
    blogPost: sortPosts(posts).map((p) => ({
      '@type': 'BlogPosting',
      headline: p.title,
      description: p.description,
      datePublished: p.date,
      url: absoluteUrl(`/blog/${p.slug}`),
    })),
  };
}
