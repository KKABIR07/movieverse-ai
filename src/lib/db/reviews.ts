/**
 * Review read model: review row + author name/initials + likeCount + likedByMe, computed in SQL.
 */
import { desc, eq, sql, type SQL } from 'drizzle-orm';
import type { ReviewView } from '@/lib/server/dto';
import type { Db } from './client';
import { reviewLikes, reviews, users } from './schema';

function likedByMe(viewerId: string | undefined): SQL<boolean> {
  if (!viewerId) return sql<boolean>`false`;
  return sql<boolean>`exists (select 1 from ${reviewLikes} where ${reviewLikes.reviewId} = ${reviews.id} and ${reviewLikes.userId} = ${viewerId})`;
}

const likeCount = sql<number>`(select count(*) from ${reviewLikes} where ${reviewLikes.reviewId} = ${reviews.id})::int`;

function selectViews(db: Db, viewerId: string | undefined) {
  return db
    .select({
      id: reviews.id,
      movieId: reviews.movieId,
      movieTitle: reviews.movieTitle,
      moviePoster: reviews.moviePoster,
      userId: reviews.userId,
      userName: users.name,
      userInitials: users.initials,
      rating: reviews.rating,
      content: reviews.content,
      spoiler: reviews.spoiler,
      likeCount,
      likedByMe: likedByMe(viewerId),
      createdAt: reviews.createdAt,
      updatedAt: reviews.updatedAt,
    })
    .from(reviews)
    .innerJoin(users, eq(users.id, reviews.userId));
}

/** Newest-first reviews of a movie. */
export function listMovieReviews(db: Db, movieId: number, viewerId: string | undefined, limit: number): Promise<ReviewView[]> {
  return selectViews(db, viewerId)
    .where(eq(reviews.movieId, movieId))
    .orderBy(desc(reviews.createdAt), desc(reviews.id))
    .limit(limit);
}

/** One review by id, or null. */
export async function getReviewView(db: Db, id: string, viewerId: string | undefined): Promise<ReviewView | null> {
  const [row] = await selectViews(db, viewerId).where(eq(reviews.id, id)).limit(1);
  return row ?? null;
}
