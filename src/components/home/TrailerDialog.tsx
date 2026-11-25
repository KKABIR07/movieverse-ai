'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Film, Play } from 'lucide-react';
import { tmdb, getTrailerKey, tmdbRetry } from '@/lib/tmdb';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import type { MediaType } from '@/components/media/types';

export interface TrailerTarget {
  id: number;
  mediaType: MediaType;
  title: string;
}

export interface TrailerDialogProps {
  target: TrailerTarget | null;
  onClose: () => void;
}

/**
 * Trailer in a dialog with a "lite YouTube" facade: the thumbnail renders first and the
 * (youtube-nocookie) iframe is only created when the viewer presses play. Nothing autoplays
 * on page load.
 */
export function TrailerDialog({ target, onClose }: TrailerDialogProps) {
  return (
    <Dialog
      open={!!target}
      onClose={onClose}
      title={target ? `${target.title}: trailer` : 'Trailer'}
      size="xl"
      bodyClassName="px-5 pb-5"
    >
      {/* keyed so the facade resets per title */}
      {target && <TrailerBody key={`${target.mediaType}:${target.id}`} target={target} onClose={onClose} />}
    </Dialog>
  );
}

function TrailerBody({ target, onClose }: { target: TrailerTarget; onClose: () => void }) {
  const [playing, setPlaying] = useState(false);
  const { data: key, isPending, isError } = useQuery({
    queryKey: ['videos', target.mediaType, target.id],
    queryFn: async () => {
      const videos = target.mediaType === 'tv' ? await tmdb.tv.videos(target.id) : await tmdb.movie.videos(target.id);
      return getTrailerKey(videos);
    },
    retry: tmdbRetry,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const detailHref = target.mediaType === 'tv' ? `/tv/${target.id}` : `/movie/${target.id}`;

  if (isPending) {
    return <div aria-busy="true" aria-label="Loading trailer" className="skeleton aspect-video w-full rounded-card" />;
  }
  if (isError || !key) {
    return (
      <EmptyState
        compact
        icon={<Film />}
        title={isError ? 'Could not load the trailer' : 'No trailer yet'}
        description={isError ? 'TMDB did not answer. Try again in a moment.' : 'TMDB has no trailer for this title.'}
        action={
          <Button href={detailHref} variant="secondary" trailingIcon={<ArrowRight />} onClick={onClose}>
            View details
          </Button>
        }
      />
    );
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-card bg-surface-2">
      {playing ? (
        <iframe
          title={`${target.title} trailer`}
          src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(key)}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      ) : (
        <button
          type="button"
          data-autofocus
          onClick={() => setPlaying(true)}
          aria-label={`Play ${target.title} trailer`}
          className="group absolute inset-0 grid place-items-center"
        >
          <Image
            src={`https://i.ytimg.com/vi/${encodeURIComponent(key)}/hqdefault.jpg`}
            alt=""
            fill
            sizes="(min-width: 896px) 856px, 100vw"
            className="object-cover"
            unoptimized
          />
          <span aria-hidden className="absolute inset-0 bg-ground/30 transition-colors group-hover:bg-ground/10" />
          <span
            aria-hidden
            className="relative grid size-16 place-items-center rounded-full bg-accent text-on-accent shadow-pop transition-transform duration-120 group-hover:scale-105 [&_svg]:size-7"
          >
            <Play className="translate-x-0.5 fill-current" />
          </span>
        </button>
      )}
    </div>
  );
}
