import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { count, eq } from 'drizzle-orm';
import { startDb, stopDb, resetDb, makeReq, createUser, db } from './helpers';
import { GET, POST, DELETE } from '@/app/api/reviews/route';
import { POST as LIKE } from '@/app/api/reviews/like/route';
import { reviews, reviewLikes } from '@/lib/db/schema';
import { mapError } from '@/lib/server/http';

const reviewCount = async (movieId?: number) =>
  (await db.select({ n: count() }).from(reviews).where(movieId ? eq(reviews.movieId, movieId) : undefined))[0].n;

beforeAll(startDb);
afterAll(stopDb);
beforeEach(resetDb);

const review = { movieId: 550, movieTitle: 'Fight Club', moviePoster: '/p.jpg', rating: 9, content: 'First rule…', spoiler: false };

describe('/api/reviews', () => {
  it('POST requires a session', async () => {
    expect((await POST(makeReq('/api/reviews', { body: review }), undefined)).status).toBe(401);
  });

  it('POST creates (201), then upserts the same user’s review (200) — one per user per movie', async () => {
    const { cookie } = await createUser('Tyler Durden');
    const r1 = await POST(makeReq('/api/reviews', { body: review, cookie }), undefined);
    expect(r1.status).toBe(201);
    const { review: dto } = await r1.json();
    expect(dto).toMatchObject({ movieId: 550, rating: 9, userName: 'Tyler Durden', userInitials: 'TD', likeCount: 0, isMine: true });
    expect(dto).not.toHaveProperty('userId');
    expect(dto).not.toHaveProperty('likedBy');

    const r2 = await POST(makeReq('/api/reviews', { body: { ...review, rating: 3, content: 'Changed my mind' }, cookie }), undefined);
    expect(r2.status).toBe(200);
    expect((await r2.json()).review).toMatchObject({ id: dto.id, rating: 3, content: 'Changed my mind' });
    expect(await reviewCount(550)).toBe(1);
  });

  it('unique constraint enforces one review per user per movie at the DB level (23505 → 409)', async () => {
    const { user } = await createUser();
    const row = { movieId: 550, movieTitle: 'Fight Club', userId: user.id, rating: 5, content: 'x' };
    await db.insert(reviews).values(row);
    const err = await db.insert(reviews).values(row).catch((e: unknown) => e);
    expect(err).toMatchObject({ cause: expect.objectContaining({ code: '23505', constraint: 'reviews_user_movie_key' }) });
    expect(mapError(err)).toMatchObject({ status: 409, body: { code: 'CONFLICT' } });
  });

  it('CHECK constraints mirror zod limits (23514 → 400) and bad uuids (22P02 → 400)', async () => {
    const { user } = await createUser();
    const base = { movieId: 1, movieTitle: 'T', userId: user.id, rating: 5, content: 'ok' };
    for (const bad of [{ rating: 0 }, { rating: 11 }, { content: '' }, { content: 'x'.repeat(2001) }, { movieId: 0 }, { movieTitle: 'x'.repeat(301) }]) {
      const err = await db.insert(reviews).values({ ...base, ...bad }).catch((e: unknown) => e);
      expect(err).toMatchObject({ cause: expect.objectContaining({ code: '23514' }) });
      expect(mapError(err).status).toBe(400);
    }
    const bad = await db.select().from(reviews).where(eq(reviews.id, 'not-a-uuid')).catch((e: unknown) => e);
    expect(mapError(bad)).toMatchObject({ status: 400, body: { code: 'BAD_REQUEST' } });
  });

  it('like counts are computed in SQL across many users; likes cascade with the review', async () => {
    const author = await createUser('Author');
    const { review: dto } = await (await POST(makeReq('/api/reviews', { body: review, cookie: author.cookie }), undefined)).json();
    const fans = await Promise.all([1, 2, 3].map((i) => createUser(`Fan ${i}`)));
    for (const f of fans) await LIKE(makeReq('/api/reviews/like', { body: { id: dto.id, like: true }, cookie: f.cookie }), undefined);
    const asAuthor = (await (await GET(makeReq('/api/reviews?movieId=550', { cookie: author.cookie }), undefined)).json()).reviews[0];
    expect(asAuthor).toMatchObject({ likeCount: 3, likedByMe: false, isMine: true });
    const anon = (await (await GET(makeReq('/api/reviews?movieId=550'), undefined)).json()).reviews[0];
    expect(anon).toMatchObject({ likeCount: 3, likedByMe: false, isMine: false });

    // editing keeps id and likes
    const edited = await (await POST(makeReq('/api/reviews', { body: { ...review, rating: 2 }, cookie: author.cookie }), undefined)).json();
    expect(edited.review).toMatchObject({ id: dto.id, likeCount: 3, rating: 2 });
    expect(new Date(edited.review.updatedAt) >= new Date(edited.review.createdAt)).toBe(true);

    await DELETE(makeReq(`/api/reviews?id=${dto.id}`, { method: 'DELETE', cookie: author.cookie }), undefined);
    expect((await db.select({ n: count() }).from(reviewLikes))[0].n).toBe(0);
  });

  it('POST 400s: rating range/int, content length, poster path, operator payloads', async () => {
    const { cookie } = await createUser();
    for (const b of [
      { ...review, rating: 11 },
      { ...review, rating: 0 },
      { ...review, rating: 5.5 },
      { ...review, content: 'x'.repeat(2001) },
      { ...review, content: '' },
      { ...review, moviePoster: '"><script>' },
      { ...review, movieId: { $gt: 0 } },
      { ...review, content: { $ne: '' } },
    ]) {
      expect((await POST(makeReq('/api/reviews', { body: b, cookie }), undefined)).status).toBe(400);
    }
  });

  it('GET is public, validates movieId, returns DTOs without user ids, newest first', async () => {
    const a = await createUser('A');
    const b = await createUser('B');
    await POST(makeReq('/api/reviews', { body: review, cookie: a.cookie }), undefined);
    await new Promise((r) => setTimeout(r, 5));
    await POST(makeReq('/api/reviews', { body: { ...review, rating: 5 }, cookie: b.cookie }), undefined);

    expect((await GET(makeReq('/api/reviews?movieId=abc'), undefined)).status).toBe(400);
    expect((await GET(makeReq('/api/reviews'), undefined)).status).toBe(400);

    const anon = await GET(makeReq('/api/reviews?movieId=550'), undefined);
    expect(anon.status).toBe(200);
    expect(anon.headers.get('Cache-Control')).toContain('public');
    const { reviews } = await anon.json();
    expect(reviews.map((r: { userName: string }) => r.userName)).toEqual(['B', 'A']);
    expect(JSON.stringify(reviews)).not.toMatch(/"userId"|"likedBy"/);
    expect(reviews.every((r: { isMine: boolean; likedByMe: boolean }) => !r.isMine && !r.likedByMe)).toBe(true);

    const mine = await (await GET(makeReq('/api/reviews?movieId=550', { cookie: a.cookie }), undefined)).json();
    expect(mine.reviews.find((r: { userName: string }) => r.userName === 'A').isMine).toBe(true);
  });

  it('likes: likeCount + likedByMe, idempotent, toggle off', async () => {
    const a = await createUser('A');
    const b = await createUser('B');
    const { review: dto } = await (await POST(makeReq('/api/reviews', { body: review, cookie: a.cookie }), undefined)).json();
    for (let i = 0; i < 2; i++) await LIKE(makeReq('/api/reviews/like', { body: { id: dto.id, like: true }, cookie: b.cookie }), undefined);
    const list = await (await GET(makeReq('/api/reviews?movieId=550', { cookie: b.cookie }), undefined)).json();
    expect(list.reviews[0]).toMatchObject({ likeCount: 1, likedByMe: true });
    const off = await (await LIKE(makeReq('/api/reviews/like', { body: { id: dto.id, like: false }, cookie: b.cookie }), undefined)).json();
    expect(off.review).toMatchObject({ likeCount: 0, likedByMe: false });
    expect((await LIKE(makeReq('/api/reviews/like', { body: { id: randomUUID(), like: true }, cookie: b.cookie }), undefined)).status).toBe(404);
    expect((await LIKE(makeReq('/api/reviews/like', { body: { id: dto.id, like: true } }), undefined)).status).toBe(401);
  });

  it('DELETE: owner only (IDOR → 403), 404 unknown, 400 bad uuid, 401 anon', async () => {
    const a = await createUser('A');
    const b = await createUser('B');
    const { review: dto } = await (await POST(makeReq('/api/reviews', { body: review, cookie: a.cookie }), undefined)).json();

    expect((await DELETE(makeReq(`/api/reviews?id=${dto.id}`, { method: 'DELETE' }), undefined)).status).toBe(401);
    expect((await DELETE(makeReq(`/api/reviews?id=${dto.id}`, { method: 'DELETE', cookie: b.cookie }), undefined)).status).toBe(403);
    expect(await reviewCount()).toBe(1);
    expect((await DELETE(makeReq('/api/reviews?id=not-an-id', { method: 'DELETE', cookie: a.cookie }), undefined)).status).toBe(400);
    expect((await DELETE(makeReq(`/api/reviews?id=${randomUUID()}`, { method: 'DELETE', cookie: a.cookie }), undefined)).status).toBe(404);
    expect((await DELETE(makeReq(`/api/reviews?id=${dto.id}`, { method: 'DELETE', cookie: a.cookie }), undefined)).status).toBe(200);
    expect(await reviewCount()).toBe(0);
  });
});
