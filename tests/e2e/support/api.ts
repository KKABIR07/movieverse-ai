/**
 * Thin, contract-level helpers over the mkmovies JSON API (src/app/api/**).
 * They work with any APIRequestContext — `page.request` / `context.request` share the browser's
 * cookie jar, so a user created here is signed in for the page too.
 *
 * No assumption is made about id formats (Mongo ObjectId today, Postgres ids after the port):
 * ids are always read back from responses.
 */
import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import { uniqueTestIp } from './fixtures';

export interface TestUser {
  name: string;
  email: string;
  password: string;
}

export function newTestUser(label = 'e2e'): TestUser {
  const ts = `${Date.now()}${Math.floor(Math.random() * 1e4)}`;
  return {
    name: `E2E ${label} ${ts.slice(-6)}`,
    email: `e2e+${label}-${ts}@example.com`,
    password: `Pw-${ts}-x!`,
  };
}

/** Headers for a request that should pass the proxy's origin + rate-limit gates. */
export function apiHeaders(opts: { ip?: string; origin?: string } = {}): Record<string, string> {
  const h: Record<string, string> = { 'x-real-ip': opts.ip ?? uniqueTestIp() };
  if (opts.origin) h.origin = opts.origin;
  return h;
}

async function body(res: APIResponse): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return (await res.text()).slice(0, 500);
  }
}

export async function expectStatus(res: APIResponse, ...ok: number[]): Promise<void> {
  if (!ok.includes(res.status())) {
    throw new Error(`${res.url()} → ${res.status()} (expected ${ok.join('/')}): ${JSON.stringify(await body(res))}`);
  }
}

export async function signup(request: APIRequestContext, user: TestUser, ip?: string) {
  const res = await request.post('/api/auth/signup', { data: user, headers: apiHeaders({ ip }) });
  await expectStatus(res, 201);
  return (await res.json()) as { user: { id: string; name: string; email: string } };
}

export async function login(request: APIRequestContext, user: Pick<TestUser, 'email' | 'password'>, ip?: string) {
  return request.post('/api/auth/login', { data: user, headers: apiHeaders({ ip }) });
}

export async function me(request: APIRequestContext, ip?: string) {
  const res = await request.get('/api/auth/me', { headers: apiHeaders({ ip }) });
  await expectStatus(res, 200);
  return (await res.json()) as { user: null | { id: string; email: string; name: string } };
}

export async function expectSignedIn(request: APIRequestContext, email: string, ip?: string) {
  const { user } = await me(request, ip);
  expect(user?.email).toBe(email.toLowerCase());
}

export async function expectSignedOut(request: APIRequestContext, ip?: string) {
  const { user } = await me(request, ip);
  expect(user).toBeNull();
}

export const FIGHT_CLUB = { id: 550, title: 'Fight Club', poster: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg' };
/** TV show whose TMDB id is also 550 — used to prove movie/tv watchlist keys don't collide. */
export const TV_550 = { id: 550, name: 'TV show 550' };
export const BRAD_PITT = { id: 287, name: 'Brad Pitt' };
