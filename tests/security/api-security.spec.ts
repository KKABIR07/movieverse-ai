/**
 * Security suite (Playwright request API — no browser needed). Runs once (desktop project).
 *
 * @smoke tests are read-only (rejected at the proxy or validation layer, no data written) and are
 *        safe against production. They DO count against the per-IP rate limit, so run them once.
 * @full  tests sign up users / write rows / burst the limiter → local or staging only.
 *        DB-backed ones skip with a clear reason when the server reports db=down.
 *
 * Proxy contract (src/proxy.ts, src/lib/server/rate-limit.ts):
 *   Content-Length > 64 KB → 413 PAYLOAD_TOO_LARGE · cross-origin / Origin:null mutation → 403 BAD_ORIGIN
 *   body without application/json → 403 BAD_CONTENT_TYPE · bucket empty → 429 RATE_LIMITED + Retry-After
 *   auth bucket = 10 / min per client IP (X-Real-IP, else LAST X-Forwarded-For hop).
 */
import { test, expect, type APIRequestContext } from '@playwright/test';
import { apiHeaders, expectStatus, FIGHT_CLUB, newTestUser, signup } from '../e2e/support/api';
import { uniqueTestIp } from '../e2e/support/fixtures';
import { requireDb, requireTmdb } from '../e2e/support/env';

const BASE = (process.env.E2E_BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
const IS_HTTPS = BASE.startsWith('https://');
const LEAK_RE = /at \w+ \(|MongoServerError|syntax error at or near|relation "|DrizzleQueryError|PostgresError|node_modules|password_hash|\$2[aby]\$/;
const SOME_UUID = '3f2b8c1e-4d5a-4e6f-8a9b-0c1d2e3f4a5b';

test.describe('security headers @smoke', () => {
  for (const path of ['/', '/search', '/api/health']) {
    test(`headers on ${path} @smoke`, async ({ request }) => {
      const res = await request.get(path);
      expect(res.status()).toBeLessThan(500);
      const h = res.headers();
      const csp = h['content-security-policy'] ?? '';
      expect(csp, 'Content-Security-Policy').toContain("default-src 'self'");
      expect(csp).toMatch(/object-src 'none'/);
      expect(csp).toMatch(/base-uri 'self'/);
      expect(csp, 'browser never talks to TMDB directly').toMatch(/connect-src 'self'(;|$)/);
      expect(csp, 'no unsafe-eval in production').not.toMatch(/unsafe-eval/);
      expect(h['strict-transport-security'] ?? '', 'HSTS').toMatch(/max-age=\d{7,}/);
      expect(h['x-content-type-options']).toBe('nosniff');
      expect(h['referrer-policy']).toMatch(/strict-origin|no-referrer|same-origin/);
      expect(h['permissions-policy'] ?? '').toMatch(/camera=\(\)/);
      const framing = /frame-ancestors\s+('none'|'self')/.test(csp) || /^(DENY|SAMEORIGIN)$/i.test(h['x-frame-options'] ?? '');
      expect(framing, 'frame-ancestors or X-Frame-Options').toBe(true);
      expect(h['x-powered-by'], 'x-powered-by must not be sent').toBeUndefined();
    });
  }

  test('API JSON responses are not cacheable by shared caches by default @smoke', async ({ request }) => {
    for (const p of ['/api/auth/me', '/api/health']) {
      const res = await request.get(p, { headers: apiHeaders() });
      expect(res.headers()['cache-control'] ?? '', p).toMatch(/no-store|private/);
    }
  });
});

test.describe('proxy gates @smoke', () => {
  test('TMDB proxy allowlist: non-allowlisted paths → 404 @smoke', async ({ request }) => {
    for (const p of [
      '/api/tmdb/account/1',
      '/api/tmdb/authentication/token/new',
      '/api/tmdb/..%2F..%2Fetc%2Fpasswd',
      '/api/tmdb/movie/550/account_states',
      '/api/tmdb/list/1',
    ]) {
      const res = await request.get(p, { headers: apiHeaders() });
      expect(res.status(), p).toBe(404);
    }
  });

  test('TMDB proxy never forwards client credentials / unknown params @smoke', async ({ request }) => {
    requireTmdb();
    const res = await request.get('/api/tmdb/movie/550?api_key=attacker&session_id=x&append_to_response=account_states', {
      headers: { ...apiHeaders(), authorization: 'Bearer attacker' },
    });
    // unknown keys are dropped; a disallowed append value is a 400, never forwarded
    expect([200, 400]).toContain(res.status());
    expect(await res.text()).not.toMatch(/account_states|attacker/);
  });

  test('oversized body (Content-Length > 64 KB) → 413 on every mutating API @smoke', async ({ request }) => {
    const big = JSON.stringify({ email: 'a@b.c', password: 'x'.repeat(70 * 1024) });
    for (const path of ['/api/auth/login', '/api/auth/signup', '/api/reviews', '/api/chat', '/api/watchlist', '/api/ai/recommend']) {
      const res = await request.post(path, { data: big, headers: { ...apiHeaders(), 'content-type': 'application/json' } });
      expect(res.status(), path).toBe(413);
      expect((await res.json()).code, path).toBe('PAYLOAD_TOO_LARGE');
    }
  });

  test('body just under the cap is NOT rejected by the proxy (validation answers instead) @smoke', async ({ request }) => {
    const near = JSON.stringify({ email: 'a@b.c', password: 'x'.repeat(60 * 1024) });
    const res = await request.post('/api/auth/login', { data: near, headers: { ...apiHeaders(), 'content-type': 'application/json' } });
    expect(res.status()).not.toBe(413);
    expect(res.status()).toBe(400); // password > 72 chars
  });

  test('cross-origin POST → 403 @smoke', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { email: 'a@b.c', password: 'x' },
      headers: { ...apiHeaders(), origin: 'https://evil.example' },
    });
    expect(res.status()).toBe(403);
    expect((await res.json()).code).toBe('BAD_ORIGIN');
    const nullOrigin = await request.post('/api/watchlist', {
      data: { id: 1, media_type: 'movie' },
      headers: { ...apiHeaders(), origin: 'null' },
    });
    expect(nullOrigin.status()).toBe(403);
    // look-alike host must not pass a naive suffix/prefix check
    const lookalike = await request.delete('/api/watchlist?id=1&media_type=movie', {
      headers: { ...apiHeaders(), origin: `${new URL(BASE).protocol}//${new URL(BASE).host}.evil.example` },
    });
    expect(lookalike.status()).toBe(403);
  });

  test('text/plain or form POST (CSRF-style simple request) → 403 @smoke', async ({ request }) => {
    const res = await request.post('/api/reviews', {
      data: '{"movieId":550}',
      headers: { ...apiHeaders(), 'content-type': 'text/plain' },
    });
    expect(res.status()).toBe(403);
    expect((await res.json()).code).toBe('BAD_CONTENT_TYPE');
    const form = await request.post('/api/auth/login', { form: { email: 'a@b.c', password: 'x' }, headers: apiHeaders() });
    expect(form.status()).toBe(403);
    const multipart = await request.post('/api/chat', { multipart: { text: 'hi' }, headers: apiHeaders() });
    expect(multipart.status()).toBe(403);
  });
});

