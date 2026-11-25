/**
 * Reviews API client (`/api/reviews`) + client-side validation mirroring the server rules.
 */
import { apiJson, type FetchLike } from './http';

export interface Review {
  id: string;
  movieId: number;
  movieTitle: string;
  moviePoster: string | null;
  userName: string;
  userInitials: string;
  /** 1..10 */
  rating: number;
  content: string;
  spoiler: boolean;
  likeCount: number;
  likedByMe: boolean;
  isMine: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewInput {
  movieId: number;
  movieTitle: string;
  moviePoster?: string | null;
  rating: number;
  content: string;
  spoiler?: boolean;
}

export const REVIEW_MIN = 1;
export const REVIEW_MAX = 2000;

export interface ReviewErrors {
  rating?: string;
  content?: string;
}

/** Same limits as the server: integer rating 1..10, trimmed content 1..2000 chars. */
export function validateReview(input: { rating: number; content: string }): ReviewErrors {
  const errors: ReviewErrors = {};
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 10) {
    errors.rating = 'Choose a rating from 1 to 10.';
  }
  const len = input.content.trim().length;
  if (len < REVIEW_MIN) errors.content = 'Write a few words about the title.';
  else if (len > REVIEW_MAX) errors.content = `Keep it under ${REVIEW_MAX.toLocaleString('en-US')} characters (${len.toLocaleString('en-US')} now).`;
  return errors;
}

export const reviewsKey = (movieId: number) => ['reviews', movieId] as const;

export function createReviewsApi(fetchImpl?: FetchLike) {
  return {
    list: async (movieId: number, signal?: AbortSignal) =>
      (await apiJson<{ reviews?: Review[] }>(`/api/reviews?movieId=${encodeURIComponent(movieId)}`, { signal }, fetchImpl))
        .reviews ?? [],
    save: (input: ReviewInput) =>
      apiJson<{ review?: Review }>(
        '/api/reviews',
        {
          method: 'POST',
          body: { ...input, content: input.content.trim(), spoiler: !!input.spoiler, moviePoster: input.moviePoster ?? undefined },
        },
        fetchImpl,
      ),
    remove: (id: string) => apiJson<unknown>(`/api/reviews?id=${encodeURIComponent(id)}`, { method: 'DELETE' }, fetchImpl),
    like: async (id: string, like: boolean) =>
      (await apiJson<{ review: Review }>('/api/reviews/like', { method: 'POST', body: { id, like } }, fetchImpl)).review,
  };
}

export const reviewsApi = createReviewsApi();
