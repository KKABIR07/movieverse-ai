'use client';

import { useEffect, useRef, useState, type Ref } from 'react';
import { backgroundEmbedUrl } from '@/lib/media/trailers';
import { useHydrated } from '@/lib/hooks/useHydrated';
import { cn } from '@/components/ui/cn';

/** Time between the iframe's load event and fading it in: hides YouTube's spinner/title flash. */
const FADE_IN_AFTER_LOAD_MS = 1200;

export interface BackgroundTrailerProps {
  videoKey: string;
  /** Accessible name of the (aria-hidden) frame, e.g. "Dune trailer". */
  title: string;
  /** Extra zoom so YouTube's top title bar / corner logo fall outside the frame (1 = exact cover). */
  zoom?: number;
  frameRef?: Ref<HTMLIFrameElement>;
  onVisible?: () => void;
  className?: string;
}

/**
 * Muted, looping YouTube trailer used as moving artwork. Fills its positioned parent like
 * `object-fit: cover` for any aspect ratio (container units), never takes pointer events or focus,
 * and stays transparent until the player has had time to start — the poster/backdrop underneath
 * shows until then.
 */
export function BackgroundTrailer({ videoKey, title, zoom = 1.15, frameRef, onVisible, className }: BackgroundTrailerProps) {
  const [visible, setVisible] = useState(false);
  const hydrated = useHydrated();
  const origin = hydrated ? window.location.origin : undefined;
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    };
  }, []);
  useEffect(() => {
    if (visible) onVisible?.();
  }, [visible, onVisible]);

  const src = origin ? backgroundEmbedUrl(videoKey, origin) : null;
  if (!src) return null;

  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0 overflow-hidden [container-type:size]', className)}>
      <iframe
        ref={frameRef}
        title={title}
        tabIndex={-1}
        src={src}
        allow="autoplay; encrypted-media"
        referrerPolicy="strict-origin-when-cross-origin"
        onLoad={() => {
          if (fadeTimer.current) clearTimeout(fadeTimer.current);
          fadeTimer.current = setTimeout(() => setVisible(true), FADE_IN_AFTER_LOAD_MS);
        }}
        style={{
          width: 'max(100cqw, 177.78cqh)',
          height: 'max(100cqh, 56.25cqw)',
          transform: `translate(-50%, -50%) scale(${zoom})`,
        }}
        className={cn(
          'absolute left-1/2 top-1/2 border-0 transition-opacity duration-700 ease-projector',
          visible ? 'opacity-100' : 'opacity-0',
        )}
      />
    </div>
  );
}
