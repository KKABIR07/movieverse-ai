'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';
import { cn } from '@/components/ui/cn';
import { tmdbBackdropLoader } from './tmdbImage';

export type ScrimKind = 'bottom' | 'left' | 'hero' | 'full' | 'none';

const scrims: Record<ScrimKind, ReactNode> = {
  none: null,
  bottom: <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ground via-ground/40 to-transparent" />,
  left: <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-ground via-ground/60 to-transparent" />,
  full: <div aria-hidden className="absolute inset-0 bg-ground/70" />,
  hero: (
    <>
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ground via-ground/50 to-ground/10" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-ground/90 via-ground/40 to-transparent max-md:hidden" />
      <div aria-hidden className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-ground/70 to-transparent" />
    </>
  ),
};

export interface BackdropProps {
  /** TMDB backdrop path ("/abc.jpg"). Null renders a plain surface. */
  path: string | null | undefined;
  /** Empty for decorative images (default). */
  alt?: string;
  /** Preload — set ONLY on the page's LCP hero. */
  preload?: boolean;
  sizes?: string;
  scrim?: ScrimKind;
  /** object-position, e.g. "center 20%". */
  position?: string;
  className?: string;
}

/**
 * Absolutely-filled backdrop image + gradient scrims. Parent must be `relative`.
 * @example <div className="relative aspect-video"><Backdrop path={m.backdrop_path} scrim="bottom" /></div>
 */
export function Backdrop({ path, alt = '', preload = false, sizes = '100vw', scrim = 'bottom', position, className }: BackdropProps) {
  return (
    <div className={cn('absolute inset-0 overflow-hidden bg-surface-1', className)}>
      {path && (
        <Image
          loader={tmdbBackdropLoader}
          src={path}
          alt={alt}
          fill
          sizes={sizes}
          preload={preload}
          className="object-cover"
          style={position ? { objectPosition: position } : undefined}
        />
      )}
      {scrims[scrim]}
    </div>
  );
}

export interface HeroFrameProps {
  backdropPath: string | null | undefined;
  /** Preload the backdrop (true for the first hero on a page). */
  preload?: boolean;
  /** Content anchored bottom-left (title, meta, CTAs). */
  children: ReactNode;
  /** Optional right/bottom slot, e.g. carousel dots. */
  aside?: ReactNode;
  /** Height preset. */
  height?: 'md' | 'lg' | 'full';
  position?: string;
  /** Accessible label for the region. */
  label?: string;
  className?: string;
}

const heights = {
  md: 'min-h-[56vh] md:min-h-[60vh]',
  lg: 'min-h-[68vh] md:min-h-[78vh]',
  full: 'min-h-[88svh]',
};

/**
 * Full-bleed hero that slides under the transparent header (it cancels the
 * layout's header padding with a negative margin).
 * @example
 * <HeroFrame backdropPath={m.backdrop_path} preload>
 *   <h1 className="text-display">{m.title}</h1>
 * </HeroFrame>
 */
export function HeroFrame({ backdropPath, preload, children, aside, height = 'lg', position, label, className }: HeroFrameProps) {
  return (
    <section
      aria-label={label}
      className={cn('relative isolate -mt-[var(--header-h)] flex flex-col justify-end overflow-hidden', heights[height], className)}
    >
      <Backdrop path={backdropPath} preload={preload} scrim="hero" position={position} className="-z-10" />
      <div className="relative px-gutter pb-10 pt-[calc(var(--header-h)+48px)] md:pb-16">
        <div className="max-w-2xl">{children}</div>
        {aside && <div className="mt-6 md:absolute md:bottom-16 md:right-[var(--gutter)] md:mt-0">{aside}</div>}
      </div>
    </section>
  );
}
