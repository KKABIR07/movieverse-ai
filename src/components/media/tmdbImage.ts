import type { ImageLoader } from 'next/image';

/**
 * next/image loaders that request TMDB's own pre-sized renditions straight from
 * its CDN (no /_next/image re-encoding, no Vercel optimisation cost).
 * Pass the TMDB *path* ("/abc.jpg") as `src`.
 */
const CDN = 'https://image.tmdb.org/t/p';

const pick = (width: number, steps: readonly [number, string][], fallback: string) =>
  steps.find(([w]) => width <= w)?.[1] ?? fallback;

/** Posters: w185 / w342 / w500 (w780 for very large slots). */
export const tmdbPosterLoader: ImageLoader = ({ src, width }) =>
  `${CDN}/${pick(width, [[185, 'w185'], [342, 'w342'], [500, 'w500']], 'w780')}${src}`;

/** Backdrops: w300 / w780 / w1280 / original. */
export const tmdbBackdropLoader: ImageLoader = ({ src, width }) =>
  `${CDN}/${pick(width, [[300, 'w300'], [780, 'w780'], [1280, 'w1280']], 'original')}${src}`;

/** Profile photos: w45 / w185 / h632. */
export const tmdbProfileLoader: ImageLoader = ({ src, width }) =>
  `${CDN}/${pick(width, [[45, 'w45'], [185, 'w185']], 'h632')}${src}`;

/** Logos (company / network / title treatments): w92 / w185 / w300 / w500. */
export const tmdbLogoLoader: ImageLoader = ({ src, width }) =>
  `${CDN}/${pick(width, [[92, 'w92'], [185, 'w185'], [300, 'w300']], 'w500')}${src}`;

/** Plain URL helper when you need a string (og:image, CSS background). */
export function tmdbUrl(path: string | null | undefined, size: string = 'w500'): string | null {
  return path ? `${CDN}/${size}${path}` : null;
}

/** `sizes` presets matching the shell's grids and rails. */
export const POSTER_SIZES = {
  /** MediaGrid: 2 → 3 → 4 → 5 → 6 columns */
  grid: '(min-width: 1280px) 16vw, (min-width: 1024px) 20vw, (min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw',
  /** Rail poster cards: clamp(140px, 38vw, 200px) */
  rail: '(min-width: 640px) 200px, 38vw',
  /** Small thumbs (search results, lists) */
  thumb: '56px',
  /** Detail page poster */
  detail: '(min-width: 768px) 300px, 50vw',
} as const;