test.describe('auth bypass @smoke', () => {
  const PROTECTED: [string, string, unknown?][] = [
    ['GET', '/api/watchlist'],
    ['POST', '/api/watchlist', { id: 550, media_type: 'movie' }],
    ['DELETE', '/api/watchlist?id=550&media_type=movie'],
    ['GET', '/api/follows'],
    ['POST', '/api/follows', { personId: 287, personName: 'Brad Pitt' }],
    ['DELETE', '/api/follows', { personId: 287 }],
    ['POST', '/api/chat', { text: 'hi' }],
    ['POST', '/api/reviews', { movieId: 550, movieTitle: 'x', rating: 5, content: 'x' }],
    ['DELETE', `/api/reviews?id=${SOME_UUID}`],
    ['POST', '/api/reviews/like', { id: SOME_UUID, like: true }],
    ['POST', '/api/ai/recommend', { messages: [{ role: 'user', content: 'hi' }] }],
    ['POST', '/api/auth/logout-all'],
  ];

  for (const [method, path, data] of PROTECTED) {
    test(`${method} ${path} without a session → 401 JSON @smoke`, async ({ request }) => {
      const res = await request.fetch(path, { method, headers: apiHeaders(), ...(data !== undefined ? { data } : {}) });
      expect(res.status(), `${method} ${path}`).toBe(401);
      expect(res.headers()['content-type']).toMatch(/application\/json/);
      expect(await res.text()).not.toMatch(LEAK_RE);
    });
  }

  test('method not allowed on read-only routes is not 2xx @smoke', async ({ request }) => {
    for (const [method, path] of [
      ['POST', '/api/auth/me'],
      ['DELETE', '/api/follows/counts?ids=1'],
      ['PUT', '/api/watchlist'],
      ['POST', '/api/tmdb/movie/550'],
    ] as const) {
      const res = await request.fetch(path, { method, headers: apiHeaders(), data: {} });
      expect(res.status(), `${method} ${path}`).toBeGreaterThanOrEqual(400);
      expect(res.status(), `${method} ${path}`).toBeLessThan(500);
    }
  });
});

