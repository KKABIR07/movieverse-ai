import type { Metadata } from 'next';
import { NOINDEX } from '@/components/detail/seo';
import { WatchlistView } from '@/components/watchlist/WatchlistView';

export const metadata: Metadata = {
  title: 'Your watchlist',
  description: 'Movies and shows you saved on mkmovies.',
  robots: NOINDEX,
};

export default function WatchlistPage() {
  return <WatchlistView />;
}
