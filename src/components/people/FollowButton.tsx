'use client';

import { useState } from 'react';
import { UserPlus, UserCheck, Loader2 } from 'lucide-react';
import { useFollowingStore } from '@/store/followingStore';
import { useAuthStore } from '@/store/authStore';
import type { Person } from '@/types/tmdb';

interface Props {
  person: Pick<Person, 'id' | 'name' | 'profile_path' | 'known_for_department'>;
  size?: 'sm' | 'md';
  className?: string;
  onAuthRequired?: () => void;
}

export function FollowButton({ person, size = 'md', className = '', onAuthRequired }: Props) {
  const { isFollowing, follow, unfollow } = useFollowingStore();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const following = isFollowing(person.id);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      onAuthRequired?.();
      window.dispatchEvent(new CustomEvent('movieverse:openAuth', { detail: { tab: 'login' } }));
      return;
    }
    setLoading(true);
    try {
      if (following) await unfollow(person.id);
      else await follow({ id: person.id, name: person.name, profile_path: person.profile_path, known_for_department: person.known_for_department });
    } finally {
      setLoading(false);
    }
  };

  const sm = size === 'sm';

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`flex items-center gap-1.5 font-semibold rounded-full transition-all active:scale-95 disabled:opacity-60 ${
        following
          ? 'bg-white/10 border border-white/20 text-white/70 hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-400'
          : 'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-secondary)] shadow-[0_0_14px_rgba(124,58,237,0.4)]'
      } ${sm ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'} ${className}`}
    >
      {loading
        ? <Loader2 size={sm ? 11 : 14} className="animate-spin" />
        : following
          ? <UserCheck size={sm ? 11 : 14} />
          : <UserPlus size={sm ? 11 : 14} />}
      {following ? 'Following' : 'Follow'}
    </button>
  );
}