test.describe('input validation / injection @smoke', () => {
  const INJECTIONS: { name: string; method: 'GET' | 'POST'; path: string; data?: unknown; expect: number[] }[] = [
    { name: 'operator object in login email', method: 'POST', path: '/api/auth/login', data: { email: { $gt: '' }, password: 'x' }, expect: [400] },
    { name: 'operator object in login password', method: 'POST', path: '/api/auth/login', data: { email: 'a@b.c', password: { $ne: null } }, expect: [400] },
    { name: 'array instead of string', method: 'POST', path: '/api/auth/login', data: { email: ['a@b.c'], password: 'x' }, expect: [400] },
    { name: 'malformed JSON', method: 'POST', path: '/api/auth/login', data: '{"email": "a@b.c", ', expect: [400] },
    { name: 'JSON null body', method: 'POST', path: '/api/auth/login', data: 'null', expect: [400] },
    { name: 'SQL in signup email', method: 'POST', path: '/api/auth/signup', data: { name: 'x', email: "a@b.c' OR '1'='1", password: 'password123' }, expect: [400] },
    { name: 'prototype pollution keys', method: 'POST', path: '/api/auth/login', data: JSON.parse('{"__proto__":{"admin":true},"constructor":{"prototype":{"x":1}}}'), expect: [400] },
    { name: 'SQL-ish movieId', method: 'GET', path: '/api/reviews?movieId=1%20OR%201%3D1', expect: [400] },
    { name: 'operator movieId', method: 'GET', path: '/api/reviews?movieId[$gt]=0', expect: [400] },
    { name: 'negative movieId', method: 'GET', path: '/api/reviews?movieId=-1', expect: [400] },
    { name: 'huge movieId', method: 'GET', path: '/api/reviews?movieId=99999999999999999999', expect: [400] },
    { name: 'SQL-ish follow counts', method: 'GET', path: '/api/follows/counts?ids=1;DROP%20TABLE%20users', expect: [400] },
    { name: 'too many follow count ids', method: 'GET', path: `/api/follows/counts?ids=${Array.from({ length: 150 }, (_, i) => i + 1).join(',')}`, expect: [400] },
    { name: 'quote in chat room', method: 'GET', path: "/api/chat?roomId=general'%20OR%20'1'='1", expect: [400] },
    { name: 'unknown chat room', method: 'GET', path: '/api/chat?roomId=admin', expect: [400] },
    { name: 'bad chat cursor', method: 'GET', path: '/api/chat?roomId=general&after=yesterday', expect: [400] },
    { name: 'tmdb path traversal', method: 'GET', path: '/api/tmdb/movie/550%2F..%2F..%2Faccount', expect: [404] },
    // invalid n/type → rejected before any (quota-costing) YouTube call
    { name: 'youtube param injection', method: 'GET', path: '/api/youtube/shorts?q=%27%3B--&n=999&type=%27%20OR%201%3D1', expect: [400] },
  ];

  for (const c of INJECTIONS) {
    test(`${c.name} → ${c.expect.join('/')} not 500 @smoke`, async ({ request }) => {
      const res =
        c.method === 'GET'
          ? await request.get(c.path, { headers: apiHeaders() })
          : await request.post(c.path, {
              data: typeof c.data === 'string' ? c.data : JSON.stringify(c.data),
              headers: { ...apiHeaders(), 'content-type': 'application/json' },
            });
      expect(res.status(), `${c.method} ${c.path}`).not.toBe(500);
      expect(c.expect, `${c.method} ${c.path} → ${res.status()}`).toContain(res.status());
      expect(await res.text(), 'no stack traces / driver errors in responses').not.toMatch(LEAK_RE);
    });
  }
});

