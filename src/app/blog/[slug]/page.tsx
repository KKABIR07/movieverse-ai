import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { BLOG_POSTS, getPost, getRelatedPosts } from '@/data/blog-posts';
import { Clock, Calendar, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';

interface Props {
  params: Promise<{ slug: string }>;
}

// Pre-render all blog posts at build time
export function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};

  return {
    title: post.title,
    description: post.description,
    keywords: post.keywords,
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      url: `https://mkmovies.site/blog/${post.slug}`,
      publishedTime: post.date,
    },
    alternates: { canonical: `https://mkmovies.site/blog/${post.slug}` },
  };
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const related = getRelatedPosts(slug, post.category);
  const currentIndex = BLOG_POSTS.findIndex((p) => p.slug === slug);
  const prev = currentIndex > 0 ? BLOG_POSTS[currentIndex - 1] : null;
  const next = currentIndex < BLOG_POSTS.length - 1 ? BLOG_POSTS[currentIndex + 1] : null;

  return (
    <div className="min-h-screen pt-20 pb-20">
      <div className="container mx-auto px-4 md:px-8 max-w-3xl">

        {/* ── Breadcrumb ── */}
        <nav className="flex items-center gap-2 text-xs text-[var(--text-muted)] pt-8 pb-10" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-[var(--text-primary)] transition-colors">Home</Link>
          <span>/</span>
          <Link href="/blog" className="hover:text-[var(--text-primary)] transition-colors">Blog</Link>
          <span>/</span>
          <span className="text-[var(--text-primary)] truncate max-w-[200px]">{post.title}</span>
        </nav>

        {/* ── Header ── */}
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-5">
            <span
              className="text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest"
              style={{ background: `${post.categoryColor}20`, color: post.categoryColor }}
            >
              {post.category}
            </span>
            <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
              <Clock size={11} /> {post.readTime} min read
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl font-black text-[var(--text-primary)] leading-tight mb-5">
            {post.title}
          </h1>

          <p className="text-lg text-[var(--text-secondary)] leading-relaxed mb-6">
            {post.description}
          </p>

          <div className="flex items-center gap-4 pb-8 border-b border-[var(--border)]">
            <div className="w-9 h-9 rounded-full bg-[var(--accent-primary)] flex items-center justify-center flex-shrink-0">
              <BookOpen size={14} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">{post.author}</p>
              <p className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                <Calendar size={10} /> {formatDate(post.date)}
              </p>
            </div>
          </div>
        </header>

        {/* ── Article body ── */}
        <article
          className="prose-mkmovies"
          // Content is authored by us — no user input, safe to render
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {/* ── Prev / Next ── */}
        <nav className="mt-16 pt-8 border-t border-[var(--border)] grid grid-cols-2 gap-4" aria-label="Post navigation">
          {prev ? (
            <Link
              href={`/blog/${prev.slug}`}
              className="group glass rounded-2xl p-5 border border-[var(--border)] hover:border-[var(--accent-primary)]/40 transition-all"
            >
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mb-2">
                <ChevronLeft size={13} /> Previous
              </div>
              <p className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors line-clamp-2">
                {prev.title}
              </p>
            </Link>
          ) : <div />}

          {next ? (
            <Link
              href={`/blog/${next.slug}`}
              className="group glass rounded-2xl p-5 border border-[var(--border)] hover:border-[var(--accent-primary)]/40 transition-all text-right"
            >
              <div className="flex items-center justify-end gap-2 text-xs text-[var(--text-muted)] mb-2">
                Next <ChevronRight size={13} />
              </div>
              <p className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors line-clamp-2">
                {next.title}
              </p>
            </Link>
          ) : <div />}
        </nav>

        {/* ── Related posts ── */}
        {related.length > 0 && (
          <section className="mt-16">
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-6">Related articles</h2>
            <div className="space-y-4">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/blog/${r.slug}`}
                  className="group flex items-start gap-4 glass rounded-2xl p-5 border border-[var(--border)] hover:border-[var(--accent-primary)]/40 transition-all"
                >
                  <div
                    className="w-1 self-stretch rounded-full flex-shrink-0"
                    style={{ background: r.categoryColor }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors line-clamp-1 mb-1">
                      {r.title}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] line-clamp-2">{r.description}</p>
                  </div>
                  <ChevronRight size={14} className="text-[var(--text-muted)] flex-shrink-0 mt-0.5 group-hover:text-[var(--accent-primary)] group-hover:translate-x-0.5 transition-all" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── CTA ── */}
        <div className="mt-16 glass rounded-3xl border border-[var(--accent-primary)]/20 p-8 text-center">
          <p className="text-base font-bold text-[var(--text-primary)] mb-2">
            Ready to find your next watch?
          </p>
          <p className="text-sm text-[var(--text-muted)] mb-5">
            Browse 900,000+ movies and TV shows on mkmovies — free, no signup required.
          </p>
          <Link
            href="/trending"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-[var(--accent-primary)] text-white font-semibold rounded-xl hover:bg-[var(--accent-secondary)] transition-colors text-sm"
          >
            Explore mkmovies <ChevronRight size={14} />
          </Link>
        </div>

        {/* ── Schema.org structured data ── */}
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'BlogPosting',
              headline: post.title,
              description: post.description,
              datePublished: post.date,
              dateModified: post.date,
              url: `https://mkmovies.site/blog/${post.slug}`,
              keywords: post.keywords.join(', '),
              author: {
                '@type': 'Organization',
                name: 'mkmovies Editorial',
                url: 'https://mkmovies.site',
              },
              publisher: {
                '@type': 'Organization',
                name: 'mkmovies',
                url: 'https://mkmovies.site',
                logo: { '@type': 'ImageObject', url: 'https://mkmovies.site/icon' },
              },
              mainEntityOfPage: {
                '@type': 'WebPage',
                '@id': `https://mkmovies.site/blog/${post.slug}`,
              },
            }),
          }}
        />
      </div>
    </div>
  );
}
