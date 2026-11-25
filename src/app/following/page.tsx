import type { Metadata } from 'next';
import { NOINDEX } from '@/components/detail/seo';
import { FollowingView } from '@/components/person/FollowingView';

export const metadata: Metadata = {
  title: 'Following',
  description: 'People you follow on mkmovies.',
  robots: NOINDEX,
};

export default function FollowingPage() {
  return <FollowingView />;
}
