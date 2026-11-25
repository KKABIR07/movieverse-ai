'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type FocusEvent } from 'react';
import { ChevronRight, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { Backdrop } from '@/components/media/Backdrop';
import { BackgroundTrailer } from '@/components/media/BackgroundTrailer';
import { loadTrailerKey, playerCommand, prefersSaveData, YT_EMBED_ORIGIN } from '@/lib/media/trailers';
import { WatchlistButton } from '@/components/media/WatchlistButton';
import { mediaHref, type MediaSummary } from '@/components/media/types';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Rating } from '@/components/ui/Rating';
import { cn } from '@/components/ui/cn';
import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';
import { TrailerDialog, type TrailerTarget } from './TrailerDialog';

export interface HeroSlide extends MediaSummary {
  year: string;
  genreNames: string[];
}

const INTERVAL_MS = 8000;
/** How long a slide stays when its trailer is playing behind it. */
const TRAILER_SLIDE_MS = 45_000;
const noopSubscribe = () => () => {};

/**
 * Home hero: rotates through the week's top trending titles.
 * - Auto-advance only without prefers-reduced-motion; pauses on hover / keyboard focus and while
 *   the trailer dialog is open; explicit Pause / Play control.
 * - Only the first backdrop is preloaded (LCP); later backdrops mount just before they are shown.
 * - The current slide's trailer plays muted behind the text (fades in over the backdrop); the slide then
 *   stays TRAILER_SLIDE_MS. Sound can be turned on (which holds the slide). No background video with
 *   reduced motion, Save-Data, a paused slideshow, or while the trailer dialog is open.
 * - "Play trailer" opens the full trailer with sound in a dialog.
 */
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const count = slides.length;
  const reducedMotion = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<'auto' | 'paused' | 'playing'>('auto');
  const [interacting, setInteracting] = useState(false);
  const [trailer, setTrailer] = useState<TrailerTarget | null>(null);
  const [mounted, setMounted] = useState<ReadonlySet<number>>(() => new Set([0]));
  const [keys, setKeys] = useState<Readonly<Record<number, string | null>>>({});
  const saveData = useSyncExternalStore(noopSubscribe, prefersSaveData, () => false);
  // Visibility / sound belong to one slide's player: stored as "<index>:<key>" tokens, so moving to
  // another slide (a fresh, muted player) resets them without an effect.
  const [visibleToken, setVisibleToken] = useState<string | null>(null);
  const [soundToken, setSoundToken] = useState<string | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);

  const playing = count > 1 && (choice === 'playing' || (choice === 'auto' && !reducedMotion));
  const bgVideo = !reducedMotion && !saveData && choice !== 'paused' && !trailer;
  const bgKey = bgVideo ? keys[index] ?? null : null;
  const token = bgKey ? `${index}:${bgKey}` : null;
  const videoVisible = token !== null && visibleToken === token;
  const sound = token !== null && soundToken === token;
  const advancing = playing && !interacting && !trailer && !sound;

  // look up the current slide's trailer, and warm the next one
  useEffect(() => {
    if (!count || reducedMotion) return;
    let live = true;
    for (const i of [index, (index + 1) % count]) {
      if (i in keys) continue;
      const s = slides[i];
      void loadTrailerKey(s.id, s.mediaType).then((k) => {
        if (live) setKeys((m) => (i in m ? m : { ...m, [i]: k }));
      });
    }
    return () => {
      live = false;
    };
  }, [index, count, slides, keys, reducedMotion]);

  const toggleSound = () => {
    const next = !sound;
    frame.current?.contentWindow?.postMessage(playerCommand(next ? 'unMute' : 'mute'), YT_EMBED_ORIGIN);
    setSoundToken(next ? token : null);
  };
  const onVideoVisible = useCallback(() => setVisibleToken(token), [token]);
  /** The background player is about to unmount (dialog / pause): it comes back hidden and muted. */
  const resetPlayer = () => {
    setVisibleToken(null);
    setSoundToken(null);
  };

  const go = useCallback(
    (i: number) => {
      const next = ((i % count) + count) % count;
      setMounted((s) => (s.has(next) ? s : new Set(s).add(next)));
      setIndex(next);
    },
    [count],
  );

  // auto-advance
  useEffect(() => {
    if (!advancing) return;
    const t = setTimeout(() => go(index + 1), bgKey ? TRAILER_SLIDE_MS : INTERVAL_MS);
    return () => clearTimeout(t);
  }, [advancing, index, go, bgKey]);

  // warm the next backdrop a little before it is needed (never competes with the LCP image)
  useEffect(() => {
    if (count < 2) return;
    const next = (index + 1) % count;
    const t = setTimeout(() => setMounted((s) => (s.has(next) ? s : new Set(s).add(next))), 2500);
    return () => clearTimeout(t);
  }, [index, count]);

  if (!count) return null;
  const slide = slides[index];

  const onBlur = (e: FocusEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setInteracting(false);
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Trending this week"
      className="relative px-gutter pt-3 md:-mt-[var(--header-h)] md:px-0 md:pt-0"
      onPointerEnter={(e) => e.pointerType === 'mouse' && setInteracting(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setInteracting(false)}
      onFocus={(e) => {
        // pause for keyboard users (focus-visible), not after every mouse click
        if ((e.target as HTMLElement).matches?.(':focus-visible')) setInteracting(true);
      }}
      onBlur={onBlur}
    >
      <div className="relative isolate flex min-h-[500px] flex-col justify-end overflow-hidden rounded-hero bg-surface-1 md:min-h-[min(80vh,820px)] md:rounded-none">
        {slides.map((s, i) =>
          mounted.has(i) ? (
            <div
              key={`${s.mediaType}:${s.id}`}
              aria-hidden={i !== index}
              className={cn(
                'absolute inset-0 -z-10 transition-opacity duration-700 ease-projector motion-reduce:transition-none',
                i === index ? 'opacity-100' : 'opacity-0',
              )}
            >
              <Backdrop
                path={s.backdropPath}
                preload={i === 0}
                scrim="hero"
                sizes="100vw"
                position="center 25%"
                media={
                  i === index && bgKey ? (
                    <BackgroundTrailer
                      key={bgKey}
                      videoKey={bgKey}
                      title={`${s.title} trailer`}
                      frameRef={frame}
                      onVisible={onVideoVisible}
                    />
                  ) : null
                }
              />
            </div>
          ) : null,
        )}

        <div className="relative px-5 pb-6 pt-40 md:px-gutter md:pb-16 md:pt-[calc(var(--header-h)+120px)]">
          <div aria-live={advancing ? 'off' : 'polite'}>
          <div
            key={index}
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${count}`}
            className="max-w-2xl animate-fade-in"
          >
            <p className="text-micro font-semibold uppercase tracking-[0.1em] text-accent">
              #{index + 1} trending this week
            </p>
            <h2
              className={cn(
                'mt-3 line-clamp-2 text-fg text-balance',
                slide.title.length > 26 ? 'text-h1' : 'text-display',
              )}
            >
              {slide.title}
            </h2>
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-caption text-fg-secondary tabular">
              <Rating value={slide.rating} voteCount={slide.voteCount} variant="chip" size="md" />
              {slide.year && <span>{slide.year}</span>}
              <span>{slide.mediaType === 'tv' ? 'TV series' : 'Movie'}</span>
              {slide.genreNames.slice(0, 2).map((g, i) => (
                <span key={g} className={cn("before:mr-3 before:text-fg-muted before:content-['·']", i > 0 && 'max-sm:hidden')}>
                  {g}
                </span>
              ))}
            </div>
            {slide.overview && (
              <p className="mt-4 line-clamp-2 max-w-xl text-body text-fg-secondary text-pretty md:line-clamp-3 md:text-body-lg">
                {slide.overview}
              </p>
            )}
            <div className="mt-6 flex flex-wrap items-center gap-2 md:gap-3">
              <Button
                size="lg"
                leadingIcon={<Play className="fill-current" />}
                onClick={() => {
                  resetPlayer();
                  setTrailer({ id: slide.id, mediaType: slide.mediaType, title: slide.title });
                }}
              >
                Play trailer
              </Button>
              <WatchlistButton item={slide} appearance="button" size="lg" />
              <Button href={mediaHref(slide)} variant="ghost" size="lg" trailingIcon={<ChevronRight />}>
                More info<span className="sr-only">: {slide.title}</span>
              </Button>
            </div>
          </div>
          </div>

          {(count > 1 || (bgKey && videoVisible)) && (
            <div className="mt-6 flex items-center gap-1 md:absolute md:bottom-16 md:right-[var(--gutter)] md:mt-0">
              {bgKey && videoVisible && (
                <IconButton
                  variant="overlay"
                  size="md"
                  round
                  label={sound ? 'Mute trailer' : 'Unmute trailer'}
                  pressed={sound}
                  icon={sound ? <Volume2 /> : <VolumeX />}
                  onClick={toggleSound}
                />
              )}
              {count > 1 && (<>
              <div role="group" aria-label="Choose slide" className="flex items-center">
                {slides.map((s, i) => (
                  <button
                    key={`${s.mediaType}:${s.id}`}
                    type="button"
                    onClick={() => go(i)}
                    aria-label={`Show slide ${i + 1}: ${s.title}`}
                    aria-current={i === index ? 'true' : undefined}
                    className="group grid size-11 place-items-center rounded-full"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'block h-1.5 rounded-full transition-[width,background-color] duration-200',
                        i === index ? 'w-6 bg-accent' : 'w-1.5 bg-fg/40 group-hover:bg-fg/70',
                      )}
                    />
                  </button>
                ))}
              </div>
              <IconButton
                variant="overlay"
                size="md"
                round
                label={playing ? 'Pause slideshow' : 'Play slideshow'}
                icon={playing ? <Pause /> : <Play />}
                onClick={() => {
                  if (playing) resetPlayer();
                  setChoice(playing ? 'paused' : 'playing');
                }}
              />
              </>)}
            </div>
          )}
        </div>
      </div>

      <TrailerDialog target={trailer} onClose={() => setTrailer(null)} />
    </section>
  );
}
