import { connectDB } from '@/lib/db/mongoose';
import { Review, type IReview } from '@/lib/db/models';
import { requireSession } from '@/lib/db/auth';
import { notFound } from '@/lib/server/errors';
import { json, readJson, withHandler } from '@/lib/server/http';
import { reviewLikeSchema } from '@/lib/server/validation';
import { toReviewDTO } from '@/lib/server/dto';

/** POST /api/reviews/like  (auth) body { id: ObjectId, like: boolean } → { review: ReviewDTO } · 404 */
export const POST = withHandler('reviews.like', async (req) => {
  const s = await requireSession(req);
  const { id, like } = await readJson(req, reviewLikeSchema);
  await connectDB();
  const doc = await Review.findByIdAndUpdate(
    id,
    like ? { $addToSet: { likedBy: s.userId } } : { $pull: { likedBy: s.userId } },
    { returnDocument: 'after' },
  ).lean<IReview>();
  if (!doc) throw notFound('Review not found.');
  return json({ review: toReviewDTO(doc, s.userId) });
});
