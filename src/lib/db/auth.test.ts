import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';
import { signToken, verifyToken, setAuthCookie, clearAuthCookie, initialsFor, TOKEN_TTL_SECONDS, AUTH_COOKIE } from './auth';

const SECRET = 'unit-test-secret-that-is-long-enough-0123';
const session = { userId: '507f1f77bcf86cd799439011', name: 'Ada', email: 'ada@x.io', initials: 'A', tokenVersion: 3 };

beforeEach(() => vi.stubEnv('JWT_SECRET', SECRET));
afterEach(() => vi.unstubAllEnvs());

describe('JWT', () => {
  it('round-trips a session incl. tokenVersion', () => {
    expect(verifyToken(signToken(session))).toEqual(session);
  });

  it('uses HS256 with a 7 day expiry and sub = userId', () => {
    const decoded = jwt.decode(signToken(session), { complete: true })!;
    expect(decoded.header.alg).toBe('HS256');
    const p = decoded.payload as jwt.JwtPayload;
    expect(p.sub).toBe(session.userId);
    expect(p.tv).toBe(3);
    expect(p.exp! - p.iat!).toBe(TOKEN_TTL_SECONDS);
    expect(TOKEN_TTL_SECONDS).toBe(7 * 24 * 3600);
  });

  it('rejects other algorithms (alg pinning) incl. "none"', () => {
    const none = jwt.sign({ name: 'x', email: 'x', initials: 'x', tv: 0 }, '', { algorithm: 'none', subject: session.userId });
    expect(verifyToken(none)).toBeNull();
    const hs512 = jwt.sign({ name: 'x', email: 'x', initials: 'x', tv: 0 }, SECRET, { algorithm: 'HS512', subject: session.userId });
    expect(verifyToken(hs512)).toBeNull();
  });

  it('rejects wrong secret, expired, malformed and legacy-shaped tokens', () => {
    const other = jwt.sign({ name: 'x', email: 'x', initials: 'x', tv: 0 }, 'another-secret-another-secret-12345', {
      subject: session.userId,
    });
    expect(verifyToken(other)).toBeNull();
    const expired = jwt.sign({ name: 'x', email: 'x', initials: 'x', tv: 0, exp: Math.floor(Date.now() / 1000) - 10 }, SECRET, {
      subject: session.userId,
    });
    expect(verifyToken(expired)).toBeNull();
    expect(verifyToken('garbage')).toBeNull();
    expect(verifyToken('')).toBeNull();
    const legacy = jwt.sign({ userId: session.userId, name: 'x', email: 'x', initials: 'x' }, SECRET);
    expect(verifyToken(legacy)).toBeNull();
  });

  it('fails fast when JWT_SECRET is missing or short (503 ConfigError)', () => {
    vi.stubEnv('JWT_SECRET', '');
    expect(() => signToken(session)).toThrowError(expect.objectContaining({ status: 503, code: 'NOT_CONFIGURED' }));
    vi.stubEnv('JWT_SECRET', 'short');
    expect(() => verifyToken('x')).toThrowError(expect.objectContaining({ status: 503 }));
  });
});

describe('cookies', () => {
  it('sets httpOnly, lax, path=/; secure only in production', () => {
    const res = setAuthCookie(NextResponse.json({}), 'tok');
    const c = res.cookies.get(AUTH_COOKIE)!;
    expect(c).toMatchObject({ value: 'tok', httpOnly: true, sameSite: 'lax', path: '/', maxAge: TOKEN_TTL_SECONDS });
    expect(c.secure).toBe(false);
    vi.stubEnv('NODE_ENV', 'production');
    expect(setAuthCookie(NextResponse.json({}), 'tok').cookies.get(AUTH_COOKIE)!.secure).toBe(true);
  });

  it('clears with the same flags', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const c = clearAuthCookie(NextResponse.json({})).cookies.get(AUTH_COOKIE)!;
    expect(c).toMatchObject({ value: '', httpOnly: true, sameSite: 'lax', path: '/', secure: true, maxAge: 0 });
  });
});

describe('initialsFor', () => {
  it.each([
    ['Ada Lovelace', 'AL'],
    ['ada', 'A'],
    ['  mary   jane  watson ', 'MW'],
    ['', '?'],
  ])('%s → %s', (n, i) => expect(initialsFor(n)).toBe(i));
});
