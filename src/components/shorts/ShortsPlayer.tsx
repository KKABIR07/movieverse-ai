'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, ExternalLink, Info, SquarePlay, Volume2, VolumeX } from 'lucide-react';
import { checkYouTubeKey, fetchMovieShorts, type YTShort } from '@/lib/youtube';
import { formatYear } from '@/lib/format';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { Rating } from '@/components/ui/Rating';
import { cn } from '@/components/ui/cn';
import { WatchlistButton } from '@/components/media/WatchlistButton';
import { tmdbUrl } from '@/components/media/tmdbImage';
import type { MediaSummary } from '@/components/media/types';
import { YT_EMBED_ORIGIN, clampIndex, playerCommand, shortsEmbedUrl, shortsKeyAction } from './keys';

export interface ShortTitle {
  id: number;
  mediaType: 'movie' | 'tv';
  title: string;
  posterPath: string | null;
  rating: number;
  date: string | null;
}

/** Alternate movie / tv titles so the feed doesn't show five films in a row. */
function interleave(titles: ShortTitle[]): ShortTitle[] {
  const movies = titles.filter((t) => t.mediaType === 'movie');
  const tv = titles.filter((t) => t.mediaType === 'tv');
  const out: ShortTitle[] = [];
  for (let i = 0; i < Math.max(movies.length, tv.length); i++) {
    if (movies[i]) out.push(movies[i]);
    if (tv[i]) out.push(tv[i]);
  }
  return out;
}

const summaryOf = (s: YTShort): MediaSummary => ({
  id: s.relatedMovieId,
  mediaType: s.relatedMovieType,
  title: s.relatedMovie,
  posterPath: s.relatedMoviePoster,
  backdropPath: null,
  date: s.relatedMovieDate ?? null,
  rating: s.relatedMovieRating || null,
  voteCount: null,
  overview: '',
  genreIds: [],
});

const STAGE_H = 'h-[calc(100dvh-var(--header-h)-var(--tabbar-h))] md:h-[calc(100dvh-var(--header-h))]';

function Stage({ children }: { children: React.ReactNode }) {
  return <div className={cn('grid place-items-center px-gutter', STAGE_H)}>{children}</div>;
}

/**
 * Vertical YouTube Shorts feed for this week's trending titles.
 *  - Mute / unmute go through the YouTube IFrame API (postMessage), so the video keeps playing.
 *  - Arrow / j / k / m keys are ignored while typing or inside dialogs (search palette, sign-in, chat).
 *  - Lives in normal page flow below the fixed header, so it never covers the nav or the tab bar.
 */
