import type { Metadata } from 'next';
import { NOINDEX } from '@/components/detail/seo';
import { ProfileView } from '@/components/profile/ProfileView';

export const metadata: Metadata = {
  title: 'Your profile',
  description: 'Your mkmovies account.',
  robots: NOINDEX,
};

export default function ProfilePage() {
  return <ProfileView />;
}
