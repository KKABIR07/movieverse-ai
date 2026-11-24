import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startDb, stopDb, resetDb, makeReq, createUser } from './helpers';
import { GET, POST, DELETE } from '@/app/api/reviews/route';
import { POST as LIKE } from '@/app/api/reviews/like/route';
import { Review } from '@/lib/db/models';

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
    expect(await Review.countDocuments({ movieId: 550 })).toBe(1);
  });

  it('unique index enforces one review per user per movie at the DB level', async () => {
    const { user } = await createUser();
    const doc = { ...review, userId: user.id, userName: 'x', userInitials: 'X' };
    await Review.create(doc);
    await expect(Review.create(doc)).rejects.toMatchObject({ code: 11000 });
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
    expect((await LIKE(makeReq('/api/reviews/like', { body: { id: '507f1f77bcf86cd799439011', like: true }, cookie: b.cookie }), undefined)).status).toBe(404);
    expect((await LIKE(makeReq('/api/reviews/like', { body: { id: dto.id, like: true } }), undefined)).status).toBe(401);
  });

  it('DELETE: owner only (IDOR → 403), 404 unknown, 400 bad ObjectId, 401 anon', async () => {
    const a = await createUser('A');
    const b = await createUser('B');
    const { review: dto } = await (await POST(makeReq('/api/reviews', { body: review, cookie: a.cookie }), undefined)).json();

    expect((await DELETE(makeReq(`/api/reviews?id=${dto.id}`, { method: 'DELETE' }), undefined)).status).toBe(401);
    expect((await DELETE(makeReq(`/api/reviews?id=${dto.id}`, { method: 'DELETE', cookie: b.cookie }), undefined)).status).toBe(403);
    expect(await Review.countDocuments()).toBe(1);
    expect((await DELETE(makeReq('/api/reviews?id=not-an-id', { method: 'DELETE', cookie: a.cookie }), undefined)).status).toBe(400);
    expect((await DELETE(makeReq('/api/reviews?id=507f1f77bcf86cd799439011', { method: 'DELETE', cookie: a.cookie }), undefined)).status).toBe(404);
    expect((await DELETE(makeReq(`/api/reviews?id=${dto.id}`, { method: 'DELETE', cookie: a.cookie }), undefined)).status).toBe(200);
    expect(await Review.countDocuments()).toBe(0);
  });
});
