import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Film, Star, Bookmark, Users, Brain, Tv, Play,
  Globe, Shield, Zap, Heart, ChevronRight,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'About mkmovies',
  description:
    'mkmovies is a free AI-powered movie and TV discovery platform. Search, rate, track, and get personalised recommendations for movies and TV shows worldwide.',
  keywords: [
    'about mkmovies', 'movie discovery platform', 'AI movie recommendations',
    'free movie tracker', 'film rating website', 'TV show tracker',
  ],
  openGraph: {
    title: 'About mkmovies — AI-Powered Movie Discovery',
    description:
      'mkmovies is your cinematic universe. Discover, rate, and track movies & TV shows with AI-powered recommendations powered by TMDB.',
    type: 'website',
    url: 'https://mkmovies.site/about',
  },
  alternates: { canonical: 'https://mkmovies.site/about' },
};

const FEATURES = [
  {
    icon: Brain,
    title: 'AI-Powered Recommendations',
    desc: "Describe what you're in the mood for in plain language and our AI assistant surfaces films that genuinely match — not just genre keywords.",
  },
  {
    icon: Bookmark,
    title: 'Smart Watchlists',
    desc: 'Create multiple named lists, save titles in one tap, and share your watchlist with friends. Your data syncs across all your devices.',
  },
  {
    icon: Play,
    title: 'YouTube Shorts & Clips',
    desc: 'Every movie and TV show detail page surfaces related YouTube Shorts, trailers, and scene clips — watch before you commit.',
  },
  {
    icon: Star,
    title: 'Rate & Review',
    desc: 'Rate films on a 1–10 scale, write reviews, and build a viewing history that makes future recommendations more accurate.',
  },
  {
    icon: Users,
    title: 'Follow Your Favourite Stars',
    desc: 'Follow actors and directors. Their new releases appear in your personalised Feed alongside YouTube interviews and behind-the-scenes videos.',
  },
  {
    icon: Tv,
    title: 'TV Show Tracking',
    desc: 'Full TV show support with season and episode data, cast details, streaming providers, and series status for every show in our database.',
  },
  {
    icon: Globe,
    title: 'Worldwide Coverage',
    desc: 'Powered by The Movie Database (TMDB) — over 900,000 movies and TV shows from every country, language, and era.',
  },
  {
    icon: Zap,
    title: 'Blazing Fast',
    desc: 'Built on Next.js with edge caching and optimised data fetching. Pages load in under a second, even on mobile connections.',
  },
];

