import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Film, Mail, GitBranch, ExternalLink, Zap, Users, Globe, Heart } from 'lucide-react';

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

const STATS = [
  { value: '900K+', label: 'Movies & Shows' },
  { value: '500K+', label: 'Recommendations served' },
  { value: '190+', label: 'Countries reached' },
  { value: '100%', label: 'Free to use' },
];

const VALUES = [
  {
    icon: Zap,
    title: 'Speed & Simplicity',
    desc: 'Finding your next favourite film should take seconds, not scrolling sessions. Every feature is designed to remove friction and surface great cinema fast.',
  },
  {
    icon: Users,
    title: 'Community First',
    desc: 'Cinema is meant to be shared. We build tools that help film lovers connect, follow creators they admire, and discover what people like them are watching.',
  },
  {
    icon: Globe,
    title: 'Global Reach',
    desc: "Whether you're into Hollywood blockbusters or Korean thrillers, French drama or Japanese animation — our database covers over 900,000 titles from every corner of the world.",
  },
  {
    icon: Heart,
    title: 'Built with Care',
    desc: 'Every page, every recommendation, every API call — crafted with obsessive attention to quality, speed, and the belief that great cinema deserves great tooling.',
  },
];

const TEAM = [
  { initials: 'ET', role: 'Engineering Team', label: 'Full Stack & AI' },
  { initials: 'DT', role: 'Design Team', label: 'UX & Brand' },
  { initials: 'GT', role: 'Growth Team', label: 'Marketing & Community' },
  { initials: 'ST', role: 'Support Team', label: 'User Success' },
];

const SKILLS = [
  'Next.js', 'Node.js', 'TypeScript', 'MongoDB', 'AI / LLM', 'TMDB API', 'TailwindCSS', 'Zustand',
];

