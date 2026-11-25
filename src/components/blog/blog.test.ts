import { describe, expect, it } from 'vitest';
import type { BlogPost } from '../../data/blog-posts';
import { blogJsonLd, blogPostingJsonLd, neighbours, sortPosts } from './blog';

const post = (slug: string, date: string): BlogPost => ({
  slug,
  title: slug.toUpperCase(),
  description: 'd',
  date,
  category: 'Guides',
  categoryColor: '#000',
  readTime: 3,
  author: 'mkmovies Editorial',
  authorRole: 'Film Team',
  keywords: ['a', 'b'],
  content: '<p>x</p>',
});

const posts = [post('a', '2025-01-01'), post('c', '2025-03-01'), post('b', '2025-02-01')];

describe('blog helpers', () => {
  it('sorts newest first and finds neighbours in date order', () => {
    expect(sortPosts(posts).map((p) => p.slug)).toEqual(['c', 'b', 'a']);
    expect(neighbours(posts, 'b')).toMatchObject({ newer: { slug: 'c' }, older: { slug: 'a' } });
    expect(neighbours(posts, 'c').newer).toBeNull();
    expect(neighbours(posts, 'zzz')).toEqual({ older: null, newer: null });
  });

  it('builds absolute JSON-LD URLs', () => {
    const ld = blogPostingJsonLd(posts[0]);
    expect(ld['@type']).toBe('BlogPosting');
    expect(String(ld.url)).toMatch(/^https?:\/\/[^/]+\/blog\/a$/);
    expect(ld.keywords).toBe('a, b');
    const blog = blogJsonLd(posts);
    expect((blog.blogPost as unknown[]).length).toBe(3);
  });
});
