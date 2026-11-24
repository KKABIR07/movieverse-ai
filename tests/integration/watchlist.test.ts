import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startDb, stopDb, resetDb, makeReq, createUser } from './helpers';
import { GET, POST, DELETE } from '@/app/api/watchlist/route';
import { Watchlist } from '@/lib/db/models';
import { WATCHLIST_MAX_ITEMS } from '@/lib/server/validation';

beforeAll(startDb);
afterAll(stopDb);
beforeEach(resetDb);

const movie = { id: 550, media_type: 'movie', title: 'Fight Club', poster_path: '/a.jpg', vote_average: 8.4, release_date: '1999-10-15' };
const tv = { id: 550, media_type: 'tv', name: 'Some Show', poster_path: null, first_air_date: '2010-01-01' };

describe('/api/watchlist', () => {
  it('401 without session', async () => {
    expect((await GET(makeReq('/api/watchlist'), undefined)).status).toBe(401);
    expect((await POST(makeReq('/api/watchlist', { body: movie }), undefined)).status).toBe(401);
    expect((await DELETE(makeReq('/api/watchlist', { method: 'DELETE', body: movie }), undefined)).status).toBe(401);
  });

  it('adds with whitelisted fields, newest first; same id different media_type are distinct', async () => {
    const { cookie } = await createUser();
    const r1 = await POST(makeReq('/api/watchlist', { body: { ...movie, $where: 'sleep(1)', userId: 'x', extra: 1 }, cookie }), undefined);
    expect(r1.status).toBe(201);
    const r2 = await POST(makeReq('/api/watchlist', { body: tv, cookie }), undefined);
    const { items } = await r2.json();
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ id: 550, media_type: 'tv', name: 'Some Show' });
    expect(items[1]).toMatchObject({ id: 550, media_type: 'movie', title: 'Fight Club', poster_path: '/a.jpg' });
    expect(Object.keys(items[1]).sort()).toEqual(
      ['addedAt', 'backdrop_path', 'id', 'media_type', 'poster_path', 'release_date', 'title', 'vote_average'].sort(),
    );
    const res = await GET(makeReq('/api/watchlist', { cookie }), undefined);
    expect((await res.json()).items).toHaveLength(2);
  });

  it('dedupes by id + media_type (idempotent 200)', async () => {
    const { cookie } = await createUser();
    await POST(makeReq('/api/watchlist', { body: movie, cookie }), undefined);
    const again = await POST(makeReq('/api/watchlist', { body: movie, cookie }), undefined);
    expect(again.status).toBe(200);
    expect((await again.json()).items).toHaveLength(1);
  });

  it('400 for legacy mediaType field, bad ids and operator payloads', async () => {
    const { cookie } = await createUser();
    for (const b of [
      { id: 550, mediaType: 'movie' },
      { id: -1, media_type: 'movie' },
      { id: { $gt: 0 }, media_type: 'movie' },
      { id: 1, media_type: 'person' },
      { id: 1, media_type: 'movie', poster_path: 'http://evil/x.png' },
    ]) {
      expect((await POST(makeReq('/api/watchlist', { body: b, cookie }), undefined)).status).toBe(400);
    }
  });

  it(`caps at ${WATCHLIST_MAX_ITEMS} items (409 WATCHLIST_FULL)`, async () => {
    const { cookie, user } = await createUser();
    const items = Array.from({ length: WATCHLIST_MAX_ITEMS }, (_, i) => ({
      id: i + 1,
      media_type: 'movie' as const,
      poster_path: null,
      backdrop_path: null,
      vote_average: 0,
      addedAt: new Date().toISOString(),
    }));
    await Watchlist.create({ userId: user.id, items });
    const res = await POST(makeReq('/api/watchlist', { body: { ...movie, id: 999999 }, cookie }), undefined);
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('WATCHLIST_FULL');
    // an item already present is still a no-op 200, not 409
    expect((await POST(makeReq('/api/watchlist', { body: { id: 1, media_type: 'movie' }, cookie }), undefined)).status).toBe(200);
  });

  it('DELETE removes by id + media_type (body or query)', async () => {
    const { cookie } = await createUser();
    await POST(makeReq('/api/watchlist', { body: movie, cookie }), undefined);
    await POST(makeReq('/api/watchlist', { body: tv, cookie }), undefined);
    const r = await DELETE(makeReq('/api/watchlist', { method: 'DELETE', body: { id: 550, media_type: 'movie' }, cookie }), undefined);
    expect((await r.json()).items).toEqual([expect.objectContaining({ media_type: 'tv' })]);
    const q = await DELETE(makeReq('/api/watchlist?id=550&media_type=tv', { method: 'DELETE', cookie }), undefined);
    expect((await q.json()).items).toEqual([]);
    expect((await DELETE(makeReq('/api/watchlist?id=abc&media_type=tv', { method: 'DELETE', cookie }), undefined)).status).toBe(400);
  });

  it('IDOR: user A cannot read or modify user B’s watchlist', async () => {
    const a = await createUser('A');
    const b = await createUser('B');
    await POST(makeReq('/api/watchlist', { body: movie, cookie: b.cookie }), undefined);
    // A's view is empty and A's delete does not touch B
    expect((await (await GET(makeReq('/api/watchlist', { cookie: a.cookie }), undefined)).json()).items).toEqual([]);
    await DELETE(makeReq('/api/watchlist', { method: 'DELETE', body: { id: 550, media_type: 'movie' }, cookie: a.cookie }), undefined);
    // userId in the body is ignored
    await POST(makeReq('/api/watchlist', { body: { ...tv, userId: b.user.id }, cookie: a.cookie }), undefined);
    const bItems = (await (await GET(makeReq('/api/watchlist', { cookie: b.cookie }), undefined)).json()).items;
    expect(bItems).toHaveLength(1);
    expect(bItems[0].media_type).toBe('movie');
  });
});