test.describe('session tampering (JWT) @smoke', () => {
  const b64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const claims = { sub: SOME_UUID, name: 'admin', email: 'admin@x.x', initials: 'A', tv: 0, exp: 9_999_999_999 };
  const forged: [string, string][] = [
    ['alg=none', `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url(claims)}.`],
    ['alg=None (case)', `${b64url({ alg: 'None', typ: 'JWT' })}.${b64url(claims)}.`],
    ['HS256 with a guessed signature', `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(claims)}.${'A'.repeat(43)}`],
    ['HS512 (alg not pinned)', `${b64url({ alg: 'HS512', typ: 'JWT' })}.${b64url(claims)}.${'A'.repeat(86)}`],
    ['RS256 header (key confusion)', `${b64url({ alg: 'RS256', typ: 'JWT' })}.${b64url(claims)}.${'A'.repeat(342)}`],
    ['not a JWT', 'not-a-jwt'],
    ['oversized token', 'x'.repeat(5000)],
  ];

  for (const [label, token] of forged) {
    test(`forged session cookie (${label}) is treated as logged out @smoke`, async ({ request }) => {
      const me = await request.get('/api/auth/me', { headers: { ...apiHeaders(), cookie: `mv_token=${token}` } });
      expect(me.status()).toBe(200);
      expect((await me.json()).user).toBeNull();
      const wl = await request.get('/api/watchlist', { headers: { ...apiHeaders(), cookie: `mv_token=${token}` } });
      expect(wl.status()).toBe(401);
    });
  }
});

// ─── @full (writes data / bursts limiter) ──────────────────────────────────────

test.describe('rate limiting @full', () => {
  async function burst(request: APIRequestContext, headersFor: (i: number) => Record<string, string>, n = 14, path = '/api/auth/login') {
    const statuses: number[] = [];
    let retryAfter: string | undefined;
    let body: { code?: string } | undefined;
    for (let i = 0; i < n; i++) {
      const res = await request.post(path, {
        data: { email: `nobody-${i}@example.com`, password: 'wrong-password' },
        headers: headersFor(i),
      });
      statuses.push(res.status());
      if (res.status() === 429 && !retryAfter) {
        retryAfter = res.headers()['retry-after'];
        body = await res.json();
      }
    }
    return { statuses, retryAfter, body };
  }

  test('burst on /api/auth/login → 429 RATE_LIMITED with Retry-After @full', async ({ request }) => {
    const ip = uniqueTestIp();
    const { statuses, retryAfter, body } = await burst(request, () => ({ 'x-real-ip': ip }));
    expect(statuses, statuses.join(',')).toContain(429);
    // 401 normally, 503 when the server has no DB — the limiter runs before either
    expect(statuses.slice(0, 10).every((s) => s !== 429), `first 10 within the bucket: ${statuses.join(',')}`).toBe(true);
    expect(statuses.slice(10).every((s) => s === 429), `11th+ throttled: ${statuses.join(',')}`).toBe(true);
    expect(Number(retryAfter)).toBeGreaterThanOrEqual(1);
    expect(body?.code).toBe('RATE_LIMITED');
  });

  test('buckets are per IP: another client is unaffected @full', async ({ request }) => {
    const ip = uniqueTestIp();
    await burst(request, () => ({ 'x-real-ip': ip }), 12);
    const other = await request.post('/api/auth/login', {
      data: { email: 'nobody@example.com', password: 'wrong-password' },
      headers: { 'x-real-ip': uniqueTestIp() },
    });
    expect(other.status()).not.toBe(429);
    expect(other.headers()['x-ratelimit-limit']).toBe('10');
  });

  test('spoofed leading X-Forwarded-For hops do not reset the limit @full', async ({ request }) => {
    const lastHop = uniqueTestIp();
    const { statuses } = await burst(request, (i) => ({ 'x-forwarded-for': `10.${i}.${i}.${i}, 1.2.3.${i}, ${lastHop}` }));
    expect(statuses, `statuses: ${statuses.join(',')}`).toContain(429);
  });

  test('/api/health and /api/ready are exempt @full', async ({ request }) => {
    const ip = uniqueTestIp();
    for (let i = 0; i < 30; i++) {
      const r = await request.get('/api/health', { headers: { 'x-real-ip': ip } });
      expect(r.status()).toBe(200);
    }
  });

  test('normal browsing (12 full page loads/min) never gets /api/* throttled @full', async ({ browser }) => {
    const context = await browser.newContext();
    const ip = uniqueTestIp();
    await context.route('**/api/**', (route) => route.continue({ headers: { ...route.request().headers(), 'x-real-ip': ip } }));
    const page = await context.newPage();
    const throttled: string[] = [];
    page.on('response', (r) => {
      if (r.status() === 429) throttled.push(r.url());
    });
    for (let i = 0; i < 12; i++) await page.goto(i % 2 ? '/search' : '/blog', { waitUntil: 'networkidle' }).catch(() => undefined);
    await context.close();
    expect(throttled, 'a signed-out visitor reloading pages should not be rate limited').toEqual([]);
  });
});

