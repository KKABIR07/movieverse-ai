import type { Metadata } from 'next';
import Image from 'next/image';
import { Bookmark, Compass, Mail, MessageSquare, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { pageMeta } from '@/components/browse/meta';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = pageMeta({
  title: 'About',
  description:
    'mkmovies is a free movie and TV discovery site: browse what is trending, keep a watchlist, follow actors and directors, and ask an AI assistant for picks.',
  path: '/about',
});

const FEATURES = [
  {
    icon: Compass,
    title: 'Find something to watch',
    desc: 'Trending lists, filters by genre, year and rating, and full details for every title: cast, trailers and where it streams in your country.',
  },
  {
    icon: Bookmark,
    title: 'Keep a watchlist',
    desc: 'Save movies and shows to one list that syncs to your account, and share it with a link.',
  },
  {
    icon: Users,
    title: 'Follow people',
    desc: 'Follow actors, directors and writers and get a feed of their new and upcoming releases.',
  },
  {
    icon: Sparkles,
    title: 'Ask for picks',
    desc: 'Describe a mood or a movie you liked and the AI assistant suggests titles. Suggestions can be wrong, so check the details page.',
  },
  {
    icon: MessageSquare,
    title: 'Reviews and chat',
    desc: 'Write reviews on title pages and talk films in the community chat rooms.',
  },
  {
    icon: ShieldCheck,
    title: 'Honest data',
    desc: 'Scores are TMDB community ratings. We do not show invented review scores, follower numbers or usage statistics.',
  },
];

const STACK = [
  { name: 'Next.js 16', note: 'App Router, server rendering' },
  { name: 'PostgreSQL + Drizzle ORM', note: 'Accounts, watchlists, follows, reviews' },
  { name: 'TMDB API', note: 'Titles, people, images, providers' },
  { name: 'YouTube Data API', note: 'Shorts and extra clips' },
  { name: 'Groq', note: 'AI recommendations (Llama 3.3)' },
  { name: 'TypeScript + Tailwind CSS', note: 'UI' },
];

export default function AboutPage() {
  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="About"
        title="A calmer way to choose what to watch"
        description="mkmovies is a free site for discovering movies and TV shows, tracking what you want to see and following the people who make them."
        display
      />

      <div className="space-y-16 px-gutter">
        <section aria-labelledby="features-title">
          <h2 id="features-title" className="mb-6 text-h2 text-fg">
            What you can do here
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <li key={title} className="rounded-panel border border-line bg-surface-1 p-5">
                <Icon aria-hidden className="size-5 text-accent" />
                <h3 className="mt-3 text-h3 text-fg">{title}</h3>
                <p className="mt-1.5 text-body text-fg-secondary text-pretty">{desc}</p>
              </li>
            ))}
          </ul>
        </section>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section aria-labelledby="founder-title" className="flex flex-col gap-5 rounded-panel border border-line bg-surface-1 p-5 sm:flex-row sm:p-6">
            <div className="relative size-24 shrink-0 overflow-hidden rounded-card bg-surface-2">
              <Image src="/ceo.png" alt="Portrait of Masum Kabir Biswas" fill sizes="96px" className="object-cover object-top" />
            </div>
            <div className="min-w-0">
              <p className="text-micro font-medium uppercase tracking-[0.08em] text-accent">Founder</p>
              <h2 id="founder-title" className="mt-1 text-h2 text-fg">
                Masum Kabir Biswas
              </h2>
              <p className="mt-2 text-body text-fg-secondary text-pretty">
                Full-stack and AI engineer. He built mkmovies end to end, from the interface to the data layer and the AI assistant,
                because the movie sites he used were cluttered, paywalled or had no useful way to ask for a recommendation.
              </p>
              <a
                href="mailto:neuraforz@gmail.com"
                className="mt-4 inline-flex items-center gap-2 text-caption font-medium text-fg-secondary hover:text-accent"
              >
                <Mail aria-hidden className="size-4" /> neuraforz@gmail.com
              </a>
            </div>
          </section>

          <section aria-labelledby="stack-title" className="rounded-panel border border-line bg-surface-1 p-5 sm:p-6">
            <h2 id="stack-title" className="text-h3 text-fg">
              How it is built
            </h2>
            <dl className="mt-4 space-y-3">
              {STACK.map((s) => (
                <div key={s.name} className="grid gap-0.5 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] sm:gap-3">
                  <dt className="text-body font-medium text-fg">{s.name}</dt>
                  <dd className="text-caption text-fg-secondary sm:pt-0.5">{s.note}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <section aria-labelledby="credits-title" className="rounded-panel border border-line bg-surface-1 p-5 sm:p-6">
          <h2 id="credits-title" className="text-h3 text-fg">
            Data and credits
          </h2>
          <p className="mt-2 max-w-3xl text-body text-fg-secondary text-pretty">
            Movie, TV and people data and images come from{' '}
            <a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer" className="font-medium text-fg underline hover:text-accent">
              The Movie Database (TMDB)
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            . This product uses the TMDB API but is not endorsed or certified by TMDB. Streaming availability is provided by JustWatch through
            TMDB. Videos are hosted by YouTube.
          </p>
        </section>

        <section className="flex flex-col items-start gap-4 rounded-panel border border-line bg-surface-1 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h2 className="text-h3 text-fg">Ready to find your next watch?</h2>
            <p className="mt-1 text-body text-fg-secondary">It is free, and you only need an account to save things.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button href="/discover">Start discovering</Button>
            <Button href="/blog" variant="secondary">
              Read the blog
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
