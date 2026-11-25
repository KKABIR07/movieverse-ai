/**
 * Response DTOs — the only shapes that leave the API. Internal ids (user ids, like rows) never leak.
 */
import type { ChatMessageRow, FollowRow, WatchlistItemRow } from '@/lib/db/schema';

const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : new Date(0).toISOString());

// ─── Reviews ──────────────────────────────────────────────────────────────────
export interface ReviewDTO {
  id: string;
  movieId: number;
  movieTitle: string;
  moviePoster: string | null;
  userName: string;
  userInitials: string;
  rating: number;
  content: string;
  spoiler: boolean;
  likeCount: number;
  likedByMe: boolean;
  isMine: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A review row joined with its author and like aggregates (see src/lib/db/queries/reviews.ts). */
export interface ReviewView {
  id: string;
  movieId: number;
  movieTitle: string;
  moviePoster: string | null;
  userId: string;
  userName: string;
  userInitials: string;
  rating: number;
  content: string;
  spoiler: boolean;
  likeCount: number;
  likedByMe: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function toReviewDTO(r: ReviewView, viewerId?: string): ReviewDTO {
  return {
    id: r.id,
    movieId: r.movieId,
    movieTitle: r.movieTitle,
    moviePoster: r.moviePoster ?? null,
    userName: r.userName,
    userInitials: r.userInitials,
    rating: r.rating,
    content: r.content,
    spoiler: Boolean(r.spoiler),
    likeCount: Number(r.likeCount) || 0,
    likedByMe: viewerId ? Boolean(r.likedByMe) : false,
    isMine: viewerId ? r.userId === viewerId : false,
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
  };
}

// ─── Chat ─────────────────────────────────────────────────────────────────────
export interface ChatMessageDTO {
  id: string;
  roomId: string;
  userName: string;
  userInitials: string;
  color: string;
  text: string;
  createdAt: string;
  isMine: boolean;
}

export function toChatDTO(m: ChatMessageRow, viewerId?: string): ChatMessageDTO {
  return {
    id: m.id,
    roomId: m.roomId,
    userName: m.userName,
    userInitials: m.userInitials,
    color: m.color,
    text: m.text,
    createdAt: iso(m.createdAt),
    isMine: viewerId ? m.userId === viewerId : false,
  };
}

// ─── Follows ──────────────────────────────────────────────────────────────────
export interface FollowDTO {
  personId: number;
  personName: string;
  personImage: string | null;
  department: string;
  followedAt: string;
}

export function toFollowDTO(f: Pick<FollowRow, 'personId' | 'personName' | 'personImage' | 'department' | 'createdAt'>): FollowDTO {
  return {
    personId: f.personId,
    personName: f.personName,
    personImage: f.personImage ?? null,
    department: f.department ?? 'Acting',
    followedAt: iso(f.createdAt),
  };
}

// ─── Watchlist ────────────────────────────────────────────────────────────────
/** Wire shape of a watchlist item (TMDB-like keys; optional keys are omitted when unset). */
export interface WatchlistItemDTO {
  id: number;
  media_type: 'movie' | 'tv';
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  addedAt: string;
}

export function toWatchlistDTO(r: Omit<WatchlistItemRow, 'userId'>): WatchlistItemDTO {
  const item: WatchlistItemDTO = {
    id: r.tmdbId,
    media_type: r.mediaType,
    poster_path: r.posterPath ?? null,
    backdrop_path: r.backdropPath ?? null,
    // real (float4) → round to the precision TMDB uses so 8.4 doesn't come back as 8.399999618530273
    vote_average: Math.round(r.voteAverage * 1000) / 1000,
    addedAt: iso(r.addedAt),
  };
  if (r.title) item.title = r.title;
  if (r.name) item.name = r.name;
  if (r.releaseDate !== null && r.releaseDate !== undefined) item.release_date = r.releaseDate;
  if (r.firstAirDate !== null && r.firstAirDate !== undefined) item.first_air_date = r.firstAirDate;
  return item;
}
