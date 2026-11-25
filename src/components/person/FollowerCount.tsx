'use client';

import { useEffect } from 'react';
import { Users } from 'lucide-react';
import { useFollowerCount, useFollowingStore } from '@/store/followingStore';
import { formatCount } from '@/lib/format';

/**
 * Real follower count from /api/follows/counts (mkmovies users, not TMDB). Renders nothing until
 * loaded or when nobody follows this person yet — no invented numbers.
 */
export function FollowerCount({ personId }: { personId: number }) {
  const count = useFollowerCount(personId);
  useEffect(() => {
    void useFollowingStore.getState().loadCounts([personId]);
  }, [personId]);
  if (!count) return null;
  return (
    <p className="inline-flex items-center gap-1.5 text-caption text-fg-secondary">
      <Users aria-hidden className="size-4 text-fg-muted" />
      <span className="tabular font-medium text-fg">{formatCount(count)}</span>
      {count === 1 ? 'follower' : 'followers'} on mkmovies
    </p>
  );
}
