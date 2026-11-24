import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startDb, stopDb, resetDb, makeReq, createUser } from './helpers';
import { GET as chatGet, POST as chatPost } from '@/app/api/chat/route';
import { GET as followsGet, POST as followsPost, DELETE as followsDelete } from '@/app/api/follows/route';
import { GET as counts } from '@/app/api/follows/counts/route';
import { ChatMessage, CHAT_TTL_SECONDS, Follow } from '@/lib/db/models';

beforeAll(startDb);
afterAll(stopDb);
beforeEach(resetDb);

describe('/api/chat', () => {
  it('POST requires a session; GET is public read-only', async () => {
    expect((await chatPost(makeReq('/api/chat', { body: { text: 'hi' } }), undefined)).status).toBe(401);
    const res = await chatGet(makeReq('/api/chat?roomId=general'), undefined);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ messages: [] });
  });

  it('validates room enum and text length', async () => {
    const { cookie } = await createUser();
    for (const b of [{ roomId: 'admin', text: 'x' }, { text: '' }, { text: 'x'.repeat(501) }, { text: { $gt: '' } }]) {
      expect((await chatPost(makeReq('/api/chat', { body: b, cookie }), undefined)).status).toBe(400);
    }
    expect((await chatGet(makeReq('/api/chat?roomId=hackers'), undefined)).status).toBe(400);
    expect((await chatGet(makeReq('/api/chat?after=yesterday'), undefined)).status).toBe(400);
  });

  it('returns latest 50 oldest→newest, no userId, isMine for the author, `after` cursor', async () => {
    const a = await createUser('Alice');
    const b = await createUser('Bob');
    const posted = await chatPost(makeReq('/api/chat', { body: { roomId: 'movies', text: '  hello  ' }, cookie: a.cookie }), undefined);
    expect(posted.status).toBe(201);
    const { message } = await posted.json();
    expect(message).toMatchObject({ roomId: 'movies', text: 'hello', userName: 'Alice', isMine: true });
    expect(message).not.toHaveProperty('userId');

    const base = Date.now() - 60_000;
    await ChatMessage.insertMany(
      Array.from({ length: 60 }, (_, i) => ({
        roomId: 'movies',
        userId: b.user.id,
        userName: 'Bob',
        userInitials: 'B',
        color: '#fff',
        text: `m${i}`,
        createdAt: new Date(base + i * 100),
      })),
    );

    const list = await (await chatGet(makeReq('/api/chat?roomId=movies', { cookie: b.cookie }), undefined)).json();
    expect(list.messages).toHaveLength(50);
    expect(list.messages.at(-1).text).toBe('hello'); // newest last
    expect(list.messages[0].text).toBe('m11'); // 61 total → oldest 11 dropped
    expect(JSON.stringify(list)).not.toContain('userId');
    expect(list.messages.at(-1).isMine).toBe(false);
    expect(list.messages[0].isMine).toBe(true);

    const anon = await (await chatGet(makeReq('/api/chat?roomId=movies'), undefined)).json();
    expect(anon.messages.every((m: { isMine: boolean }) => m.isMine === false)).toBe(true);

    const after = new Date(base + 58 * 100).toISOString();
    const delta = await (await chatGet(makeReq(`/api/chat?roomId=movies&after=${encodeURIComponent(after)}`), undefined)).json();
    expect(delta.messages.map((m: { text: string }) => m.text)).toEqual(['m59', 'hello']);

    // other rooms are isolated
    expect((await (await chatGet(makeReq('/api/chat?roomId=general'), undefined)).json()).messages).toEqual([]);
  });

  it('has a 30-day TTL index on createdAt', async () => {
    const idx = await ChatMessage.collection.indexes();
    expect(idx.find((i) => i.key.createdAt === 1 && Object.keys(i.key).length === 1)?.expireAfterSeconds).toBe(CHAT_TTL_SECONDS);
    expect(CHAT_TTL_SECONDS).toBe(30 * 24 * 3600);
  });
});

describe('/api/follows', () => {
  const brad = { personId: 287, personName: 'Brad Pitt', personImage: '/brad.jpg', department: 'Acting' };

  it('auth required for list/follow/unfollow', async () => {
    expect((await followsGet(makeReq('/api/follows'), undefined)).status).toBe(401);
    expect((await followsPost(makeReq('/api/follows', { body: brad }), undefined)).status).toBe(401);
    expect((await followsDelete(makeReq('/api/follows', { method: 'DELETE', body: { personId: 287 } }), undefined)).status).toBe(401);
  });

  it('follow is idempotent, counts update, list hides userId', async () => {
    const a = await createUser();
    const b = await createUser();
    const r1 = await followsPost(makeReq('/api/follows', { body: brad, cookie: a.cookie }), undefined);
    expect(await r1.json()).toEqual({ success: true, followerCount: 1 });
    const r2 = await followsPost(makeReq('/api/follows', { body: brad, cookie: a.cookie }), undefined);
    expect((await r2.json()).followerCount).toBe(1);
    await followsPost(makeReq('/api/follows', { body: brad, cookie: b.cookie }), undefined);

    const list = await (await followsGet(makeReq('/api/follows', { cookie: a.cookie }), undefined)).json();
    expect(list.following).toEqual([
      expect.objectContaining({ personId: 287, personName: 'Brad Pitt', personImage: '/brad.jpg', department: 'Acting' }),
    ]);
    expect(JSON.stringify(list)).not.toMatch(/userId|_id/);

    const c = await counts(makeReq('/api/follows/counts?ids=287,1'), undefined);
    expect(c.headers.get('Cache-Control')).toContain('s-maxage=60');
    expect(await c.json()).toEqual({ counts: { 287: 2 } });

    const del = await followsDelete(makeReq('/api/follows', { method: 'DELETE', body: { personId: 287 }, cookie: a.cookie }), undefined);
    expect((await del.json()).followerCount).toBe(1);
    expect(await Follow.countDocuments({ personId: 287 })).toBe(1); // B's follow untouched (IDOR-safe)
  });

  it('validation: personId int > 0, string maxes, image path, operators', async () => {
    const { cookie } = await createUser();
    for (const b of [
      { ...brad, personId: 0 },
      { ...brad, personId: '287' },
      { ...brad, personId: { $gt: 0 } },
      { ...brad, personName: 'x'.repeat(201) },
      { ...brad, department: 'x'.repeat(51) },
      { ...brad, personImage: 'https://evil/x.jpg' },
    ]) {
      expect((await followsPost(makeReq('/api/follows', { body: b, cookie }), undefined)).status).toBe(400);
    }
  });

  it('counts: missing ids → {}, invalid → 400, >100 → 400', async () => {
    expect(await (await counts(makeReq('/api/follows/counts'), undefined)).json()).toEqual({ counts: {} });
    expect((await counts(makeReq('/api/follows/counts?ids=1,abc'), undefined)).status).toBe(400);
    const many = Array.from({ length: 101 }, (_, i) => i + 1).join(',');
    expect((await counts(makeReq(`/api/follows/counts?ids=${many}`), undefined)).status).toBe(400);
  });
});
