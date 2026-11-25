'use client';

import { useMemo, useState } from 'react';
import { Bookmark, Loader2, SearchX, Share2 } from 'lucide-react';
import { useActiveWatchlistItems, useWatchlistSyncState } from '@/store';
import { useStoresHydrated } from '@/store/hydration';
import { MediaGrid } from '@/components/media/MediaGrid';
import { Button } from '@/components/ui/Button';
import { ToggleGroup } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { AuthGate } from '@/components/profile/AuthGate';
import { FilterInput } from '@/components/profile/FilterInput';
import { countByType, filterWatchlist, type WatchlistSort, type WatchlistType } from './logic';
import { ShareListDialog } from './ShareListDialog';

function WatchlistBody() {
  const hydrated = useStoresHydrated();
  const syncing = useWatchlistSyncState((s) => s.syncing);
  const items = useActiveWatchlistItems();
  const [type, setType] = useState<WatchlistType>('all');
  const [sort, setSort] = useState<WatchlistSort>('added');
  const [query, setQuery] = useState('');
  const [sharing, setSharing] = useState(false);

  const counts = countByType(items);
  const visible = useMemo(() => filterWatchlist(items, { type, query, sort }), [items, type, query, sort]);
  const newestFirst = useMemo(() => filterWatchlist(items, { sort: 'added' }), [items]);

  if (!hydrated || (syncing && items.length === 0)) {
    return <MediaGrid items={[]} loading skeletonCount={12} label="Your watchlist" />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Bookmark />}
        title="Nothing saved yet"
        description="Tap the bookmark on any movie or show to save it here. Your watchlist syncs across your devices."
        action={<Button href="/discover">Find something to watch</Button>}
      />
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <FilterInput value={query} onChange={setQuery} label="Filter your watchlist by title" placeholder="Filter by title…" />
          <Button variant="secondary" leadingIcon={<Share2 />} onClick={() => setSharing(true)}>
            Share list
          </Button>
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <ToggleGroup
            label="Type"
            value={type}
            onChange={setType}
            options={[
              { value: 'all', label: `All (${counts.all})` },
              { value: 'movie', label: `Movies (${counts.movie})`, disabled: counts.movie === 0 },
              { value: 'tv', label: `TV (${counts.tv})`, disabled: counts.tv === 0 },
            ]}
          />
          <ToggleGroup
            label="Sort"
            size="sm"
            layout="scroll"
            value={sort}
            onChange={setSort}
            options={[
              { value: 'added', label: 'Recently added' },
              { value: 'title', label: 'Title' },
              { value: 'release', label: 'Release date' },
              { value: 'rating', label: 'TMDB rating' },
            ]}
          />
        </div>
      </div>

      <p role="status" className="flex items-center gap-2 text-caption text-fg-muted tabular">
        {syncing && <Loader2 aria-hidden className="size-3.5 animate-spin" />}
        {visible.length === items.length ? `${items.length} ${items.length === 1 ? 'title' : 'titles'}` : `${visible.length} of ${items.length} titles`}
        {syncing && <span>· syncing…</span>}
      </p>

      <MediaGrid
        items={visible}
        label="Saved titles"
        empty={<EmptyState compact icon={<SearchX />} title="No saved titles match these filters" />}
      />

      <ShareListDialog open={sharing} onClose={() => setSharing(false)} items={newestFirst} />
    </div>
  );
}

/** The signed-in user's watchlist (server-backed, keyed `${media_type}:${id}`). */
export function WatchlistView() {
  return (
    <>
      <PageHeader eyebrow="Your library" title="Watchlist" description="Movies and shows you want to watch, synced to your account." />
      <div className="px-gutter pb-16">
        <AuthGate
          icon={<Bookmark />}
          title="Sign in to keep a watchlist"
          description="Save movies and shows to one list that follows you across devices, and share it with friends."
          loading={<MediaGrid items={[]} loading skeletonCount={12} label="Your watchlist" />}
        >
          <WatchlistBody />
        </AuthGate>
      </div>
    </>
  );
}
