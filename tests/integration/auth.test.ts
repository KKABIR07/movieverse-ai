import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { startDb, stopDb, resetDb, makeReq, sessionCookieFrom, createUser } from './helpers';
import { POST as signup } from '@/app/api/auth/signup/route';
import { POST as login } from '@/app/api/auth/login/route';
import { POST as logout } from '@/app/api/auth/logout/route';
import { POST as logoutAll } from '@/app/api/auth/logout-all/route';
import { GET as me } from '@/app/api/auth/me/route';
import { User } from '@/lib/db/models';
import { invalidateTokenVersionCache } from '@/lib/db/auth';
import * as mongooseMod from '@/lib/db/mongoose';
import { DatabaseUnavailableError } from '@/lib/server/errors';

beforeAll(startDb);
afterAll(stopDb);
beforeEach(resetDb);

const body = { name: '  Ada Lovelace ', email: ' Ada@Example.com ', password: 'correct-horse-battery' };

describe('POST /api/auth/signup', () => {
  it('201: creates user, sets hardened cookie, returns DTO without hash', async () => {
    const res = await signup(makeReq('/api/auth/signup', { body }), undefined);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.user).toMatchObject({ name: 'Ada Lovelace', email: 'ada@example.com', initials: 'AL', avatar: null });
    expect(JSON.stringify(json)).not.toMatch(/passwordHash|\$2[aby]\$/);
    const setCookie = res.headers.get('set-cookie')!;
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=lax/i);
    expect(setCookie).toMatch(/Path=\//);
    expect(setCookie).toMatch(/Max-Age=604800/);

    const stored = await User.findOne({ email: 'ada@example.com' }).select('+passwordHash').lean();
    expect(stored!.passwordHash.startsWith('$2')).toBe(true);
    expect(bcrypt.getRounds(stored!.passwordHash)).toBe(11);
  });

  it('409 on duplicate email (case-insensitive)', async () => {
    await signup(makeReq('/api/auth/signup', { body }), undefined);
    const res = await signup(makeReq('/api/auth/signup', { body: { ...body, email: 'ADA@example.com' } }), undefined);
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('EMAIL_TAKEN');
  });

  it('400 on invalid input', async () => {
    for (const b of [
      { ...body, password: 'short' },
      { ...body, name: '' },
      { ...body, email: 'nope' },
      { ...body, email: { $gt: '' } },
      {},
    ]) {
      expect((await signup(makeReq('/api/auth/signup', { body: b }), undefined)).status).toBe(400);
    }
    expect((await signup(makeReq('/api/auth/signup', { rawBody: '{oops', headers: { 'content-type': 'application/json' } }), undefined)).status).toBe(400);
  });

  it('413 on oversize payload', async () => {
    const res = await signup(makeReq('/api/auth/signup', { body: { ...body, pad: 'x'.repeat(70_000) } }), undefined);
    expect(res.status).toBe(413);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await signup(makeReq('/api/auth/signup', { body }), undefined);
  });

  it('200 + cookie for valid credentials (email normalised)', async () => {
    const res = await login(makeReq('/api/auth/login', { body: { email: 'ADA@example.com ', password: body.password } }), undefined);
    expect(res.status).toBe(200);
    expect((await res.json()).user.email).toBe('ada@example.com');
    expect(sessionCookieFrom(res)).toMatch(/^mv_token=/);
  });

  it('generic 401 for wrong password and unknown email (same message)', async () => {
    const a = await login(makeReq('/api/auth/login', { body: { email: 'ada@example.com', password: 'wrong-password' } }), undefined);
    const b = await login(makeReq('/api/auth/login', { body: { email: 'nobody@example.com', password: 'whatever1' } }), undefined);
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    const [ja, jb] = [await a.json(), await b.json()];
    expect(ja.error).toBe(jb.error);
    expect(ja.code).toBe('INVALID_CREDENTIALS');
  });

  it('unknown email still performs a bcrypt compare (timing-safe)', async () => {
    const spy = vi.spyOn(bcrypt, 'compare');
    await login(makeReq('/api/auth/login', { body: { email: 'nobody@example.com', password: 'whatever1' } }), undefined);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('400 for NoSQL injection payloads', async () => {
    const res = await login(makeReq('/api/auth/login', { body: { email: { $gt: '' }, password: { $gt: '' } } }), undefined);
    expect(res.status).toBe(400);
  });

  it('503 (not 401/500) when the database is unavailable', async () => {
    const spy = vi.spyOn(mongooseMod, 'connectDB').mockRejectedValueOnce(new DatabaseUnavailableError());
    const res = await login(makeReq('/api/auth/login', { body: { email: 'ada@example.com', password: body.password } }), undefined);
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe('DB_UNAVAILABLE');
    spy.mockRestore();
  });

  it('503 NOT_CONFIGURED when JWT_SECRET is too short', async () => {
    const old = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'too-short';
    const res = await login(makeReq('/api/auth/login', { body: { email: 'ada@example.com', password: body.password } }), undefined);
    process.env.JWT_SECRET = old;
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe('NOT_CONFIGURED');
  });
});

describe('GET /api/auth/me', () => {
  it('{user:null} without cookie', async () => {
    const res = await me(makeReq('/api/auth/me'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: null });
  });

  it('returns the user for a valid session', async () => {
    const { cookie, user } = await createUser('Grace Hopper');
    const res = await me(makeReq('/api/auth/me', { cookie }));
    const json = await res.json();
    expect(json.user).toMatchObject({ id: user.id, name: 'Grace Hopper', initials: 'GH' });
    expect(json.user.joinedAt).toMatch(/^\d{4}-/);
  });

  it('invalid token → {user:null} and clears the cookie', async () => {
    const res = await me(makeReq('/api/auth/me', { cookie: 'mv_token=garbage' }));
    expect(await res.json()).toEqual({ user: null });
    expect(res.headers.get('set-cookie')).toMatch(/mv_token=;/);
  });

  it('DB down → 200 degraded user from JWT claims (never throws)', async () => {
    const { cookie, user } = await createUser('Linus');
    const spy = vi.spyOn(mongooseMod, 'connectDB').mockRejectedValueOnce(new DatabaseUnavailableError());
    const res = await me(makeReq('/api/auth/me', { cookie }));
    spy.mockRestore();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.degraded).toBe(true);
    expect(json.user).toMatchObject({ id: user.id, name: 'Linus', joinedAt: null });
  });
});

