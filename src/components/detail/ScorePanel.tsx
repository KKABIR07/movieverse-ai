import type { ReactNode } from 'react';
import { WatchlistButton } from '@/components/media/WatchlistButton';
import type { MediaSummary } from '@/components/media/types';
import { ScoreRing } from './ScoreRing';
import { ShareButton } from './ShareButton';
import { UserRating } from './UserRating';
import { TrailerButton, type VideoRef } from './Videos';

/**
 * Score panel under the detail title: TMDB score ring | private "Your rating" | actions
 * (Trailer [primary], Watchlist [secondary], Share [icon]).
 */
export function ScorePanel({ media, trailer, sharePath, extra }: { media: MediaSummary; trailer: VideoRef | null; sharePath: string; extra?: ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-5 rounded-panel border border-line bg-surface-1/85 p-4 shadow-card backdrop-blur md:w-fit md:max-w-full md:flex-row md:flex-wrap md:items-center md:gap-x-8 md:p-5">
      <ScoreRing value={media.rating} voteCount={media.voteCount} />
      <div aria-hidden className="hidden h-12 w-px bg-line md:block" />
      <UserRating id={media.id} mediaType={media.mediaType} title={media.title} />
      <div aria-hidden className="hidden h-12 w-px bg-line md:block" />
      <div className="flex flex-wrap items-center gap-2">
        <TrailerButton video={trailer} size="md" />
        <WatchlistButton item={media} appearance="button" size="md" />
        <ShareButton title={media.title} url={sharePath} />
        {extra}
      </div>
    </div>
  );
}
