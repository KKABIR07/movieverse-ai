'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Star, Calendar, ArrowLeft, BookmarkPlus } from 'lucide-react';
import { tmdbImage, formatYear } from '@/lib/tmdb';
import { useWatchlistStore } from '@/store';
import type { WatchlistItem } from '@/types/tmdb';

function ShareContent() {
  const searchParams = useSearchParams();
  const { add, has } = useWatchlistStore();
  const raw = searchParams.get('data');

  let items: WatchlistItem[] = [];
  let owner = 'Someone';
  let listName = '';
  let error = false;

  try {
    if (raw) {
      const decoded = JSON.parse(atob(decodeURIComponent(raw)));
      items    = decoded.items ?? [];
      owner    = decoded.owner ?? 'Someone';
      listName = decoded.listName ?? '';
    } else {
      error = true;
    }
  } catch {
    error = true;
  }

  if (error || !items.length) {
    return (
      <div className="container mx-auto px-4 py-24 min-h-screen flex flex-col items-center justify-center text-center">
        <p className="text-5xl mb-4">🔗</p>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Invalid share link</h1>
        <p className="text-[var(--text-muted)] mb-6">This watchlist link is broken or expired.</p>
        <Link href="/" className="text-[var(--accent-primary)] hover:underline">Go home</Link>
      </div>
    );
  }

  const saveAll = () => {
    items.forEach((item) => {
      if (!has(item.id)) add(item);
    });
  };

  return (
    <div className="container mx-auto px-4 md:px-8 py-24 min-h-screen">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors mb-6">
        <ArrowLeft size={16} /> Back to home
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-[var(--text-primary)]">
            {owner}'s {listName ? `"${listName}"` : 'Watchlist'}
          </h1>
          <p className="text-[var(--text-muted)] mt-1">{items.length} {items.length === 1 ? 'title' : 'titles'}</p>
        </div>
        <button
          onClick={saveAll}
          className="flex items-center gap-2 px-5 py-2.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-white font-semibold rounded-xl transition-colors text-sm"
        >
          <BookmarkPlus size={16} />
          Save All to My Watchlist
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {items.map((item) => (
          <Link key={item.id} href={`/${item.media_type}/${item.id}`} className="group">
            <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-[var(--bg-card)] ring-1 ring-white/5 group-hover:ring-[var(--accent-primary)]/40 transition-all group-hover:-translate-y-1">
              <Image
                src={tmdbImage(item.poster_path, 'w342')}
                alt={item.title}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 50vw, 20vw"
              />
              {!has(item.id) && (
                <button
                  onClick={(e) => { e.preventDefault(); add(item); }}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-[var(--accent-primary)] transition-colors opacity-0 group-hover:opacity-100"
                >
                  <BookmarkPlus size={14} className="text-white" />
                </button>
              )}
            </div>
            <p className="text-sm font-medium text-[var(--text-primary)] mt-2 line-clamp-1 group-hover:text-[var(--accent-primary)] transition-colors">{item.title}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="flex items-center gap-1 text-xs text-yellow-400 font-medium">
                <Star size={10} className="fill-current" />
                {item.vote_average.toFixed(1)}
              </span>
              <span className="text-xs text-[var(--text-muted)]">{formatYear(item.release_date)}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function WatchlistSharePage() {
  return (
    <Suspense>
      <ShareContent />
    </Suspense>
  );
}
