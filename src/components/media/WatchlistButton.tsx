'use client';

import { Bookmark, BookmarkCheck } from 'lucide-react';
import { useIsInWatchlist, useWatchlistStore, openAuth } from '@/store';
import { useAuthStore } from '@/store/authStore';
import { useStoresHydrated } from '@/store/hydration';
import { toast } from '@/store/toastStore';
import { Button, type ButtonSize } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/components/ui/cn';
import { toMediaSummary, toWatchlistItem, type MediaInput, type MediaType } from './types';

export interface WatchlistButtonProps {
  item: MediaInput;
  mediaType?: MediaType;
  /** 'icon' = translucent disc for posters; 'button' = labelled button for detail pages. */
  appearance?: 'icon' | 'button';
  size?: ButtonSize;
  className?: string;
  /** Show an Undo toast after changes (default true). */
  announce?: boolean;
}

/**
 * Save/unsave a title in the active watchlist (signed-in users; prompts sign-in otherwise).
 * Subscribes only to this title's saved state.
 * @example <WatchlistButton item={movie} appearance="button" />
 */
export function WatchlistButton({
  item,
  mediaType,
  appearance = 'icon',
  size = 'md',
  className,
  announce = true,
}: WatchlistButtonProps) {
  const m = toMediaSummary(item, mediaType);
  const hydrated = useStoresHydrated();
  const savedRaw = useIsInWatchlist(m.id, m.mediaType);
  const saved = hydrated && savedRaw;
  const signedIn = useAuthStore((s) => s.status === 'authenticated');

  const onClick = () => {
    if (!signedIn) {
      openAuth('login');
      return;
    }
    const nowSaved = useWatchlistStore.getState().toggle(toWatchlistItem(m));
    if (!announce) return;
    toast({
      title: nowSaved ? 'Added to watchlist' : 'Removed from watchlist',
      description: m.title,
      tone: nowSaved ? 'success' : 'neutral',
      action: {
        label: 'Undo',
        onClick: () => useWatchlistStore.getState().toggle(toWatchlistItem(m)),
      },
    });
  };

  const label = saved ? `Remove ${m.title} from watchlist` : `Add ${m.title} to watchlist`;

  if (appearance === 'button') {
    return (
      <Button
        variant="secondary"
        size={size}
        onClick={onClick}
        aria-pressed={saved}
        aria-label={label}
        leadingIcon={saved ? <BookmarkCheck className="text-accent" /> : <Bookmark />}
        className={className}
      >
        {saved ? 'In watchlist' : 'Watchlist'}
      </Button>
    );
  }

  return (
    <IconButton
      label={label}
      noTitle
      pressed={saved}
      variant="overlay"
      size="sm"
      round
      onClick={onClick}
      icon={saved ? <BookmarkCheck className="fill-accent text-accent" /> : <Bookmark />}
      className={cn(saved && 'border-accent/40', className)}
    />
  );
}
