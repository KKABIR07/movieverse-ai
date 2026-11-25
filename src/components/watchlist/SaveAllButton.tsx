'use client';

import { useState } from 'react';
import { BookmarkPlus, Check } from 'lucide-react';
import type { WatchlistItem } from '@/types/tmdb';
import { createWatchlistApi } from '@/lib/sync/watchlistApi';
import { openAuth, useActiveWatchlistItems, useWatchlistStore } from '@/store';
import { useAuthStatus } from '@/store/authStore';
import { toast } from '@/store/toastStore';
import { Button } from '@/components/ui/Button';
import { describeSaveAll, itemKey, saveAllSequential } from './logic';

const api = createWatchlistApi();

/** Adds every title of a shared list to the visitor's own watchlist (sequential, with progress). */
export function SaveAllButton({ items }: { items: Omit<WatchlistItem, 'addedAt'>[] }) {
  const status = useAuthStatus();
  const saved = useActiveWatchlistItems();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const existing = new Set(saved.map(itemKey));
  const missing = items.filter((i) => !existing.has(itemKey(i))).length;

  const run = async () => {
    if (status !== 'authenticated') {
      openAuth('login');
      return;
    }
    setProgress({ done: 0, total: missing });
    try {
      const result = await saveAllSequential(items, existing, (item) => api.add(item), (done, total) => setProgress({ done, total }));
      await useWatchlistStore.getState().refreshFromServer();
      toast({
        title: result.saved ? 'Added to your watchlist' : 'Nothing was added',
        description: describeSaveAll(result),
        tone: result.stoppedBy || result.failed ? 'danger' : 'success',
      });
    } finally {
      setProgress(null);
    }
  };

  if (status === 'authenticated' && missing === 0) {
    return (
      <Button variant="secondary" leadingIcon={<Check />} disabled>
        All saved
      </Button>
    );
  }

  return (
    <Button leadingIcon={<BookmarkPlus />} onClick={run} loading={!!progress} aria-live="polite">
      {progress ? `Saving ${progress.done}/${progress.total}…` : status === 'authenticated' ? `Save ${missing} to my watchlist` : 'Sign in to save these'}
    </Button>
  );
}
