'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Film, Shuffle } from 'lucide-react';
import { tmdb } from '@/lib/tmdb';
import { formatYear } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { ErrorState } from '@/components/ui/EmptyState';
import { Rating } from '@/components/ui/Rating';
import { WatchlistButton } from '@/components/media/WatchlistButton';
import { posterSrc } from '@/components/media/tmdbImage';
import { mediaHref, toMediaSummary, type MediaSummary } from '@/components/media/types';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Roll = { status: 'loading' } | { status: 'done'; pick: MediaSummary } | { status: 'error' };

/** Pick a random well-rated popular movie or show (TMDB popular lists, pages 1–8). */
async function rollOnce(): Promise<MediaSummary | null> {
  const kind = Math.random() < 0.6 ? 'movie' : 'tv';
  const page = 1 + Math.floor(Math.random() * 8);
  const data = kind === 'movie' ? await tmdb.movie.popular(page) : await tmdb.tv.popular(page);
  const pool = data.results
    .map((r) => toMediaSummary(r, kind))
    .filter((m) => m.posterPath && (m.rating ?? 0) >= 6 && (m.voteCount ?? 0) >= 100);
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * "Surprise me": a random popular title in a dialog, with Roll again / Watchlist / View.
 * Props are unchanged so the header can keep mounting it.
 */
export function DiceRollModal({ open, onClose }: Props) {
  const [roll, setRoll] = useState<Roll>({ status: 'loading' });
  const reqId = useRef(0);

  const doRoll = useCallback(async () => {
    const id = ++reqId.current;
    setRoll({ status: 'loading' });
    try {
      let pick = await rollOnce();
      if (!pick) pick = await rollOnce(); // one retry when a page had nothing well-rated
      if (id !== reqId.current) return;
      setRoll(pick ? { status: 'done', pick } : { status: 'error' });
    } catch {
      if (id === reqId.current) setRoll({ status: 'error' });
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    // roll when the dialog opens; the async result lands after this effect
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void doRoll();
  }, [open, doRoll]);

  const pick = roll.status === 'done' ? roll.pick : null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Surprise me"
      description="A random pick from what is popular right now."
      size="md"
      footer={
        <>
          <Button variant="ghost" leadingIcon={<Shuffle />} onClick={() => void doRoll()} loading={roll.status === 'loading'}>
            Roll again
          </Button>
          {pick && (
            <Button href={mediaHref(pick)} onClick={onClose} trailingIcon={<ArrowRight />}>
              View details
            </Button>
          )}
        </>
      }
    >
      <div aria-live="polite" aria-busy={roll.status === 'loading'}>
        {roll.status === 'error' ? (
          <ErrorState compact title="No pick this time" description="TMDB did not answer. Roll again in a moment." />
        ) : (
          <div className="flex gap-4">
            <div className="relative aspect-[2/3] w-28 shrink-0 overflow-hidden rounded-card bg-surface-2">
              {pick?.posterPath ? (
                <Image src={posterSrc(pick.posterPath)!} alt="" fill sizes="112px" className="object-cover" />
              ) : roll.status === 'loading' ? (
                <div aria-hidden className="skeleton absolute inset-0" />
              ) : (
                <Film aria-hidden className="absolute inset-0 m-auto size-8 text-fg-muted" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              {pick ? (
                <>
                  <p className="text-h3 text-fg line-clamp-2">{pick.title}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-caption text-fg-muted tabular">
                    <Rating value={pick.rating} voteCount={pick.voteCount} size="sm" />
                    <span>{formatYear(pick.date, '')}</span>
                    <span aria-hidden>·</span>
                    <span>{pick.mediaType === 'tv' ? 'TV series' : 'Movie'}</span>
                  </div>
                  {pick.overview && <p className="mt-3 line-clamp-4 text-caption text-fg-secondary">{pick.overview}</p>}
                  <WatchlistButton item={pick} appearance="button" size="sm" className="mt-4" />
                </>
              ) : (
                <div aria-hidden className="flex flex-col gap-2">
                  <div className="skeleton h-5 w-3/4 rounded-chip" />
                  <div className="skeleton h-3.5 w-1/3 rounded-chip" />
                  <div className="skeleton mt-2 h-3 w-full rounded-chip" />
                  <div className="skeleton h-3 w-5/6 rounded-chip" />
                </div>
              )}
              {roll.status === 'loading' && <span className="sr-only">Rolling…</span>}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
