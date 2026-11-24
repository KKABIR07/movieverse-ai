'use client';

/**
 * Custom next/image loader (wired via `images.loaderFile` in next.config.ts).
 *
 * Goal: ZERO server-side image processing. The production box has a 1 GB RAM cap, so we never
 * let Next run sharp or keep an on-disk optimization cache. Instead:
 *  - TMDB images are re-pointed at the TMDB CDN size bucket that best fits the requested width
 *    (TMDB already serves pre-resized JPEG/PNG renditions).
 *  - Local `/public` assets and YouTube thumbnails are returned unchanged.
 */

export type ImageLoaderParams = { src: string; width: number; quality?: number };

/** TMDB CDN widths, ascending. Anything wider than the last bucket is served as `original`. */
export const TMDB_WIDTH_BUCKETS = [92, 154, 185, 342, 500, 780, 1280] as const;

const TMDB_PREFIX = /^https?:\/\/image\.tmdb\.org\/t\/p\/([a-z0-9_]+)(\/.+)$/i;

/** Pick the smallest TMDB bucket that is at least `width` px wide (or `original`). */
export function tmdbSizeForWidth(width: number): string {
  if (!Number.isFinite(width) || width <= 0) return `w${TMDB_WIDTH_BUCKETS[0]}`;
  for (const bucket of TMDB_WIDTH_BUCKETS) {
    if (bucket >= width) return `w${bucket}`;
  }
  return 'original';
}

export default function imageLoader({ src, width }: ImageLoaderParams): string {
  const match = TMDB_PREFIX.exec(src);
  if (!match) {
    // Local assets (`/...`), data/blob URIs and YouTube thumbnails (i.ytimg.com / img.youtube.com)
    // are served as-is — no optimizer in the path.
    return src;
  }
  const [, , filePath] = match;
  return `https://image.tmdb.org/t/p/${tmdbSizeForWidth(width)}${filePath}`;
}
