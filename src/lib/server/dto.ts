/**
 * Response DTOs — the only shapes that leave the API. Internal ids (userId, likedBy) never leak.
 */
import type { IChatMessage, IFollow, IReview } from '@/lib/db/models';

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

const iso = (d: Date | string | undefined) => (d ? new Date(d).toISOString() : new Date(0).toISOString());

export function toReviewDTO(r: IReview, viewerId?: string): ReviewDTO {
  const likedBy = Array.isArray(r.likedBy) ? r.likedBy.map(String) : [];
  return {
    id: r._id.toString(),
    movieId: r.movieId,
    movieTitle: r.movieTitle,
    moviePoster: r.moviePoster ?? null,
    userName: r.userName,
    userInitials: r.userInitials,
    rating: r.rating,
    content: r.content,
    spoiler: Boolean(r.spoiler),
    likeCount: likedBy.length,
    likedByMe: viewerId ? likedBy.includes(viewerId) : false,
    isMine: viewerId ? r.userId?.toString() === viewerId : false,
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
  };
}

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

export function toChatDTO(m: IChatMessage, viewerId?: string): ChatMessageDTO {
  return {
    id: m._id.toString(),
    roomId: m.roomId,
    userName: m.userName,
    userInitials: m.userInitials,
    color: m.color,
    text: m.text,
    createdAt: iso(m.createdAt),
    isMine: viewerId ? m.userId?.toString() === viewerId : false,
  };
}

export interface FollowDTO {
  personId: number;
  personName: string;
  personImage: string | null;
  department: string;
  followedAt: string;
}

export function toFollowDTO(f: IFollow): FollowDTO {
  return {
    personId: f.personId,
    personName: f.personName,
    personImage: f.personImage ?? null,
    department: f.department ?? 'Acting',
    followedAt: iso(f.followedAt),
  };
}