export function ShortsPlayer({ titles }: { titles: ShortTitle[] }) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [index, setIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const mutedRef = useRef(true);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const touchY = useRef<number | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const ordered = useMemo(() => interleave(titles), [titles]);

  useEffect(() => {
    let alive = true;
    void checkYouTubeKey().then((ok) => alive && setConfigured(ok));
    return () => {
      alive = false;
    };
  }, []);

  const feed = useQuery({
    queryKey: ['yt-shorts-feed', ordered.map((t) => `${t.mediaType}:${t.id}`).join(',')],
    enabled: configured === true && ordered.length > 0,
    staleTime: 6 * 60 * 60 * 1000,
    retry: false,
    queryFn: async (): Promise<YTShort[]> => {
      const lists = await Promise.all(
        ordered.map((t) =>
          fetchMovieShorts(
            {
              id: t.id,
              title: t.title,
              poster_path: t.posterPath,
              vote_average: t.rating,
              type: t.mediaType,
              date: t.date ?? undefined,
            },
            3,
          ),
        ),
      );
      const seen = new Set<string>();
      return lists.flat().filter((s) => s.videoId && !seen.has(s.videoId) && (seen.add(s.videoId), true));
    },
  });

  const shorts = useMemo(() => feed.data ?? [], [feed.data]);
  const total = shorts.length;
  const current = shorts[clampIndex(index, total)];

  const go = useCallback((delta: number) => setIndex((i) => clampIndex(i + delta, total)), [total]);

  const send = useCallback((func: Parameters<typeof playerCommand>[0]) => {
    frameRef.current?.contentWindow?.postMessage(playerCommand(func), YT_EMBED_ORIGIN);
  }, []);

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    send(next ? 'mute' : 'unMute');
  }, [send]);

  // Keyboard: only plain keys on the page itself (never while typing or in a dialog).
  useEffect(() => {
    if (!total) return;
    const onKey = (e: KeyboardEvent) => {
      const action = shortsKeyAction(e);
      if (!action) return;
      e.preventDefault();
      if (action === 'mute') toggleMute();
      else go(action === 'next' ? 1 : -1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [total, go, toggleMute]);

  // When a new video's player reports ready, apply the user's sound choice (it always loads muted).
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== YT_EMBED_ORIGIN || e.source !== frameRef.current?.contentWindow) return;
      let data: { event?: string } | null = null;
      try {
        data = typeof e.data === 'string' ? (JSON.parse(e.data) as { event?: string }) : null;
      } catch {
        return;
      }
      if (data?.event === 'onReady' || data?.event === 'initialDelivery') {
        if (!mutedRef.current) send('unMute');
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [send]);

  const onFrameLoad = () => {
    // Subscribe to player events (YouTube IFrame API handshake).
    frameRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), YT_EMBED_ORIGIN);
    if (!mutedRef.current) window.setTimeout(() => send('unMute'), 400);
  };

  const onTouchStart = (e: TouchEvent) => {
    touchY.current = e.touches[0]?.clientY ?? null;
  };
  const onTouchEnd = (e: TouchEvent) => {
    if (touchY.current === null) return;
    const delta = touchY.current - (e.changedTouches[0]?.clientY ?? touchY.current);
    touchY.current = null;
    if (Math.abs(delta) > 60) go(delta > 0 ? 1 : -1);
  };

  if (configured === null || (configured && feed.isPending && ordered.length > 0)) {
    return (
      <Stage>
        <div aria-busy="true" className="flex flex-col items-center gap-4">
          <div className="skeleton aspect-[9/16] h-[min(70dvh,640px)] max-w-[calc(100vw-32px)] rounded-hero" />
          <p role="status" className="text-caption text-fg-muted">
            Loading shorts…
          </p>
        </div>
      </Stage>
    );
  }

  if (!configured) {
    return (
      <Stage>
        <EmptyState
          icon={<SquarePlay />}
          title="Shorts are unavailable right now"
          description="Video search is switched off on this server. Trailers on each title page still work."
          action={<Button href="/trending">Browse trending titles</Button>}
        />
      </Stage>
    );
  }

  if (!current) {
    return (
      <Stage>
        <EmptyState
          icon={<SquarePlay />}
          title={feed.isError ? 'Could not load shorts' : 'No shorts found'}
          description={
            ordered.length
              ? "YouTube returned nothing for this week's trending titles. Try again later."
              : 'Trending titles could not be loaded. Try again in a moment.'
          }
          action={<Button href="/trending">Browse trending titles</Button>}
        />
      </Stage>
    );
  }

  const pos = clampIndex(index, total);
  const embed = shortsEmbedUrl(current.videoId, typeof window !== 'undefined' ? window.location.origin : undefined);
  const year = formatYear(current.relatedMovieDate, '');
  const detailHref = `/${current.relatedMovieType}/${current.relatedMovieId}`;
  const poster = tmdbUrl(current.relatedMoviePoster, 'w342');

  return (
    <section
      aria-label="Shorts player"
      aria-roledescription="carousel"
      className={cn('relative isolate overflow-hidden', STAGE_H)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {poster && (
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <Image src={poster} alt="" fill sizes="30vw" className="scale-110 object-cover opacity-30 blur-3xl" />
          <div className="absolute inset-0 bg-gradient-to-b from-ground/60 via-ground/40 to-ground" />
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        Short {pos + 1} of {total}: {current.title}, from {current.relatedMovie}
      </p>

      <div className="flex h-full items-center justify-center gap-3 px-2 py-3 sm:gap-5 sm:px-gutter">
        {/* Previous / next (desktop) */}
        <div className="hidden flex-col items-center gap-3 md:flex">
          <IconButton label="Previous short" icon={<ChevronUp />} variant="secondary" round onClick={() => go(-1)} disabled={pos === 0} />
          <span className="text-micro tabular text-fg-muted" aria-hidden>
            {pos + 1}/{total}
          </span>
          <IconButton
            label="Next short"
            icon={<ChevronDown />}
            variant="secondary"
            round
            onClick={() => go(1)}
            disabled={pos >= total - 1}
          />
        </div>

        {/* 9:16 player */}
        <div className="relative aspect-[9/16] h-full max-h-[760px] max-w-[calc(100vw-88px)] shrink overflow-hidden rounded-hero border border-line bg-surface-1 shadow-pop sm:max-w-full">
          {embed ? (
            <iframe
              ref={frameRef}
              key={current.videoId}
              src={embed}
              title={`${current.title} (YouTube short)`}
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              onLoad={onFrameLoad}
              className="absolute inset-0 size-full border-0"
            />
          ) : (
            <div className="grid size-full place-items-center text-fg-muted">This video cannot be played.</div>
          )}
          <div className="absolute right-3 top-3">
            <IconButton
              label={muted ? 'Unmute' : 'Mute'}
              icon={muted ? <VolumeX /> : <Volume2 />}
              variant="overlay"
              round
              onClick={toggleMute}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex w-12 shrink-0 flex-col items-center gap-4 sm:w-14">
          {poster && (
            <Link
              href={detailHref}
              className="relative block h-[72px] w-12 overflow-hidden rounded-chip ring-1 ring-line hover:ring-accent"
              aria-label={`${current.relatedMovie} details`}
            >
              <Image src={poster} alt="" fill sizes="48px" className="object-cover" />
            </Link>
          )}
          <WatchlistButton item={summaryOf(current)} appearance="icon" />
          <IconButton label={`${current.relatedMovie} details`} icon={<Info />} variant="overlay" round href={detailHref} />
          <IconButton
            label="Open on YouTube (new tab)"
            icon={<ExternalLink />}
            variant="overlay"
            round
            href={`https://www.youtube.com/shorts/${current.videoId}`}
            target="_blank"
            rel="noopener noreferrer"
          />
          <div className="mt-2 flex flex-col gap-2 md:hidden">
            <IconButton label="Previous short" icon={<ChevronUp />} variant="secondary" round onClick={() => go(-1)} disabled={pos === 0} />
            <IconButton
              label="Next short"
              icon={<ChevronDown />}
              variant="secondary"
              round
              onClick={() => go(1)}
              disabled={pos >= total - 1}
            />
          </div>
        </div>
      </div>

      {/* Title info under the player */}
      <div
        key={current.videoId}
        className={cn(
          'pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-ground via-ground/80 to-transparent px-gutter pb-4 pt-16 md:hidden',
          !reducedMotion && 'animate-fade-in',
        )}
      >
        <InfoBlock short={current} year={year} />
      </div>
      <div className="absolute bottom-6 left-gutter hidden max-w-xs md:block xl:max-w-sm">
        <InfoBlock short={current} year={year} />
      </div>
    </section>
  );
}

function InfoBlock({ short, year }: { short: YTShort; year: string }) {
  return (
    <div className="space-y-1.5">
      <p className="flex flex-wrap items-center gap-2 text-micro text-fg-secondary">
        <span className="rounded-chip bg-surface-2 px-1.5 py-0.5 font-medium">{short.relatedMovieType === 'tv' ? 'TV' : 'Film'}</span>
        {year && <span className="tabular">{year}</span>}
        <Rating value={short.relatedMovieRating} size="sm" variant="plain" />
      </p>
      <p className="text-body font-semibold text-fg line-clamp-1">{short.relatedMovie}</p>
      <p className="text-caption text-fg-secondary line-clamp-2">{short.title}</p>
      <p className="text-micro text-fg-muted line-clamp-1">{short.channelTitle}</p>
    </div>
  );
}
