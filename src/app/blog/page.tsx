import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Clock } from 'lucide-react';
import { BLOG_POSTS } from '@/data/blog-posts';
import { pageMeta } from '@/components/browse/meta';
import { JsonLd } from '@/components/detail/JsonLdScript';
import { PageHeader } from '@/components/ui/PageHeader';
import { chipClass } from '@/components/ui/Chip';
import { blogJsonLd, formatPostDate, sortPosts } from '@/components/blog/blog';

export const metadata: Metadata = pageMeta({
  title: 'Blog',
  description: 'Movie guides, ranked lists and tips for finding something good to watch, from the mkmovies team.',
  path: '/blog',
});

function Meta({ category, readTime, date }: { category: string; readTime: number; date: string }) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-caption text-fg-muted">
      <span className={chipClass(false, 'sm', 'pointer-events-none')}>{category}</span>
      <span className="inline-flex items-center gap-1 tabular">
        <Clock aria-hidden className="size-3.5" /> {readTime} min read
      </span>
      <time dateTime={date}>{formatPostDate(date)}</time>
    </p>
  );
}

export default function BlogPage() {
  const [featured, ...rest] = sortPosts(BLOG_POSTS);

  return (
    <div className="pb-16">
      <JsonLd data={blogJsonLd(BLOG_POSTS)} />
      <PageHeader eyebrow="Blog" title="Guides, lists and tips" description="Help for choosing what to watch next, and how to get more out of mkmovies." />

      <div className="space-y-10 px-gutter">
        {featured && (
          <article className="group relative rounded-hero border border-line bg-surface-1 p-6 transition-colors duration-200 hover:border-line-strong md:p-10">
            <Meta category={featured.category} readTime={featured.readTime} date={featured.date} />
            <h2 className="mt-4 max-w-3xl text-h1 text-balance text-fg md:text-[48px] md:leading-[1.05]">
              <Link href={`/blog/${featured.slug}`} className="after:absolute after:inset-0 after:content-[''] group-hover:text-accent">
                {featured.title}
              </Link>
            </h2>
            <p className="mt-4 max-w-2xl text-body-lg text-fg-secondary text-pretty">{featured.description}</p>
            <p aria-hidden className="mt-6 inline-flex items-center gap-1.5 text-caption font-semibold text-accent">
              Read the article <ArrowRight className="size-4 motion-safe:transition-transform group-hover:translate-x-0.5" />
            </p>
          </article>
        )}

        {rest.length > 0 && (
          <section aria-labelledby="more-posts">
            <h2 id="more-posts" className="mb-5 text-h2 text-fg">
              More articles
            </h2>
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {rest.map((post) => (
                <li key={post.slug}>
                  <article className="group relative flex h-full flex-col rounded-panel border border-line bg-surface-1 p-5 transition-colors duration-200 hover:border-line-strong">
                    <Meta category={post.category} readTime={post.readTime} date={post.date} />
                    <h3 className="mt-3 text-h3 text-fg text-balance">
                      <Link href={`/blog/${post.slug}`} className="after:absolute after:inset-0 after:content-[''] group-hover:text-accent">
                        {post.title}
                      </Link>
                    </h3>
                    <p className="mt-2 line-clamp-3 flex-1 text-body text-fg-secondary">{post.description}</p>
                  </article>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