const STATS = [
  { value: '900K+', label: 'Movies & Shows' },
  { value: '100%', label: 'Free to Use' },
  { value: 'AI', label: 'Recommendations' },
  { value: '∞', label: 'Discovery' },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen pt-20 pb-20">

      {/* ── Hero ── */}
      <section className="relative py-20 overflow-hidden">
        <div
          className="absolute inset-0 opacity-10"
          style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 0%, #7c3aed, transparent)' }}
        />
        <div className="container mx-auto px-4 md:px-8 text-center relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10 text-xs font-semibold text-[var(--accent-primary)] uppercase tracking-widest mb-6">
            <Film size={12} /> About mkmovies
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-[var(--text-primary)] leading-tight mb-6 max-w-3xl mx-auto">
            Your cinematic universe,{' '}
            <span className="gradient-text">organised</span>
          </h1>
          <p className="text-lg md:text-xl text-[var(--text-secondary)] max-w-2xl mx-auto leading-relaxed mb-10">
            mkmovies is a free movie and TV discovery platform powered by AI. Search over 900,000 titles,
            get personalised recommendations, track everything you want to watch, and follow the
            stars whose work you love.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/trending"
              className="px-6 py-3 bg-[var(--accent-primary)] text-white font-semibold rounded-xl hover:bg-[var(--accent-secondary)] transition-colors text-sm"
            >
              Start Discovering
            </Link>
            <Link
              href="/blog"
              className="px-6 py-3 border border-[var(--border)] text-[var(--text-secondary)] font-semibold rounded-xl hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)] transition-colors text-sm"
            >
              Read Our Blog
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="py-12 border-y border-[var(--border)] bg-[var(--bg-secondary)]">
        <div className="container mx-auto px-4 md:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {STATS.map((s) => (
              <div key={s.label}>
                <p className="text-3xl md:text-4xl font-black gradient-text mb-1">{s.value}</p>
                <p className="text-sm text-[var(--text-muted)] font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Mission ── */}
      <section className="py-20">
        <div className="container mx-auto px-4 md:px-8 max-w-3xl text-center">
          <h2 className="text-3xl md:text-4xl font-black text-[var(--text-primary)] mb-6">
            Why we built mkmovies
          </h2>
          <p className="text-[var(--text-secondary)] leading-relaxed text-lg mb-6">
            The streaming era created an abundance problem. With over 900,000 titles across dozens
            of platforms, the challenge is no longer <em>access</em> — it's <em>discovery</em>. Existing
            tools either show you what's trending (the same 20 movies everyone else is watching) or
            drown you in undifferentiated lists.
          </p>
          <p className="text-[var(--text-secondary)] leading-relaxed text-lg mb-6">
            mkmovies is built around the idea that great cinema should be findable. Whether you're
            looking for a quiet French drama from the 1990s, a Korean thriller that hasn't broken
            through to Western audiences, or just something your whole family can agree on tonight —
            mkmovies should surface it, with context.
          </p>
          <p className="text-[var(--text-secondary)] leading-relaxed text-lg">
            We built AI into the discovery experience from day one, not as a gimmick, but because
            natural language is the only interface expressive enough to capture what you actually
            want from a film.
          </p>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-20 bg-[var(--bg-secondary)]">
        <div className="container mx-auto px-4 md:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black text-[var(--text-primary)] mb-4">
              Everything you need to watch better
            </h2>
            <p className="text-[var(--text-muted)] max-w-xl mx-auto">
              Built for people who care about what they watch, not just what's popular.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="glass rounded-2xl p-6 border border-[var(--border)] hover:border-[var(--accent-primary)]/40 transition-colors group"
              >
                <div className="w-10 h-10 rounded-xl bg-[var(--accent-primary)]/10 flex items-center justify-center mb-4 group-hover:bg-[var(--accent-primary)]/20 transition-colors">
                  <Icon size={18} className="text-[var(--accent-primary)]" />
                </div>
                <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2">{title}</h3>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Data source ── */}
      <section className="py-20">
        <div className="container mx-auto px-4 md:px-8 max-w-3xl">
          <div className="glass rounded-3xl border border-[var(--border)] p-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-6">
              <Shield size={24} className="text-green-400" />
            </div>
            <h2 className="text-2xl font-black text-[var(--text-primary)] mb-4">
              Powered by TMDB — trusted by millions
            </h2>
            <p className="text-[var(--text-secondary)] leading-relaxed mb-6">
              All movie and TV show data on mkmovies is sourced from{' '}
              <a
                href="https://www.themoviedb.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent-primary)] hover:underline"
              >
                The Movie Database (TMDB)
              </a>
              , the world's largest community-built movie database. TMDB covers over 900,000 titles
              across every genre, language, and era — with comprehensive cast, crew, rating, and
              streaming provider data updated continuously.
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              mkmovies is not affiliated with or endorsed by TMDB. This product uses the TMDB API
              but is not certified or approved by TMDB.
            </p>
          </div>
        </div>
      </section>

      {/* ── Values ── */}
      <section className="py-20 bg-[var(--bg-secondary)]">
        <div className="container mx-auto px-4 md:px-8 max-w-4xl">
          <h2 className="text-3xl font-black text-[var(--text-primary)] text-center mb-14">
            What we believe
          </h2>
          <div className="space-y-8">
            {[
              {
                icon: '🔒',
                title: 'Your data stays yours',
                body: 'Your watchlist, ratings, and viewing history are yours. We don\'t sell data to advertisers. We don\'t use your behaviour to manipulate what you see. mkmovies is a tool, not a platform optimised against your interests.',
              },
              {
                icon: '🌍',
                title: 'Global cinema deserves equal space',
                body: 'English-language Hollywood dominates algorithms because it dominates audiences. mkmovies treats Korean thriller, French drama, Japanese animation, and Bengali cinema as equally valid objects of discovery — because great filmmaking happens everywhere.',
              },
              {
                icon: '💡',
                title: 'Discovery should be free',
                body: 'Finding great films to watch should not cost money. mkmovies is free to use, free to sign up, and free to explore. No paywalls, no feature tiers, no subscription required. We make no promises about the future, but this is our commitment right now.',
              },
              {
                icon: '❤️',
                title: 'Cinema matters',
                body: 'Films change how people see the world, themselves, and each other. We take that seriously. The recommendations we surface, the context we provide, and the tools we build are all oriented around the idea that great cinema is worth finding — and worth watching properly.',
              },
            ].map(({ icon, title, body }) => (
              <div key={title} className="flex gap-5">
                <span className="text-2xl flex-shrink-0 mt-0.5">{icon}</span>
                <div>
                  <h3 className="text-base font-bold text-[var(--text-primary)] mb-2">{title}</h3>
                  <p className="text-[var(--text-secondary)] leading-relaxed text-sm">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20">
        <div className="container mx-auto px-4 md:px-8 text-center">
          <Heart size={32} className="text-[var(--accent-primary)] mx-auto mb-6" />
          <h2 className="text-3xl md:text-4xl font-black text-[var(--text-primary)] mb-4">
            Ready to find your next favourite film?
          </h2>
          <p className="text-[var(--text-muted)] mb-8 max-w-lg mx-auto">
            Browse over 900,000 titles, get AI-powered recommendations, and build watchlists
            you'll actually use.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 px-8 py-3.5 bg-[var(--accent-primary)] text-white font-bold rounded-xl hover:bg-[var(--accent-secondary)] transition-colors"
            >
              Explore mkmovies <ChevronRight size={16} />
            </Link>
            <Link
              href="/blog"
              className="flex items-center gap-2 px-8 py-3.5 border border-[var(--border)] text-[var(--text-secondary)] font-bold rounded-xl hover:border-[var(--accent-primary)] transition-colors"
            >
              Read the Blog
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
