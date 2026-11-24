/**
 * Integration-test helpers: in-memory MongoDB, NextRequest builders, user/session factories.
 * Route handlers are invoked directly (no HTTP server); no test touches the network.
 */
import { MongoMemoryServer } from 'mongodb-memory-server';
import { NextRequest } from 'next/server';
import { connectDB, disconnectDB } from '@/lib/db/mongoose';
import { ChatMessage, Follow, Review, User, Watchlist, YoutubeCache } from '@/lib/db/models';
import { invalidateTokenVersionCache, AUTH_COOKIE } from '@/lib/db/auth';

export const TEST_JWT_SECRET = 'integration-test-secret-0123456789-abcdefghij';

let mongod: MongoMemoryServer | null = null;

export async function startDb(): Promise<void> {
  process.env.JWT_SECRET = TEST_JWT_SECRET;
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('mkmovies-test');
  await connectDB();
  await Promise.all([User.init(), Review.init(), Watchlist.init(), ChatMessage.init(), Follow.init(), YoutubeCache.init()]);
}

export async function stopDb(): Promise<void> {
  await disconnectDB();
  await mongod?.stop();
  mongod = null;
}

export async function resetDb(): Promise<void> {
  invalidateTokenVersionCache();
  await Promise.all([
    User.deleteMany({}),
    Review.deleteMany({}),
    Watchlist.deleteMany({}),
    ChatMessage.deleteMany({}),
    Follow.deleteMany({}),
    YoutubeCache.deleteMany({}),
  ]);
}

type Init = { method?: string; body?: unknown; cookie?: string; headers?: Record<string, string>; rawBody?: string };

export function makeReq(url: string, init: Init = {}): NextRequest {
  const headers: Record<string, string> = { ...init.headers };
  let body: string | undefined;
  if (init.rawBody !== undefined) body = init.rawBody;
  else if (init.body !== undefined) {
    body = JSON.stringify(init.body);
    headers['content-type'] ??= 'application/json';
  }
  if (init.cookie) headers.cookie = init.cookie;
  return new NextRequest(new URL(url, 'http://localhost:3000'), { method: init.method ?? (body ? 'POST' : 'GET'), headers, body });
}

/** Extract "mv_token=..." from a Set-Cookie response header. */
export function sessionCookieFrom(res: Response): string {
  const set = res.headers.getSetCookie?.() ?? [res.headers.get('set-cookie') ?? ''];
  const c = set.find((s) => s.startsWith(`${AUTH_COOKIE}=`));
  if (!c) throw new Error('no session cookie in response');
  return c.split(';')[0];
}

let userSeq = 0;

/** Sign up a fresh user through the real route; returns its cookie + DTO. */
export async function createUser(name = 'Test User'): Promise<{ cookie: string; user: { id: string; name: string; email: string } }> {
  const { POST } = await import('@/app/api/auth/signup/route');
  const email = `user${++userSeq}-${Date.now()}@example.com`;
  const res = await POST(makeReq('/api/auth/signup', { body: { name, email, password: 'correct-horse-battery' } }), undefined);
  if (res.status !== 201) throw new Error(`signup failed: ${res.status} ${await res.text()}`);
  const { user } = await res.json();
  return { cookie: sessionCookieFrom(res), user };
}

export const ctx = undefined;
