'use client';

import { useState, type MouseEvent } from 'react';
import { UserCheck, UserPlus } from 'lucide-react';
import { useFollowingStore, useIsFollowing } from '@/store/followingStore';
import { useAuthStore } from '@/store/authStore';
import { useStoresHydrated } from '@/store/hydration';
import { openAuth } from '@/store';
import { Button } from '@/components/ui/Button';
import type { Person } from '@/types/tmdb';

interface Props {
  person: Pick<Person, 'id' | 'name' | 'profile_path' | 'known_for_department'>;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Called (before the sign-in dialog opens) when a signed-out user clicks. */
  onAuthRequired?: () => void;
}

/**
 * Follow / unfollow a person (server-backed, optimistic; failures roll back with a toast).
 * Signed-out users get the sign-in dialog.
 */
export function FollowButton({ person, size = 'md', className, onAuthRequired }: Props) {
  const hydrated = useStoresHydrated();
  const followingRaw = useIsFollowing(person.id);
  const following = hydrated && followingRaw;
  const status = useAuthStore((s) => s.status);
  const [busy, setBusy] = useState(false);

  const onClick = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (status !== 'authenticated') {
      onAuthRequired?.();
      openAuth('login');
      return;
    }
    setBusy(true);
    try {
      const store = useFollowingStore.getState();
      if (following) await store.unfollow(person.id);
      else
        await store.follow({
          id: person.id,
          name: person.name,
          profile_path: person.profile_path,
          known_for_department: person.known_for_department || 'Acting',
        });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant={following ? 'secondary' : 'primary'}
      size={size}
      onClick={onClick}
      loading={busy}
      aria-pressed={following}
      aria-label={following ? `Unfollow ${person.name}` : `Follow ${person.name}`}
      leadingIcon={following ? <UserCheck className="text-accent" /> : <UserPlus />}
      className={className}
    >
      {following ? 'Following' : 'Follow'}
    </Button>
  );
}
