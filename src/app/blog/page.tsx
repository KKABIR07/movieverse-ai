import type { Metadata } from 'next';
import Link from 'next/link';
import { BLOG_POSTS } from '@/data/blog-posts';
import { Clock, ChevronRight, BookOpen } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Blog — Movie Guides, Lists & Film Discovery Tips',
  description:
    'The mkmovies blog covers movie recommendations, top film lists, TV show guides, and tips for discovering great cinema. New articles weekly.',
  keywords: [
    'movie blog', 'film recommendations', 'best movies lists', 'TV show guides',
    'movie discovery tips', 'cinema guides', 'film reviews',
  ],
  openGraph: {
    title: 'mkmovies Blog — Movie Guides & Film Discovery',
    description:
      'Movie recommendations, top lists, and guides to help you discover great cinema. Updated weekly by the mkmovies editorial team.',
    type: 'website',
    url: 'https://mkmovies.site/blog',
  },
  alternates: { canonical: 'https://mkmovies.site/blog' },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

export default function BlogPage() {
  const [featured, ...rest] = BLOG_POSTS;

  return (
    <div className="min-h-screen pt-20 pb-20">
      <div className="container mx-auto px-4 md:px-8">

        {/* ── Header ── */}
        <div className="py-14 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10 text-xs font-semibold text-[var(--accent-primary)] uppercase tracking-widest mb-6">
            <BookOpen size={12} /> The mkmovies Blog
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-[var(--text-primary)] mb-4">
            Movie guides, lists &amp; tips
          </h1>
          <p className="text-[var(--text-muted)] max-w-xl mx-auto text-lg">
            Recommendations, ranked lists, discovery guides and more — written for people who take
            cinema seriously.
          </p>
        </div>

        {/* ── Featured post ── */}
        <Link
          href={`/blog/${featured.slug}`}
          className="group block mb-14"
        >
          <div className="relative rounded-3xl overflow-hidden border border-[var(--border)] hover:border-[var(--accent-primary)]/50 transition-all duration-300 bg-[var(--bg-secondary)]">
            {/* colour band based on category */}
            <div
              className="h-1.5 w-full"
              style={{ background: `linear-gradient(90deg, ${featured.categoryColor}, transparent)` }}
            />
            <div className="p-8 md:p-12">
              <div className="flex items-center gap-3 mb-4">
                <span
                  className="text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest"
                  style={{ background: `${featured.categoryColor}20`, color: featured.categoryColor }}
                >
                  {featured.category}
                </span>
                <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                  <Clock size={11} /> {featured.readTime} min read
                </span>
                <span className="text-xs text-[var(--text-muted)]">{formatDate(featured.date)}</span>
              </div>
              <h2 className="text-2xl md:text-4xl font-black text-[var(--text-primary)] mb-4 group-hover:text-[var(--accent-primary)] transition-colors leading-tight max-w-3xl">
                {featured.title}
              </h2>
              <p className="text-[var(--text-secondary)] text-base leading-relaxed max-w-2xl mb-6">
                {featured.description}
              </p>
              <div className="flex items-center gap-2 text-[var(--accent-primary)] text-sm font-semibold">
                Read article <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </Link>

        {/* ── Post grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rest.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group glass rounded-2xl border border-[var(--border)] hover:border-[var(--accent-primary)]/40 transition-all duration-300 overflow-hidden flex flex-col"
            >
              <div
                className="h-1 w-full flex-shrink-0"
                style={{ background: post.categoryColor }}
              />
              <div className="p-6 flex flex-col flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-widest"
                    style={{ background: `${post.categoryColor}20`, color: post.categoryColor }}
                  >
                    {post.category}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                    <Clock size={10} /> {post.readTime} min
                  </span>
                </div>
                <h2 className="text-base font-bold text-[var(--text-primary)] mb-2 group-hover:text-[var(--accent-primary)] transition-colors leading-snug line-clamp-2">
                  {post.title}
                </h2>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed line-clamp-3 mb-4 flex-1">
                  {post.description}
                </p>
                <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]">
                  <span className="text-[10px] text-[var(--text-muted)]">{formatDate(post.date)}</span>
                  <span className="text-xs text-[var(--accent-primary)] font-semibold flex items-center gap-1">
                    Read <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* ── Schema.org structured data ── */}
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Blog',
              name: 'mkmovies Blog',
              url: 'https://mkmovies.site/blog',
              description: 'Movie recommendations, top film lists, and discovery guides.',
              publisher: {
                '@type': 'Organization',
                name: 'mkmovies',
                url: 'https://mkmovies.site',
              },
              blogPost: BLOG_POSTS.map((p) => ({
                '@type': 'BlogPosting',
                headline: p.title,
                description: p.description,
                datePublished: p.date,
                url: `https://mkmovies.site/blog/${p.slug}`,
                author: { '@type': 'Organization', name: 'mkmovies Editorial' },
                keywords: p.keywords.join(', '),
              })),
            }),
          }}
        />
      </div>
    </div>
  );
}