export default function AboutPage() {
  return (
    <div className="min-h-screen pt-20 pb-20">

      {/* ── Hero ── */}
      <section className="relative py-24 overflow-hidden">
        <div
          className="absolute inset-0 opacity-10"
          style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 0%, #7c3aed, transparent)' }}
        />
        <div className="container mx-auto px-4 md:px-8 text-center relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10 text-xs font-semibold text-[var(--accent-primary)] uppercase tracking-widest mb-6">
            <Film size={12} /> Our Story
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-[var(--text-primary)] leading-tight mb-6 max-w-3xl mx-auto">
            Built for the future of{' '}
            <span className="gradient-text">cinematic discovery</span>
          </h1>
          <p className="text-lg md:text-xl text-[var(--text-secondary)] max-w-2xl mx-auto leading-relaxed">
            mkmovies was built with a single mission: make it effortless for anyone to discover,
            track, and fall in love with movies and TV shows — with AI as your personal guide.
          </p>
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

      {/* ── Values ── */}
      <section className="py-24">
        <div className="container mx-auto px-4 md:px-8 max-w-5xl">
          <h2 className="text-3xl md:text-4xl font-black text-[var(--text-primary)] text-center mb-14">
            What we stand for
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            {VALUES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="glass rounded-2xl p-8 border border-[var(--border)] hover:border-[var(--accent-primary)]/40 transition-colors group"
              >
                <div className="w-11 h-11 rounded-xl bg-[var(--accent-primary)]/10 flex items-center justify-center mb-5 group-hover:bg-[var(--accent-primary)]/20 transition-colors">
                  <Icon size={20} className="text-[var(--accent-primary)]" />
                </div>
                <h3 className="text-base font-bold text-[var(--text-primary)] mb-2">{title}</h3>
                <p className="text-sm text-[var(--text-muted)] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Founder ── */}
      <section className="py-24 bg-[var(--bg-secondary)]">
        <div className="container mx-auto px-4 md:px-8 max-w-4xl">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold text-[var(--accent-primary)] uppercase tracking-widest mb-2">Leadership</p>
            <h2 className="text-3xl md:text-4xl font-black text-[var(--text-primary)]">Founder &amp; CEO</h2>
          </div>

          <div className="glass rounded-3xl border border-[var(--border)] p-8 md:p-12">
            <div className="flex flex-col md:flex-row gap-8 items-start">
              {/* Avatar */}
              <div className="flex-shrink-0">
                <div className="w-28 h-28 rounded-2xl overflow-hidden ring-2 ring-[var(--accent-primary)]/30 shadow-lg">
                  <Image
                    src="/ceo.png"
                    alt="Masum Kabir Biswas — Founder & CEO"
                    width={112}
                    height={112}
                    className="w-full h-full object-cover object-top"
                    priority
                  />
                </div>
                <div className="mt-3 text-center">
                  <span className="text-xs text-[var(--text-muted)] bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 rounded-full px-3 py-1">
                    Founder &amp; CEO
                  </span>
                </div>
              </div>

              {/* Bio */}
              <div className="flex-1 min-w-0">
                <h3 className="text-2xl font-black text-[var(--text-primary)] mb-1">Masum Kabir Biswas</h3>
                <p className="text-sm text-[var(--accent-primary)] font-semibold mb-4">Building mkmovies · Full Stack &amp; AI Engineer</p>
                <p className="text-[var(--text-secondary)] leading-relaxed mb-4 text-sm">
                  Masum is a full-stack engineer and AI architect with a passion for building products that
                  help people discover things they love. He founded mkmovies to solve a problem he
                  experienced firsthand — the existing movie platforms were either clunky, paywalled, or
                  completely lacked AI-native discovery.
                </p>
                <p className="text-[var(--text-secondary)] leading-relaxed text-sm mb-6">
                  He built the entire platform — frontend, backend, AI integration, watchlist infrastructure,
                  and deployment — from the ground up. His philosophy: ship fast, obsess over quality,
                  and never stop improving the discovery experience.
                </p>

                {/* Skills */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {SKILLS.map((skill) => (
                    <span
                      key={skill}
                      className="text-xs font-medium px-3 py-1 rounded-full bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 text-[var(--accent-primary)]"
                    >
                      {skill}
                    </span>
                  ))}
                </div>

                {/* Social links */}
                <div className="flex items-center gap-4">
                  <a
                    href="mailto:neuraforz@gmail.com"
                    className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-colors"
                  >
                    <Mail size={15} /> Email
                  </a>
                  <a
                    href="https://github.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-colors"
                  >
                    <GitBranch size={15} /> GitHub
                  </a>
                  <a
                    href="https://linkedin.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-colors"
                  >
                    <ExternalLink size={15} /> LinkedIn
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Team ── */}
      <section className="py-24">
        <div className="container mx-auto px-4 md:px-8 max-w-4xl">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold text-[var(--accent-primary)] uppercase tracking-widest mb-2">Behind the scenes</p>
            <h2 className="text-3xl md:text-4xl font-black text-[var(--text-primary)]">The team</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {TEAM.map(({ initials, role, label }) => (
              <div
                key={role}
                className="glass rounded-2xl border border-[var(--border)] p-6 text-center hover:border-[var(--accent-primary)]/40 transition-colors"
              >
                <div className="w-14 h-14 rounded-2xl bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 flex items-center justify-center mx-auto mb-4 text-[var(--accent-primary)] text-lg font-black">
                  {initials}
                </div>
                <p className="text-sm font-bold text-[var(--text-primary)] mb-1">{role}</p>
                <p className="text-xs text-[var(--text-muted)]">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 bg-[var(--bg-secondary)]">
        <div className="container mx-auto px-4 md:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-black text-[var(--text-primary)] mb-4">
            Ready to discover your next favourite film?
          </h2>
          <p className="text-[var(--text-muted)] mb-8 max-w-lg mx-auto">
            Join thousands of film lovers who trust mkmovies to find what&apos;s worth watching.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-[var(--accent-primary)] text-white font-bold rounded-xl hover:bg-[var(--accent-secondary)] transition-colors"
          >
            Get started free
          </Link>
        </div>
      </section>

    </div>
  );
}