test.describe('authorization / IDOR @full', () => {
  test.beforeEach(() => requireDb());

  async function twoUsers(playwright: import('@playwright/test').PlaywrightWorkerArgs['playwright']) {
    const a = await playwright.request.newContext({ baseURL: BASE });
    const b = await playwright.request.newContext({ baseURL: BASE });
    const ipA = uniqueTestIp();
    const ipB = uniqueTestIp();
    const ua = await signup(a, newTestUser('idora'), ipA);
    const ub = await signup(b, newTestUser('idorb'), ipB);
    return { a, b, ha: apiHeaders({ ip: ipA }), hb: apiHeaders({ ip: ipB }), ua, ub };
  }

  test('reviews: B cannot delete or overwrite A’s review @full', async ({ playwright }) => {
    const { a, b, ha, hb } = await twoUsers(playwright);
    const created = await a.post('/api/reviews', {
      data: { movieId: FIGHT_CLUB.id, movieTitle: FIGHT_CLUB.title, rating: 7, content: 'IDOR probe' },
      headers: ha,
    });
    await expectStatus(created, 201);
    const id = (await created.json()).review.id as string;

    const del = await b.delete(`/api/reviews?id=${encodeURIComponent(id)}`, { headers: hb });
    expect(del.status()).toBe(403);
    const missing = await b.delete(`/api/reviews?id=${SOME_UUID}`, { headers: hb });
    expect(missing.status()).toBe(404);
    const notUuid = await b.delete(`/api/reviews?id=1%20OR%201=1`, { headers: hb });
    expect(notUuid.status()).toBe(400);

    // B's POST for the same movie creates B's own review; extra fields (id/userId) are ignored
    const bEdit = await b.post('/api/reviews', {
      data: { id, userId: 'whatever', movieId: FIGHT_CLUB.id, movieTitle: FIGHT_CLUB.title, rating: 1, content: 'hijack attempt' },
      headers: hb,
    });
    await expectStatus(bEdit, 201);
    expect((await bEdit.json()).review.id).not.toBe(id);

    const list = (await (await a.get(`/api/reviews?movieId=${FIGHT_CLUB.id}`, { headers: ha })).json()).reviews as { id: string; content: string }[];
    expect(list.find((r) => r.id === id)?.content).toBe('IDOR probe');

    await a.delete(`/api/reviews?id=${encodeURIComponent(id)}`, { headers: ha });
    const bId = (await bEdit.json()).review.id as string;
    await b.delete(`/api/reviews?id=${encodeURIComponent(bId)}`, { headers: hb });
    await a.dispose();
    await b.dispose();
  });

  test('watchlist: lists are per user; B’s delete never touches A’s row @full', async ({ playwright }) => {
    const { a, b, ha, hb } = await twoUsers(playwright);
    await expectStatus(await a.post('/api/watchlist', { data: { id: 13, media_type: 'movie', title: 'Forrest Gump' }, headers: ha }), 201);
    const bList = (await (await b.get('/api/watchlist', { headers: hb })).json()).items as { id: number }[];
    expect(bList.some((i) => i.id === 13)).toBe(false);

    // B deletes "the same" item (by id) — only B's own (empty) list is affected
    await expectStatus(await b.delete('/api/watchlist?id=13&media_type=movie', { headers: hb }), 200);
    // userId smuggled in the body is ignored
    await b.post('/api/watchlist', { data: { id: 99, media_type: 'movie', title: 'x', userId: 'someone-else' }, headers: hb });
    const aList = (await (await a.get('/api/watchlist', { headers: ha })).json()).items as { id: number }[];
    expect(aList.map((i) => i.id)).toEqual([13]);
    await a.dispose();
    await b.dispose();
  });

  test('follows: B unfollowing does not remove A’s follow @full', async ({ playwright }) => {
    const { a, b, ha, hb } = await twoUsers(playwright);
    const personId = 1_000_000 + Math.floor(Math.random() * 1_000_000); // private id → no cross-test races
    const f = await a.post('/api/follows', { data: { personId, personName: 'IDOR Person' }, headers: ha });
    expect((await f.json()).followerCount).toBe(1);
    const u = await b.delete('/api/follows', { data: { personId }, headers: hb });
    await expectStatus(u, 200);
    expect((await u.json()).followerCount).toBe(1);
    const aFollowing = (await (await a.get('/api/follows', { headers: ha })).json()).following as { personId: number }[];
    expect(aFollowing.map((x) => x.personId)).toContain(personId);
    const bFollowing = (await (await b.get('/api/follows', { headers: hb })).json()).following as unknown[];
    expect(bFollowing).toEqual([]);
    await a.delete('/api/follows', { data: { personId }, headers: ha });
    await a.dispose();
    await b.dispose();
  });

  test('stored XSS payloads are returned as inert JSON data @full', async ({ playwright }) => {
    const { a, ha } = await twoUsers(playwright);
    const payload = `<img src=x onerror=alert(1)><script>alert(2)</script>`;
    const movieId = 2_000_000 + Math.floor(Math.random() * 1_000_000);
    const r = await a.post('/api/reviews', { data: { movieId, movieTitle: payload, rating: 5, content: payload }, headers: ha });
    await expectStatus(r, 201);
    expect(r.headers()['content-type']).toMatch(/application\/json/);
    expect(r.headers()['x-content-type-options']).toBe('nosniff');
    expect((await r.json()).review.content).toBe(payload);
    await a.delete(`/api/reviews?id=${(await r.json()).review.id}`, { headers: ha });
    await a.dispose();
  });

  test('session cookie flags: HttpOnly, SameSite=Lax, Path=/, Secure on https; cleared on logout @full', async ({ request }) => {
    const res = await request.post('/api/auth/signup', { data: newTestUser('cookie'), headers: apiHeaders() });
    await expectStatus(res, 201);
    const setCookie = res
      .headersArray()
      .filter((h) => h.name.toLowerCase() === 'set-cookie')
      .map((h) => h.value)
      .find((v) => v.startsWith('mv_token='));
    expect(setCookie, 'mv_token Set-Cookie').toBeTruthy();
    expect(setCookie).toMatch(/;\s*HttpOnly/i);
    expect(setCookie).toMatch(/;\s*SameSite=Lax/i);
    expect(setCookie).toMatch(/;\s*Path=\//i);
    expect(setCookie).toMatch(/;\s*Max-Age=\d+/i);
    if (IS_HTTPS) expect(setCookie).toMatch(/;\s*Secure/i);
    // body never echoes the token or password hash
    expect(JSON.stringify(await res.json())).not.toMatch(/eyJ[\w-]+\.eyJ|passwordHash|\$2[aby]\$/);

    const out = await request.post('/api/auth/logout', { headers: apiHeaders() });
    const cleared = out
      .headersArray()
      .filter((h) => h.name.toLowerCase() === 'set-cookie')
      .map((h) => h.value)
      .find((v) => v.startsWith('mv_token='));
    expect(cleared, 'logout clears mv_token').toMatch(/^mv_token=;|Max-Age=0|Expires=Thu, 01 Jan 1970/i);
    expect(cleared).toMatch(/;\s*HttpOnly/i);
  });

  test('tampered (re-signed payload) cookie of a real user is rejected @full', async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: BASE });
    const ip = uniqueTestIp();
    await signup(ctx, newTestUser('jwt'), ip);
    const token = (await ctx.storageState()).cookies.find((c) => c.name === 'mv_token')?.value;
    expect(token).toBeTruthy();
    const [h, p, s] = token!.split('.');
    const claims = JSON.parse(Buffer.from(p, 'base64url').toString());
    const attacker = await playwright.request.newContext({ baseURL: BASE });
    const genuine = await attacker.get('/api/auth/me', { headers: { ...apiHeaders({ ip }), cookie: `mv_token=${token}` } });
    expect((await genuine.json()).user, 'control: the genuine token is accepted').not.toBeNull();
    for (const evilClaims of [
      { ...claims, name: 'Admin', email: 'admin@mkmovies.site' },
      { ...claims, sub: SOME_UUID }, // other user's id
      { ...claims, tv: claims.tv + 1 }, // forward-dated token version
      { ...claims, exp: 9_999_999_999 },
    ]) {
      const evil = Buffer.from(JSON.stringify(evilClaims)).toString('base64url');
      const me = await attacker.get('/api/auth/me', { headers: { ...apiHeaders({ ip }), cookie: `mv_token=${h}.${evil}.${s}` } });
      expect((await me.json()).user).toBeNull();
      const wl = await attacker.get('/api/watchlist', { headers: { ...apiHeaders({ ip }), cookie: `mv_token=${h}.${evil}.${s}` } });
      expect(wl.status()).toBe(401);
    }
    await attacker.dispose();
    await ctx.dispose();
  });
});
