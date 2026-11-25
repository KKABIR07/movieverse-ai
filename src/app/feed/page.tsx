import type { Metadata } from 'next';
import { NOINDEX } from '@/components/detail/seo';
import { FeedView } from '@/components/person/FeedView';

export const metadata: Metadata = {
  title: 'Your feed',
  description: 'New and upcoming releases from the people you follow.',
  robots: NOINDEX,
};

export default function FeedPage() {
  return <FeedView />;
}
