import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { count, eq, sql } from 'drizzle-orm';
import { startDb, stopDb, resetDb, makeReq, createUser, db } from './helpers';
import { GET as chatGet, POST as chatPost } from '@/app/api/chat/route';
import { GET as followsGet, POST as followsPost, DELETE as followsDelete } from '@/app/api/follows/route';
import { GET as counts } from '@/app/api/follows/counts/route';
import { chatMessages, CHAT_RETENTION_DAYS, follows } from '@/lib/db/schema';
import { maybeSweep, resetSweepThrottle, sweepChatMessages } from '@/lib/db/maintenance';
import { mapError } from '@/lib/server/http';

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
    await db.insert(chatMessages).values(
      Array.from({ length: 60 }, (_, i) => ({
        roomId: 'movies' as const,
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

  it('`after` cursor round-trips exactly (no duplicate on the next poll)', async () => {
    const { cookie } = await createUser();
    const { message } = await (await chatPost(makeReq('/api/chat', { body: { text: 'one' }, cookie }), undefined)).json();
    const next = await (await chatGet(makeReq(`/api/chat?after=${encodeURIComponent(message.createdAt)}`), undefined)).json();
    expect(next.messages).toEqual([]);
  });

  it('30-day retention sweep removes only expired messages', async () => {
    expect(CHAT_RETENTION_DAYS).toBe(30);
    const { user } = await createUser();
    const day = 24 * 3600 * 1000;
    const mk = (text: string, ageMs: number) => ({
      roomId: 'general' as const,
      userId: user.id,
      userName: 'U',
      userInitials: 'U',
      color: '#fff',
      text,
      createdAt: new Date(Date.now() - ageMs),
    });
    await db.insert(chatMessages).values([mk('old', 31 * day), mk('edge-old', 30 * day + 60_000), mk('recent', 29 * day), mk('new', 0)]);
    expect(await sweepChatMessages(db)).toBe(2);
    const left = await db.select({ text: chatMessages.text }).from(chatMessages);
    expect(left.map((r) => r.text).sort()).toEqual(['new', 'recent']);

    // opportunistic sweep: p=1 runs once, then is throttled
    await db.insert(chatMessages).values(mk('old2', 40 * day));
    resetSweepThrottle();
    maybeSweep('chat', db, 1);
    await vi.waitFor(async () => expect((await db.select({ n: count() }).from(chatMessages))[0].n).toBe(2));
    await db.insert(chatMessages).values(mk('old3', 40 * day));
    maybeSweep('chat', db, 1); // throttled (< 60 s since last run)
    await new Promise((r) => setTimeout(r, 50));
    expect((await db.select({ n: count() }).from(chatMessages))[0].n).toBe(3);
  });

  it('DB rejects unknown rooms and oversize text (CHECK → 400)', async () => {
    const { user } = await createUser();
    const base = { userId: user.id, userName: 'U', userInitials: 'U', color: '#fff', text: 'x' };
    for (const bad of [
      { roomId: 'admin' as never },
      { roomId: 'general' as const, text: 'x'.repeat(501) },
      { roomId: 'general' as const, text: '' },
    ]) {
      const err = await db.insert(chatMessages).values({ ...base, ...bad }).catch((e: unknown) => e);
      expect(mapError(err).status).toBe(400);
    }
    const fk = await db
      .insert(chatMessages)
      .values({ ...base, roomId: 'general', userId: '00000000-0000-4000-8000-000000000000' })
      .catch((e: unknown) => e);
    expect(mapError(fk)).toMatchObject({ status: 404 });
    expect(await db.execute(sql`select 1`)).toBeTruthy();
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
    const [{ n }] = await db.select({ n: count() }).from(follows).where(eq(follows.personId, 287));
    expect(n).toBe(1); // B's follow untouched (IDOR-safe)
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