describe('logout / logout-all (tokenVersion revocation)', () => {
  it('logout clears the cookie with the same flags', async () => {
    const res = await logout(makeReq('/api/auth/logout', { method: 'POST' }), undefined);
    expect(res.status).toBe(200);
    const c = res.headers.get('set-cookie')!;
    expect(c).toMatch(/mv_token=;/);
    expect(c).toMatch(/HttpOnly/i);
    expect(c).toMatch(/SameSite=lax/i);
    expect(c).toMatch(/Path=\//);
  });

  it('logout-all revokes every outstanding token of the user', async () => {
    const { cookie: c1, user } = await createUser('Multi Device');
    const res2 = await login(makeReq('/api/auth/login', { body: { email: user.email, password: 'correct-horse-battery' } }), undefined);
    const c2 = sessionCookieFrom(res2);

    expect((await (await me(makeReq('/api/auth/me', { cookie: c2 }))).json()).user).not.toBeNull();
    const out = await logoutAll(makeReq('/api/auth/logout-all', { method: 'POST', cookie: c1 }), undefined);
    expect(out.status).toBe(200);

    invalidateTokenVersionCache();
    expect((await (await me(makeReq('/api/auth/me', { cookie: c1 }))).json()).user).toBeNull();
    expect((await (await me(makeReq('/api/auth/me', { cookie: c2 }))).json()).user).toBeNull();
    expect((await User.findById(user.id).lean())!.tokenVersion).toBe(1);
  });

  it('logout-all requires a session', async () => {
    expect((await logoutAll(makeReq('/api/auth/logout-all', { method: 'POST' }), undefined)).status).toBe(401);
  });
});
