/**
 * TMDB image URLs for next/image.
 *
 * next.config.ts wires a global `images.loaderFile` (src/lib/image-loader.ts) that rewrites any
 * `https://image.tmdb.org/t/p/<size>/<file>` URL to the TMDB CDN bucket that best fits the width
 * the browser asks for (w92…w1280/original). No server-side optimisation happens, so components
 * just pass a full TMDB URL plus an accurate `sizes` attribute and the loader picks
 * w185 / w342 / w500 etc. from the srcset.
 */
const CDN = 'https://image.tmdb.org/t/p';

/** Full TMDB URL for a path, or null. `size` is only the fallback when no loader runs. */
export function tmdbUrl(path: string | null | undefined, size: string = 'w500'): string | null {
  return path ? `${CDN}/${size}${path}` : null;
}

export const posterSrc = (path: string | null | undefined) => tmdbUrl(path, 'w500');
export const backdropSrc = (path: string | null | undefined) => tmdbUrl(path, 'w1280');
export const profileSrc = (path: string | null | undefined) => tmdbUrl(path, 'w185');

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
