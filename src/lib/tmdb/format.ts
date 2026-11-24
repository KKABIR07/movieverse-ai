/**
 * Image URL helpers + display formatters. Pure and isomorphic (safe in server and client components).
 */

export const IMAGE_BASE = 'https://image.tmdb.org/t/p';

export type PosterSize = 'w92' | 'w154' | 'w185' | 'w342' | 'w500' | 'w780' | 'original';
export type BackdropSize = 'w300' | 'w780' | 'w1280' | 'original';
export type ProfileSize = 'w45' | 'w185' | 'h632' | 'original';

const VALID_PATH = /^\/[\w.-]+$/;

export const tmdbImage = (path: string | null | undefined, size: PosterSize | string = 'w500'): string => {
  if (!path || !VALID_PATH.test(path)) return '/placeholder-poster.svg';
  return `${IMAGE_BASE}/${size}${path}`;
};

/** Backdrops default to w1280 (≈250 KB) instead of `original` (often 2-5 MB). */
export const tmdbBackdrop = (path: string | null | undefined, size: BackdropSize | string = 'w1280'): string => {
  if (!path || !VALID_PATH.test(path)) return '/placeholder-backdrop.svg';
  return `${IMAGE_BASE}/${size}${path}`;
};

export const tmdbProfile = (path: string | null | undefined, size: ProfileSize | string = 'w185'): string => {
  if (!path || !VALID_PATH.test(path)) return '/placeholder-poster.svg';
  return `${IMAGE_BASE}/${size}${path}`;
};

export const tmdbLogo = (path: string | null | undefined, size: string = 'w92'): string | null => {
  if (!path || !VALID_PATH.test(path)) return null;
  return `${IMAGE_BASE}/${size}${path}`;
};

interface VideoLike {
  type: string;
  site: string;
  key: string;
  official?: boolean;
}

export const getTrailerKey = (videos: { results?: VideoLike[] } | undefined | null): string | null => {
  const list = videos?.results;
  if (!list?.length) return null;
  const yt = list.filter((v) => v.site === 'YouTube' && typeof v.key === 'string');
  const trailer =
    yt.find((v) => v.type === 'Trailer' && v.official) ?? yt.find((v) => v.type === 'Trailer') ?? yt.find((v) => v.type === 'Teaser') ?? yt[0];
  return trailer?.key ?? null;
};

export const formatRuntime = (minutes: number | null | undefined): string => {
  if (!minutes || !Number.isFinite(minutes) || minutes <= 0) return 'N/A';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

/** "2019-10-02" → "2019". String-based, so no timezone can shift it to 2018. */
export const formatYear = (dateStr: string | null | undefined): string => {
  if (!dateStr || !/^\d{4}/.test(dateStr)) return 'N/A';
  return dateStr.slice(0, 4);
};

/** "2019-10-02" → "Oct 2, 2019" rendered in UTC (identical on server and client). */
export const formatDate = (
  dateStr: string | null | undefined,
  opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' },
): string => {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return 'N/A';
  const d = new Date(`${dateStr.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });
};

export const formatRating = (rating: number | null | undefined): string => {
  if (typeof rating !== 'number' || !Number.isFinite(rating) || rating <= 0) return 'N/A';
  return rating.toFixed(1);
};

export const getRatingColor = (rating: number | null | undefined): string => {
  const r = typeof rating === 'number' && Number.isFinite(rating) ? rating : 0;
  if (r >= 7.5) return '#22c55e';
  if (r >= 6) return '#f59e0b';
  if (r >= 4) return '#f97316';
  return '#ef4444';
};
