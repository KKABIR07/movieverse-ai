import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { reviewLikes } from '@/lib/db/schema';
import { getReviewView } from '@/lib/db/reviews';
import { requireSession } from '@/lib/db/auth';
import { PG, notFound, pgSqlState } from '@/lib/server/errors';
import { json, readJson, withHandler } from '@/lib/server/http';
import { reviewLikeSchema } from '@/lib/server/validation';
import { toReviewDTO } from '@/lib/server/dto';

/** POST /api/reviews/like  (auth) body { id: uuid, like: boolean } → { review: ReviewDTO } · 404 (idempotent) */
export const POST = withHandler('reviews.like', async (req) => {
  const s = await requireSession(req);
  const { id, like } = await readJson(req, reviewLikeSchema);
  const db = getDb();
  if (like) {
    try {
      await db.insert(reviewLikes).values({ reviewId: id, userId: s.userId }).onConflictDoNothing();
    } catch (err) {
      if (pgSqlState(err) === PG.FOREIGN_KEY_VIOLATION) throw notFound('Review not found.');
      throw err;
    }
  } else {
    await db.delete(reviewLikes).where(and(eq(reviewLikes.reviewId, id), eq(reviewLikes.userId, s.userId)));
  }
  const view = await getReviewView(db, id, s.userId);
  if (!view) throw notFound('Review not found.');
  return json({ review: toReviewDTO(view, s.userId) });
});
