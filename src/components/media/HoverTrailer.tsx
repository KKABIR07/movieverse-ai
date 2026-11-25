'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { loadTrailerKey, prefersSaveData } from '@/lib/media/trailers';
import { useCanHover } from '@/lib/hooks/useMediaQuery';
import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';
import { BackgroundTrailer } from './BackgroundTrailer';
import type { MediaType } from './types';

/** Hover this long before the trailer is fetched/mounted, so sweeping across a rail doesn't start players. */
export const HOVER_DELAY_MS = 500;

/**
 * Hover-to-preview state for one poster: after HOVER_DELAY_MS of pointer hover the title's trailer
 * key is looked up (cached) and returned; leaving clears it, which unmounts the player.
 * Inert on touch screens, with prefers-reduced-motion, with Save-Data, or when `enabled` is false.
 */
export function useHoverTrailer(id: number, mediaType: MediaType, enabled = true) {
  const canHover = useCanHover();
  const reducedMotion = usePrefersReducedMotion();
  const active = enabled && canHover && !reducedMotion;
  const [trailer, setTrailer] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hovering = useRef(false);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const onPointerEnter = () => {
    if (!active || prefersSaveData()) return;
    hovering.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const key = await loadTrailerKey(id, mediaType);
      if (hovering.current && key) setTrailer(key);
    }, HOVER_DELAY_MS);
  };
  const onPointerLeave = () => {
    hovering.current = false;
    if (timer.current) clearTimeout(timer.current);
    setTrailer(null);
  };

  return { trailer, handlers: { onPointerEnter, onPointerLeave } };
}

const Ctx = createContext<{ trailer: string | null; title: string } | null>(null);

/** Hover area for server-rendered cards: wrap the card, put <HoverTrailerSlot/> inside the poster box. */
export function HoverTrailerZone({
  id,
  mediaType,
  title,
  className,
  children,
}: {
  id: number;
  mediaType: MediaType;
  title: string;
  className?: string;
  children: ReactNode;
}) {
  const { trailer, handlers } = useHoverTrailer(id, mediaType);
  return (
    <div className={className} {...handlers}>
      <Ctx.Provider value={{ trailer, title }}>{children}</Ctx.Provider>
    </div>
  );
}

/** Renders the zone's trailer (if any) over the nearest positioned ancestor. */
export function HoverTrailerSlot() {
  const v = useContext(Ctx);
  if (!v?.trailer) return null;
  return <BackgroundTrailer videoKey={v.trailer} title={`${v.title} trailer preview`} className="hover-only" />;
}
