import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { reviews } from '@/lib/db/schema';
import { getReviewView, listMovieReviews } from '@/lib/db/reviews';
import { getOptionalSession, requireSession } from '@/lib/db/auth';
import { forbidden, notFound } from '@/lib/server/errors';
import { json, readJson, readQuery, withHandler } from '@/lib/server/http';
import { reviewCreateSchema, reviewDeleteQuery, reviewsQuery } from '@/lib/server/validation';
import { toReviewDTO } from '@/lib/server/dto';

const PAGE = 50;

/**
 * GET /api/reviews?movieId=<int>  (public) → { reviews: ReviewDTO[] } newest first, max 50.
 * Signed-in callers additionally get likedByMe / isMine computed for them.
 */
export const GET = withHandler('reviews.GET', async (req) => {
  const { movieId } = readQuery(req, reviewsQuery);
  const session = await getOptionalSession(req);
  const rows = await listMovieReviews(getDb(), movieId, session?.userId, PAGE);
  return json(
    { reviews: rows.map((r) => toReviewDTO(r, session?.userId)) },
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
 * Likes survive an edit (the row id is stable).
 */
export const POST = withHandler('reviews.POST', async (req) => {
  const s = await requireSession(req);
  const input = await readJson(req, reviewCreateSchema);
  const db = getDb();

  const [res] = await db
    .insert(reviews)
    .values({
      movieId: input.movieId,
      userId: s.userId,
      movieTitle: input.movieTitle,
      moviePoster: input.moviePoster,
      rating: input.rating,
      content: input.content,
      spoiler: input.spoiler,
    })
    .onConflictDoUpdate({
      target: [reviews.userId, reviews.movieId],
      set: {
        movieTitle: sql`excluded.movie_title`,
        moviePoster: sql`excluded.movie_poster`,
        rating: sql`excluded.rating`,
        content: sql`excluded.content`,
        spoiler: sql`excluded.spoiler`,
        updatedAt: sql`now()`,
      },
    })
    // xmax = 0 only for a freshly inserted tuple → distinguishes create (201) from update (200)
    .returning({ id: reviews.id, inserted: sql<boolean>`(xmax = 0)` });

  const view = await getReviewView(db, res.id, s.userId);
  if (!view) throw new Error('review upsert returned no row');
  return json({ review: toReviewDTO(view, s.userId) }, { status: res.inserted ? 201 : 200 });
});

/** DELETE /api/reviews?id=<uuid>  (auth, owner only) → { ok: true } · 403 not owner · 404 */
export const DELETE = withHandler('reviews.DELETE', async (req) => {
  const s = await requireSession(req);
  const { id } = readQuery(req, reviewDeleteQuery);
  const db = getDb();
  const deleted = await db
    .delete(reviews)
    .where(and(eq(reviews.id, id), eq(reviews.userId, s.userId)))
    .returning({ id: reviews.id });
  if (deleted.length === 1) return json({ ok: true });
  const [exists] = await db.select({ id: reviews.id }).from(reviews).where(eq(reviews.id, id)).limit(1);
  throw exists ? forbidden('You can only delete your own reviews.') : notFound('Review not found.');
});
