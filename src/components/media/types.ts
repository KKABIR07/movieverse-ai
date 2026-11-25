import type { KnownForItem, Movie, SearchMultiResult, TVShow, WatchlistItem } from '@/types/tmdb';
import type { MediaType } from '@/store/watchlistLogic';

export type { MediaType };

/** Normalised shape every media component renders from. */
export interface MediaSummary {
  id: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  /** release_date / first_air_date */
  date: string | null;
  rating: number | null;
  voteCount: number | null;
  overview: string;
  genreIds: number[];
}

/** Anything TMDB hands us for a movie or a show. */
export type MediaInput =
  | Movie
  | TVShow
  | (SearchMultiResult & { media_type: 'movie' | 'tv' })
  | KnownForItem
  | WatchlistItem
  | MediaSummary;

interface LooseMedia {
  id?: number;
  title?: string;
  name?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  overview?: string;
  genre_ids?: number[];
}

function isSummary(x: MediaInput): x is MediaSummary {
  return 'mediaType' in x && 'posterPath' in x;
}

/** Infer movie vs tv: explicit override > media_type field > title (movie) / name (tv). */
export function inferMediaType(item: MediaInput, override?: MediaType): MediaType {
  if (override) return override;
  if (isSummary(item)) return item.mediaType;
  const mt = (item as { media_type?: string }).media_type;
  if (mt === 'movie' || mt === 'tv') return mt;
  if ('first_air_date' in item || ('name' in item && !('title' in item))) return 'tv';
  return 'movie';
}

export function toMediaSummary(item: MediaInput, override?: MediaType): MediaSummary {
  if (isSummary(item)) return override ? { ...item, mediaType: override } : item;
  // A loose read-only view: intersecting the TMDB types collapses to `never` because their
  // `media_type` literals conflict, so describe just the fields we read.
  const r = item as LooseMedia;
  const mediaType = inferMediaType(item, override);
  return {
    id: r.id as number,
    mediaType,
    title: (mediaType === 'tv' ? (r.name ?? r.title) : (r.title ?? r.name)) ?? 'Untitled',
    posterPath: r.poster_path ?? null,
    backdropPath: r.backdrop_path ?? null,
    date: (mediaType === 'tv' ? (r.first_air_date ?? r.release_date) : (r.release_date ?? r.first_air_date)) || null,
    rating: typeof r.vote_average === 'number' ? r.vote_average : null,
    voteCount: typeof r.vote_count === 'number' ? r.vote_count : null,
    overview: r.overview ?? '',
    genreIds: Array.isArray(r.genre_ids) ? r.genre_ids : [],
  };
}

export function mediaHref(m: Pick<MediaSummary, 'id' | 'mediaType'>): string {
  return m.mediaType === 'tv' ? `/tv/${m.id}` : `/movie/${m.id}`;
}

/** Shape the watchlist store expects. */
export function toWatchlistItem(m: MediaSummary): Omit<WatchlistItem, 'addedAt'> {
  return {
    id: m.id,
    title: m.title,
    poster_path: m.posterPath,
    release_date: m.date ?? '',
    vote_average: m.rating ?? 0,
    media_type: m.mediaType,
  };
}
