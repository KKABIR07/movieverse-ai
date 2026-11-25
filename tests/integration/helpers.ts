/**
 * Integration-test helpers: in-memory PGlite (real Postgres 17 in WASM) with the committed SQL
 * migrations applied, NextRequest builders, user/session factories.
 * Route handlers are invoked directly (no HTTP server); no test touches the network.
 */
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { NextRequest } from 'next/server';
import { setDbForTests, type Db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { invalidateTokenVersionCache, AUTH_COOKIE } from '@/lib/db/auth';
import { resetSweepThrottle } from '@/lib/db/maintenance';

export const TEST_JWT_SECRET = 'integration-test-secret-0123456789-abcdefghij';
export const MIGRATIONS_FOLDER = path.join(process.cwd(), 'drizzle', 'migrations');

let client: PGlite | null = null;
export let db: Db;

/** Fresh in-memory PGlite with the migrations applied (no injection). */
export async function createTestDb(): Promise<{ client: PGlite; db: Db }> {
  const c = new PGlite();
  const d = drizzle(c, { schema }) as unknown as Db;
  await migrate(drizzle(c), { migrationsFolder: MIGRATIONS_FOLDER });
  return { client: c, db: d };
}

export async function startDb(): Promise<void> {
  process.env.JWT_SECRET = TEST_JWT_SECRET;
  ({ client, db } = await createTestDb());
  setDbForTests(db);
}

export async function stopDb(): Promise<void> {
  setDbForTests(null);
  await client?.close();
  client = null;
}

export async function resetDb(): Promise<void> {
  invalidateTokenVersionCache();
  resetSweepThrottle();
  await db.execute(
    sql`truncate table review_likes, reviews, watchlist_items, chat_messages, follows, youtube_cache, users cascade`,
  );
}

/** Rows of a raw `db.execute(sql…)` result (driver-agnostic Db types it as unknown). */
export function rowsOf<T>(result: unknown): T[] {
  return (result as { rows: T[] }).rows;
}

/**
 * Run `fn` with getDb() returning a database whose every query fails like an unreachable Postgres
 * (node-postgres ECONNREFUSED), then restore the real test DB.
 */
export async function withDbDown<T>(fn: () => Promise<T>, error: () => unknown = connRefused): Promise<T> {
  type Settle = Parameters<Promise<never>['then']>;
  const fail = () => Promise.reject<never>(error());
  const chain: unknown = new Proxy(function () {}, {
    get: (_t, prop) => (prop === 'then' ? (res: Settle[0], rej: Settle[1]) => fail().then(res, rej) : chain),
    apply: () => chain,
  });
  setDbForTests(chain as Db);
  try {
    return await fn();
  } finally {
    setDbForTests(db);
  }
}

export function connRefused(): Error {
  return Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), { code: 'ECONNREFUSED', errno: -111 });
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
