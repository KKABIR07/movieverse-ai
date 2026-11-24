import jwt from 'jsonwebtoken';
import type { NextRequest, NextResponse } from 'next/server';
import { getJwtSecret, isProduction } from '@/lib/server/env';
import { unauthorized } from '@/lib/server/errors';
import { connectDB } from './mongoose';
import { User } from './models';

/**
 * Session = HS256 JWT in an httpOnly cookie.
 * Claims: sub (user id), name, email, initials, tv (tokenVersion). 7-day expiry.
 * Every authenticated request re-checks `tv` against User.tokenVersion (short in-process cache),
 * so bumping tokenVersion (POST /api/auth/logout-all) revokes all outstanding tokens.
 */

export const AUTH_COOKIE = 'mv_token';
export const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;
const ALG = 'HS256' as const;

export interface Session {
  userId: string;
  name: string;
  email: string;
  initials: string;
  tokenVersion: number;
}

/** @deprecated alias kept for older imports */
export type JWTPayload = Session;

interface Claims {
  sub: string;
  name: string;
  email: string;
  initials: string;
  tv: number;
}

export function signToken(s: Session): string {
  const claims: Omit<Claims, 'sub'> = { name: s.name, email: s.email, initials: s.initials, tv: s.tokenVersion };
  return jwt.sign(claims, getJwtSecret(), { algorithm: ALG, expiresIn: TOKEN_TTL_SECONDS, subject: s.userId });
}

/** Verify signature/expiry/shape. Returns null for any invalid token. Throws only on missing config. */
export function verifyToken(token: string): Session | null {
  const secret = getJwtSecret();
  if (!token || token.length > 4096) return null;
  try {
    const c = jwt.verify(token, secret, { algorithms: [ALG] }) as Partial<Claims>;
    if (
      typeof c.sub !== 'string' ||
      !/^[a-f\d]{24}$/i.test(c.sub) ||
      typeof c.tv !== 'number' ||
      typeof c.name !== 'string' ||
      typeof c.email !== 'string' ||
      typeof c.initials !== 'string'
    ) {
      return null;
    }
    return { userId: c.sub, name: c.name, email: c.email, initials: c.initials, tokenVersion: c.tv };
  } catch {
    return null;
  }
}

// ─── tokenVersion check (cached briefly to avoid a DB hit on every request) ──────

const TV_CACHE_MS = 15_000;
const TV_CACHE_MAX = 5_000;
const g = globalThis as typeof globalThis & { __mkTvCache?: Map<string, { tv: number | null; exp: number }> };
const tvCache = (g.__mkTvCache ??= new Map());

/** Current tokenVersion for a user, or null if the user no longer exists. DB errors propagate (503). */
async function currentTokenVersion(userId: string): Promise<number | null> {
  const now = Date.now();
  const hit = tvCache.get(userId);
  if (hit && hit.exp > now) return hit.tv;
  await connectDB();
  const u = await User.findById(userId).select('tokenVersion').lean<{ tokenVersion?: number }>();
  const tv = u ? (u.tokenVersion ?? 0) : null;
  if (tvCache.size >= TV_CACHE_MAX) tvCache.delete(tvCache.keys().next().value as string);
  tvCache.set(userId, { tv, exp: now + TV_CACHE_MS });
  return tv;
}

export function invalidateTokenVersionCache(userId?: string): void {
  if (userId) tvCache.delete(userId);
  else tvCache.clear();
}

function readToken(req: NextRequest): string | undefined {
  return req.cookies.get(AUTH_COOKIE)?.value;
}

/**
 * Session for this request, or null if absent/invalid/revoked.
 * Throws DatabaseUnavailableError (503) if the revocation check cannot reach the DB,
 * and ConfigError (503) if JWT_SECRET is not configured.
 */
export async function getSession(req: NextRequest): Promise<Session | null> {
  const token = readToken(req);
  if (!token) return null;
  const s = verifyToken(token);
  if (!s) return null;
  const tv = await currentTokenVersion(s.userId);
  if (tv === null || tv !== s.tokenVersion) return null;
  return s;
}

/** Like getSession but never throws (DB/config problems → anonymous). For public endpoints. */
export async function getOptionalSession(req: NextRequest): Promise<Session | null> {
  try {
    return await getSession(req);
  } catch {
    return null;
  }
}

/** Session or 401. */
export async function requireSession(req: NextRequest): Promise<Session> {
  const s = await getSession(req);
  if (!s) throw unauthorized();
  return s;
}

/** Verify only the JWT (no DB). Used by /api/auth/me's degraded path. */
export function getUnverifiedRevocationSession(req: NextRequest): Session | null {
  const token = readToken(req);
  return token ? verifyToken(token) : null;
}

const cookieBase = () => ({
  httpOnly: true,
  secure: isProduction(),
  sameSite: 'lax' as const,
  path: '/',
});

export function setAuthCookie<T>(res: NextResponse<T>, token: string): NextResponse<T> {
  res.cookies.set(AUTH_COOKIE, token, { ...cookieBase(), maxAge: TOKEN_TTL_SECONDS });
  return res;
}

export function clearAuthCookie<T>(res: NextResponse<T>): NextResponse<T> {
  res.cookies.set(AUTH_COOKIE, '', { ...cookieBase(), maxAge: 0, expires: new Date(0) });
  return res;
}

export function hasAuthCookie(req: NextRequest): boolean {
  return Boolean(readToken(req));
}

export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = Array.from(parts[0])[0] ?? '?';
  const last = parts.length > 1 ? (Array.from(parts[parts.length - 1])[0] ?? '') : '';
  return (first + last).toUpperCase();
}

export interface UserDTO {
  id: string;
  name: string;
  email: string;
  initials: string;
  avatar: string | null;
  joinedAt: string | null;
}

export function toUserDTO(u: {
  _id: { toString(): string };
  name: string;
  email: string;
  initials: string;
  avatar?: string | null;
  createdAt?: Date | string | null;
}): UserDTO {
  return {
    id: u._id.toString(),
    name: u.name,
    email: u.email,
    initials: u.initials,
    avatar: u.avatar ?? null,
    joinedAt: u.createdAt ? new Date(u.createdAt).toISOString() : null,
  };
}
