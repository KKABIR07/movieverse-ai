import type { Metadata } from 'next';
import { Link2Off } from 'lucide-react';
import { decodeShare } from '@/lib/sync/shareLink';
import { NOINDEX } from '@/components/detail/seo';
import { MediaGrid } from '@/components/media/MediaGrid';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { SaveAllButton } from '@/components/watchlist/SaveAllButton';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export const metadata: Metadata = {
  title: 'Shared watchlist',
  description: 'A watchlist someone shared with you on mkmovies.',
  robots: NOINDEX,
};

export default async function SharedWatchlistPage({ searchParams }: Props) {
  const sp = await searchParams;
  const code = typeof sp.d === 'string' ? sp.d : null;
  const list = decodeShare(code);

  if (!list || list.items.length === 0) {
    const legacy = typeof sp.data === 'string';
    return (
      <div className="px-gutter py-16">
        <h1 className="sr-only">Shared watchlist</h1>
        <EmptyState
          icon={<Link2Off />}
          title="This share link doesn't work"
          description={
            legacy
              ? 'It was made by an older version of mkmovies. Ask for a new link.'
              : 'The link is incomplete or was changed. Ask the person who sent it for a new one.'
          }
          action={<Button href="/discover">Browse movies and shows</Button>}
        />
      </div>
    );
  }

  const count = list.items.length;
  return (
    <>
      <PageHeader
        eyebrow="Shared watchlist"
        title={list.name ?? 'A shared watchlist'}
        description={`${count} ${count === 1 ? 'title' : 'titles'} someone wants you to see.`}
        actions={<SaveAllButton items={list.items} />}
      />
      <div className="px-gutter pb-16">
        <MediaGrid items={list.items.map((i) => ({ ...i, addedAt: '' }))} label="Titles in this list" />
      </div>
    </>
  );
}
