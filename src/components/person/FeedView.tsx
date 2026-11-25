'use client';

import { useMemo, useState } from 'react';
import { CalendarClock, Rss, UserPlus } from 'lucide-react';
import { useFollowingStore } from '@/store/followingStore';
import { useStoresHydrated } from '@/store/hydration';
import { formatDate } from '@/lib/format';
import { MediaCard } from '@/components/media/MediaCard';
import { MediaGrid } from '@/components/media/MediaGrid';
import type { MediaSummary } from '@/components/media/types';
import { Button } from '@/components/ui/Button';
import { ToggleGroup } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { AuthGate } from '@/components/profile/AuthGate';
import { FilterInput } from '@/components/profile/FilterInput';
import type { PersonCredit } from './credits';
import { buildFeed, formatPeople, type FeedEntry } from './feed';
import { MAX_FEED_PEOPLE, useFollowedCredits } from './useFollowedCredits';

type TypeFilter = 'all' | 'movie' | 'tv';

const toSummary = (c: PersonCredit): MediaSummary => ({
  id: c.id,
  mediaType: c.mediaType,
  title: c.title,
  posterPath: c.posterPath,
  backdropPath: c.backdropPath,
  date: c.date || null,
  rating: c.voteAverage || null,
  voteCount: c.voteCount || null,
  overview: '',
  genreIds: c.genreIds,
});

function FeedGrid({ entries, label }: { entries: FeedEntry[]; label: string }) {
  const byKey = useMemo(() => new Map(entries.map((e) => [`${e.credit.mediaType}:${e.credit.id}`, e])), [entries]);
  return (
    <MediaGrid
      label={label}
      items={entries.map((e) => toSummary(e.credit))}
      renderItem={(item) => {
        const m = item as MediaSummary;
        const e = byKey.get(`${m.mediaType}:${m.id}`);
        return (
          <MediaCard
            item={m}
            meta={
              <>
                <time dateTime={m.date ?? undefined}>
                  {formatDate(m.date, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </time>
                {e && <span className="block truncate text-fg-secondary">{formatPeople(e.people)}</span>}
              </>
            }
          />
        );
      }}
    />
  );
}

function FeedBody() {
  const hydrated = useStoresHydrated();
  const following = useFollowingStore((s) => s.following);
  const [type, setType] = useState<TypeFilter>('all');
  const [query, setQuery] = useState('');
  const people = useFollowedCredits(following);

  const loading = !hydrated || people.some((p) => p.isLoading);
  const failed = people.filter((p) => p.isError).length;
  const sources = people
    .filter((p) => p.film)
    .map((p) => ({
      id: p.person.id,
      name: p.person.name,
      credits: [...p.film!.cast, ...p.film!.crew],
    }));
  const feed = buildFeed(sources, { mediaType: type, query });

  if (hydrated && following.length === 0) {
    return (
      <div className="py-12">
        <EmptyState
          icon={<UserPlus />}
          title="Your feed is empty"
          description="Follow actors, directors and writers to see their new and upcoming releases here."
          action={<Button href="/stars">Find people to follow</Button>}
        />
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <ToggleGroup
          label="Show"
          value={type}
          onChange={setType}
          options={[
            { value: 'all', label: 'Everything' },
            { value: 'movie', label: 'Movies' },
            { value: 'tv', label: 'TV' },
          ]}
        />
        <FilterInput value={query} onChange={setQuery} label="Filter your feed by title" placeholder="Filter by title…" />
      </div>

      {failed > 0 && (
        <p role="status" className="rounded-control border border-line bg-surface-1 px-4 py-3 text-caption text-fg-secondary">
          Could not load {failed} of {people.length} people right now. Their releases will appear after a refresh.
        </p>
      )}

      {loading ? (
        <MediaGrid items={[]} loading skeletonCount={12} label="Your feed" />
      ) : feed.upcoming.length === 0 && feed.recent.length === 0 ? (
        <EmptyState
          compact
          icon={<CalendarClock />}
          title={query || type !== 'all' ? 'Nothing matches these filters' : 'No recent releases'}
          description="Nothing from the people you follow was released in the last two years or is scheduled yet."
        />
      ) : (
        <>
          {feed.upcoming.length > 0 && (
            <section aria-labelledby="feed-upcoming">
              <SectionHeader id="feed-upcoming" title="Coming soon" description="Scheduled releases, soonest first." />
              <FeedGrid entries={feed.upcoming} label="Coming soon" />
            </section>
          )}
          {feed.recent.length > 0 && (
            <section aria-labelledby="feed-recent">
              <SectionHeader id="feed-recent" title="Recent releases" description="From the last two years, newest first." />
              <FeedGrid entries={feed.recent} label="Recent releases" />
            </section>
          )}
        </>
      )}
      {following.length > MAX_FEED_PEOPLE && (
        <p className="text-caption text-fg-muted tabular">Showing releases for the {MAX_FEED_PEOPLE} people you followed most recently.</p>
      )}
    </div>
  );
}

/** Release feed built from the people the user follows (server-backed follows, TMDB credits). */
export function FeedView() {
  const count = useFollowingStore((s) => s.following.length);
  const hydrated = useStoresHydrated();
  return (
    <>
      <PageHeader
        eyebrow="Your feed"
        title="New from people you follow"
        description={
          hydrated && count > 0
            ? `New and upcoming movies and shows from the ${count} ${count === 1 ? 'person' : 'people'} you follow.`
            : 'New and upcoming movies and shows from the people you follow.'
        }
        actions={
          <Button href="/following" variant="secondary" size="sm">
            Manage following
          </Button>
        }
      />
      <div className="px-gutter pb-16">
        <AuthGate
          icon={<Rss />}
          title="Sign in to see your feed"
          description="Follow actors and directors, then see their new and upcoming releases in one place."
        >
          <FeedBody />
        </AuthGate>
      </div>
    </>
  );
}
