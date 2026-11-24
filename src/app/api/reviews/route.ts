import { connectDB } from '@/lib/db/mongoose';
import { Review, type IReview } from '@/lib/db/models';
import { getOptionalSession, requireSession } from '@/lib/db/auth';
import { forbidden, notFound } from '@/lib/server/errors';
import { json, readJson, readQuery, withHandler } from '@/lib/server/http';
import { reviewCreateSchema, reviewDeleteQuery, reviewsQuery } from '@/lib/server/validation';
import { toReviewDTO } from '@/lib/server/dto';

/**
 * GET /api/reviews?movieId=<int>  (public) → { reviews: ReviewDTO[] } newest first, max 50.
 * Signed-in callers additionally get likedByMe / isMine computed for them.
 */
export const GET = withHandler('reviews.GET', async (req) => {
  const { movieId } = readQuery(req, reviewsQuery);
  const session = await getOptionalSession(req);
  await connectDB();
  const docs = await Review.find({ movieId }).sort({ createdAt: -1 }).limit(50).lean<IReview[]>();
  return json(
    { reviews: docs.map((d) => toReviewDTO(d, session?.userId)) },
    {
      headers: session
        ? { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }
        : { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60', Vary: 'Cookie' },
    },
  );
});

/**
 * POST /api/reviews  (auth) body { movieId, movieTitle, moviePoster?, rating 1..10, content ≤2000, spoiler? }
 * One review per user per movie: creates (201) or replaces the caller's existing review (200).
 */
export const POST = withHandler('reviews.POST', async (req) => {
  const s = await requireSession(req);
  const input = await readJson(req, reviewCreateSchema);
  await connectDB();

  const res = await Review.findOneAndUpdate(
    { movieId: input.movieId, userId: s.userId },
    {
      $set: {
        movieTitle: input.movieTitle,
        moviePoster: input.moviePoster,
        rating: input.rating,
        content: input.content,
        spoiler: input.spoiler,
        userName: s.name,
        userInitials: s.initials,
      },
      $setOnInsert: { movieId: input.movieId, userId: s.userId, likedBy: [] },
    },
    { upsert: true, returnDocument: 'after', runValidators: true, includeResultMetadata: true, lean: true },
  );
  const doc = res.value as IReview | null;
  if (!doc) throw new Error('review upsert returned no document');
  const created = !res.lastErrorObject?.updatedExisting;
  return json({ review: toReviewDTO(doc, s.userId) }, { status: created ? 201 : 200 });
});

/** DELETE /api/reviews?id=<ObjectId>  (auth, owner only) → { ok: true } · 403 not owner · 404 */
export const DELETE = withHandler('reviews.DELETE', async (req) => {
  const s = await requireSession(req);
  const { id } = readQuery(req, reviewDeleteQuery);
  await connectDB();
  const { deletedCount } = await Review.deleteOne({ _id: id, userId: s.userId });
  if (deletedCount === 1) return json({ ok: true });
  const exists = await Review.exists({ _id: id });
  throw exists ? forbidden('You can only delete your own reviews.') : notFound('Review not found.');
});
