'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Users, UserMinus } from 'lucide-react';
import { useFollowingStore } from '@/store/followingStore';
import { useAuthStore } from '@/store/authStore';
import { tmdbImage } from '@/lib/tmdb';

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function FollowingShelf() {
  const { following, counts, unfollow } = useFollowingStore();
  const { user } = useAuthStore();

  // Only render when logged in and following someone
  if (!user || following.length === 0) return null;

  return (
    <section className="py-8 px-4 md:px-8">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
          <Users size={19} className="text-[var(--accent-primary)]" />
          People You Follow
        </h2>
        <Link href="/following" className="text-sm text-[var(--accent-primary)] hover:underline font-medium">
          See all →
        </Link>
      </div>

      {/* Horizontal scrollable rounded cards */}
      <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
        {following.map((person) => {
          const followerCount = counts[person.id] ?? 0;
          return (
            <div key={person.id} className="flex-shrink-0 group relative" style={{ width: 120 }}>
              <Link href={`/person/${person.id}`} className="block text-center">
                {/* Round avatar */}
                <div className="relative mx-auto rounded-full overflow-hidden ring-2 ring-[var(--accent-primary)]/40 group-hover:ring-[var(--accent-primary)] transition-all shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
                  style={{ width: 90, height: 90 }}>
                  {person.profile_path ? (
                    <Image
                      src={tmdbImage(person.profile_path, 'w185')}
                      alt={person.name}
                      fill
                      className="object-cover object-top"
                      sizes="90px"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-3xl bg-[var(--bg-card)]">👤</div>
                  )}
                  {/* Online-style accent ring pulse */}
                  <div className="absolute inset-0 rounded-full ring-2 ring-[var(--accent-primary)]/0 group-hover:ring-[var(--accent-primary)]/60 transition-all" />
                </div>

                <p className="text-sm font-semibold text-[var(--text-primary)] mt-2.5 line-clamp-1 group-hover:text-[var(--accent-primary)] transition-colors px-1">
                  {person.name}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {person.known_for_department === 'Directing' ? 'Director' : 'Actor'}
                </p>
                {followerCount > 0 && (
                  <p className="text-[10px] text-violet-400 font-bold mt-0.5">
                    {formatFollowers(followerCount)} followers
                  </p>
                )}
              </Link>

              {/* Unfollow on hover */}
              <button
                onClick={(e) => { e.preventDefault(); unfollow(person.id); }}
                className="absolute top-0 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full bg-black/70 text-white/60 hover:text-red-400 hover:bg-black/90"
                title="Unfollow"
              >
                <UserMinus size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
