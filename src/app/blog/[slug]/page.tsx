import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { BLOG_POSTS, getPost, getRelatedPosts } from '@/data/blog-posts';
import { JsonLd } from '@/components/detail/JsonLdScript';
import { Button } from '@/components/ui/Button';
import { chipClass } from '@/components/ui/Chip';
import { blogPostingJsonLd, formatPostDate, neighbours } from '@/components/blog/blog';

type Props = { params: Promise<{ slug: string }> };

/**
 * Every post is pre-rendered at build time. Unknown slugs get a real HTTP 404 (with dynamic params
 * the root loading.tsx would stream a 200 before notFound() runs). Next logs "NoFallbackError" for these; it is expected.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = getPost((await params).slug);
  if (!post) return { title: 'Article not found', robots: { index: false } };
  const path = `/blog/${post.slug}`;
  return {
    title: post.title,
    description: post.description,
    keywords: post.keywords,
    alternates: { canonical: path },
    openGraph: {
      type: 'article',
      siteName: 'mkmovies',
      title: post.title,
      description: post.description,
      url: path,
      publishedTime: post.date,
      section: post.category,
    },
    twitter: { card: 'summary_large_image', title: post.title, description: post.description },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const post = getPost((await params).slug);
  if (!post) notFound();

  const related = getRelatedPosts(post.slug, post.category).slice(0, 3);
  const { older, newer } = neighbours(BLOG_POSTS, post.slug);

  return (
    <div className="px-gutter pb-16">
      <JsonLd data={blogPostingJsonLd(post)} />
      <div className="mx-auto max-w-3xl">
        <nav aria-label="Breadcrumb" className="pb-8 pt-8 md:pt-12">
          <ol className="flex min-w-0 items-center gap-2 text-caption text-fg-muted">
            <li>
              <Link href="/" className="hover:text-fg">
                Home
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link href="/blog" className="hover:text-fg">
                Blog
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li aria-current="page" className="min-w-0 truncate text-fg-secondary">
              {post.title}
            </li>
          </ol>
        </nav>

        <article>
          <header className="border-b border-line pb-8">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-caption text-fg-muted">
              <span className={chipClass(false, 'sm', 'pointer-events-none')}>{post.category}</span>
              <span className="inline-flex items-center gap-1 tabular">
                <Clock aria-hidden className="size-3.5" /> {post.readTime} min read
              </span>
            </p>
            <h1 className="mt-4 text-h1 text-balance text-fg">{post.title}</h1>
            <p className="mt-4 text-body-lg text-fg-secondary text-pretty">{post.description}</p>
            <p className="mt-6 text-caption text-fg-muted">
              By <span className="font-medium text-fg-secondary">{post.author}</span> ·{' '}
              <time dateTime={post.date}>{formatPostDate(post.date)}</time>
            </p>
          </header>

          {/* Authored in src/data/blog-posts.ts (static, no user input). */}
          <div className="prose-mkmovies mt-8" dangerouslySetInnerHTML={{ __html: post.content }} />
        </article>

        {(older || newer) && (
          <nav aria-label="More articles" className="mt-14 grid gap-3 border-t border-line pt-8 sm:grid-cols-2">
            {older ? (
              <Link href={`/blog/${older.slug}`} className="group rounded-panel border border-line bg-surface-1 p-5 hover:border-line-strong">
                <span className="flex items-center gap-1 text-caption text-fg-muted">
                  <ChevronLeft aria-hidden className="size-4" /> Older
                </span>
                <span className="mt-1.5 line-clamp-2 block text-body font-medium text-fg group-hover:text-accent">{older.title}</span>
              </Link>
            ) : (
              <span className="hidden sm:block" />
            )}
            {newer && (
              <Link
                href={`/blog/${newer.slug}`}
                className="group rounded-panel border border-line bg-surface-1 p-5 text-right hover:border-line-strong"
              >
                <span className="flex items-center justify-end gap-1 text-caption text-fg-muted">
                  Newer <ChevronRight aria-hidden className="size-4" />
                </span>
                <span className="mt-1.5 line-clamp-2 block text-body font-medium text-fg group-hover:text-accent">{newer.title}</span>
              </Link>
            )}
          </nav>
        )}

        {related.length > 0 && (
          <section aria-labelledby="related-title" className="mt-14">
            <h2 id="related-title" className="mb-4 text-h2 text-fg">
              Related articles
            </h2>
            <ul className="divide-y divide-line overflow-hidden rounded-panel border border-line bg-surface-1">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link href={`/blog/${r.slug}`} className="group flex items-start gap-3 px-5 py-4 hover:bg-surface-2">
                    <span className="min-w-0 flex-1">
                      <span className="block text-body font-medium text-fg group-hover:text-accent">{r.title}</span>
                      <span className="mt-0.5 line-clamp-2 block text-caption text-fg-secondary">{r.description}</span>
                    </span>
                    <ChevronRight aria-hidden className="mt-1 size-4 shrink-0 text-fg-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-14 flex flex-col items-start gap-4 rounded-panel border border-line bg-surface-1 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-h3 text-fg">Find your next watch</h2>
            <p className="mt-1 text-body text-fg-secondary">Browse what is trending this week, then save it to your watchlist.</p>
          </div>
          <Button href="/trending" trailingIcon={<ChevronRight />}>
            See what is trending
          </Button>
        </section>
      </div>
    </div>
  );
}
