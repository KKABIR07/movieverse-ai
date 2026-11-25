/**
 * Security suite (Playwright request API — no browser needed).
 *
 * @smoke tests are read-only (rejected at the proxy or validation layer, no data written) and are
 *        safe against production. They DO count against the per-IP rate limit, so run them once.
 * @full  tests sign up users / write reviews / burst the limiter → local or staging only.
 */
import { test, expect, type APIRequestContext } from '@playwright/test';
import { apiHeaders, expectStatus, FIGHT_CLUB, newTestUser, signup } from '../e2e/support/api';
import { uniqueTestIp } from '../e2e/support/fixtures';

const BASE = (process.env.E2E_BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
const IS_HTTPS = BASE.startsWith('https://');

test.describe('security headers @smoke', () => {
  for (const path of ['/', '/movie/550', '/api/health']) {
    test(`headers on ${path} @smoke`, async ({ request }) => {
      const res = await request.get(path);
      expect(res.status()).toBeLessThan(500);
      const h = res.headers();
      const csp = h['content-security-policy'] ?? '';
      expect(csp, 'Content-Security-Policy').toContain("default-src 'self'");
      expect(csp).toMatch(/object-src 'none'/);
      expect(csp).toMatch(/base-uri 'self'/);
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
    const res = await request.get('/api/auth/me', { headers: apiHeaders() });
    expect(res.headers()['cache-control'] ?? '').toMatch(/no-store|private/);
  });
});

test.describe('proxy gates @smoke', () => {
  test('TMDB proxy allowlist: /api/tmdb/account/1 → 404 @smoke', async ({ request }) => {
    for (const p of ['/api/tmdb/account/1', '/api/tmdb/authentication/token/new', '/api/tmdb/..%2F..%2Fetc%2Fpasswd']) {
      const res = await request.get(p, { headers: apiHeaders() });
      expect(res.status(), p).toBe(404);
    }
  });

  test('oversized body → 413 @smoke', async ({ request }) => {
    const big = JSON.stringify({ email: 'a@b.c', password: 'x'.repeat(70 * 1024) });
    const res = await request.post('/api/auth/login', {
      data: big,
      headers: { ...apiHeaders(), 'content-type': 'application/json' },
    });
    expect(res.status()).toBe(413);
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
  });

  test('text/plain POST (CSRF-style simple request) → 403 @smoke', async ({ request }) => {
    const res = await request.post('/api/reviews', {
      data: '{"movieId":550}',
      headers: { ...apiHeaders(), 'content-type': 'text/plain' },
    });
    expect(res.status()).toBe(403);
    expect((await res.json()).code).toBe('BAD_CONTENT_TYPE');
    const form = await request.post('/api/auth/login', {
      form: { email: 'a@b.c', password: 'x' },
      headers: apiHeaders(),
    });
    expect(form.status()).toBe(403);
  });

  test('protected endpoints require auth (401, JSON) @smoke', async ({ request }) => {
    for (const [method, path] of [
      ['GET', '/api/watchlist'],
      ['GET', '/api/follows'],
      ['POST', '/api/chat'],
      ['POST', '/api/reviews'],
      ['POST', '/api/auth/logout-all'],
    ] as const) {
      const res = await request.fetch(path, { method, headers: apiHeaders(), ...(method === 'POST' ? { data: {} } : {}) });
      expect(res.status(), `${method} ${path}`).toBe(401);
      expect(res.headers()['content-type']).toMatch(/application\/json/);
    }
  });
});

test.describe('input validation @smoke', () => {
  const INJECTIONS: { name: string; method: 'GET' | 'POST'; path: string; data?: unknown; expect: number[] }[] = [
    { name: 'NoSQL operator in login email', method: 'POST', path: '/api/auth/login', data: { email: { $gt: '' }, password: 'x' }, expect: [400] },
    { name: 'NoSQL operator in login password', method: 'POST', path: '/api/auth/login', data: { email: 'a@b.c', password: { $ne: null } }, expect: [400] },
    { name: 'array instead of string', method: 'POST', path: '/api/auth/login', data: { email: ['a@b.c'], password: 'x' }, expect: [400] },
    { name: 'malformed JSON', method: 'POST', path: '/api/auth/login', data: '{"email": "a@b.c", ', expect: [400] },
    { name: 'SQL-ish movieId', method: 'GET', path: "/api/reviews?movieId=1%20OR%201%3D1", expect: [400] },
    { name: 'operator movieId', method: 'GET', path: '/api/reviews?movieId[$gt]=0', expect: [400] },
    { name: 'negative movieId', method: 'GET', path: '/api/reviews?movieId=-1', expect: [400] },
    { name: 'huge movieId', method: 'GET', path: '/api/reviews?movieId=99999999999999999999', expect: [400] },
    { name: 'SQL-ish follow counts', method: 'GET', path: '/api/follows/counts?ids=1;DROP%20TABLE%20users', expect: [400] },
    { name: 'quote in chat room', method: 'GET', path: "/api/chat?roomId=general'%20OR%20'1'='1", expect: [400] },
    { name: 'bad chat cursor', method: 'GET', path: '/api/chat?roomId=general&after=yesterday', expect: [400] },
    { name: 'tmdb param injection', method: 'GET', path: '/api/tmdb/search/multi?query=%27%3B--&api_key=leak', expect: [200, 400] },
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
      const text = await res.text();
      expect(text, 'no stack traces / driver errors in responses').not.toMatch(/at \w+ \(|MongoServerError|SequelizeError|syntax error at or near|node_modules/);
    });
  }
});

test.describe('session tampering @smoke', () => {
  function b64url(o: unknown): string {
    return Buffer.from(JSON.stringify(o)).toString('base64url');
  }
  const forged = [
    // alg=none
    `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url({ sub: '0'.repeat(24), name: 'x', email: 'x@x.x', initials: 'X', tv: 0 })}.`,
    // HS256 signed with a guessed secret
    `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: 'a'.repeat(24), name: 'admin', email: 'admin@x.x', initials: 'A', tv: 0, exp: 9999999999 })}.${'A'.repeat(43)}`,
    'not-a-jwt',
    'x'.repeat(5000),
  ];

  for (const [i, token] of forged.entries()) {
    test(`forged session cookie #${i + 1} is treated as logged out @smoke`, async ({ request }) => {
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
  async function burst(request: APIRequestContext, headersFor: (i: number) => Record<string, string>, n = 14) {
    const statuses: number[] = [];
    let retryAfter: string | undefined;
    for (let i = 0; i < n; i++) {
      const res = await request.post('/api/auth/login', {
        data: { email: `nobody-${i}@example.com`, password: 'wrong-password' },
        headers: headersFor(i),
      });
      statuses.push(res.status());
      if (res.status() === 429) retryAfter = res.headers()['retry-after'];
    }
    return { statuses, retryAfter };
  }

  test('burst on /api/auth/login → 429 with Retry-After @full', async ({ request }) => {
    const lastHop = uniqueTestIp();
    const { statuses, retryAfter } = await burst(request, () => ({ 'x-forwarded-for': lastHop }));
    expect(statuses, statuses.join(',')).toContain(429);
    expect(statuses.slice(0, 5).every((s) => s === 401), 'first attempts are normal 401s').toBe(true);
    expect(Number(retryAfter)).toBeGreaterThanOrEqual(1);
  });

  test('spoofed leading X-Forwarded-For does not reset the limit @full', async ({ request }) => {
    const lastHop = uniqueTestIp();
    const { statuses } = await burst(request, (i) => ({ 'x-forwarded-for': `10.${i}.${i}.${i}, 1.2.3.${i}, ${lastHop}` }));
    expect(statuses, `statuses: ${statuses.join(',')}`).toContain(429);
  });

  test('normal browsing (12 full page loads/min) never gets /api/auth/me throttled @full', async ({ browser }) => {
    const context = await browser.newContext();
    const ip = uniqueTestIp();
    await context.route('**/api/**', (route) => route.continue({ headers: { ...route.request().headers(), 'x-real-ip': ip } }));
    const page = await context.newPage();
    const throttled: string[] = [];
    page.on('response', (r) => {
      if (r.status() === 429) throttled.push(r.url());
    });
    for (let i = 0; i < 12; i++) await page.goto(i % 2 ? '/about' : '/blog', { waitUntil: 'networkidle' }).catch(() => undefined);
    await context.close();
    expect(throttled, 'a signed-out visitor reloading pages should not be rate limited').toEqual([]);
  });
});

test.describe('authorization @full', () => {
  test('IDOR: user B cannot delete user A’s review (403/404) @full', async ({ playwright }) => {
    const ctxA = await playwright.request.newContext({ baseURL: BASE });
    const ctxB = await playwright.request.newContext({ baseURL: BASE });
    const ipA = uniqueTestIp();
    const ipB = uniqueTestIp();
    await signup(ctxA, newTestUser('idora'), ipA);
    await signup(ctxB, newTestUser('idorb'), ipB);

    const created = await ctxA.post('/api/reviews', {
      data: { movieId: FIGHT_CLUB.id, movieTitle: FIGHT_CLUB.title, rating: 7, content: 'IDOR probe' },
      headers: apiHeaders({ ip: ipA }),
    });
    await expectStatus(created, 201);
    const id = (await created.json()).review.id as string;

    const del = await ctxB.delete(`/api/reviews?id=${encodeURIComponent(id)}`, { headers: apiHeaders({ ip: ipB }) });
    expect([403, 404]).toContain(del.status());

    // B's "edit" of the same movie creates/updates B's own review, never A's
    const bEdit = await ctxB.post('/api/reviews', {
      data: { movieId: FIGHT_CLUB.id, movieTitle: FIGHT_CLUB.title, rating: 1, content: 'hijack attempt' },
      headers: apiHeaders({ ip: ipB }),
    });
    await expectStatus(bEdit, 200, 201);
    expect((await bEdit.json()).review.id).not.toBe(id);

    const list = (await (await ctxA.get(`/api/reviews?movieId=${FIGHT_CLUB.id}`, { headers: apiHeaders({ ip: ipA }) })).json()).reviews as {
      id: string;
      content: string;
    }[];
    expect(list.find((r) => r.id === id)?.content).toBe('IDOR probe');

    // Watchlists are per user
    await ctxA.post('/api/watchlist', { data: { id: 13, media_type: 'movie', title: 'Forrest Gump' }, headers: apiHeaders({ ip: ipA }) });
    const bList = (await (await ctxB.get('/api/watchlist', { headers: apiHeaders({ ip: ipB }) })).json()).items as { id: number }[];
    expect(bList.some((i) => i.id === 13)).toBe(false);

    await ctxA.delete(`/api/reviews?id=${encodeURIComponent(id)}`, { headers: apiHeaders({ ip: ipA }) });
    await ctxA.dispose();
    await ctxB.dispose();
  });

  test('session cookie flags: HttpOnly, SameSite=Lax, Secure on https @full', async ({ request }) => {
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
    if (IS_HTTPS) expect(setCookie).toMatch(/;\s*Secure/i);
    // body never echoes the token or password hash
    const body = JSON.stringify(await res.json());
    expect(body).not.toMatch(/eyJ[\w-]+\.eyJ|passwordHash|\$2[aby]\$/);
  });

  test('tampered (re-signed payload) cookie of a real user is rejected @full', async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: BASE });
    const ip = uniqueTestIp();
    await signup(ctx, newTestUser('jwt'), ip);
    const state = await ctx.storageState();
    const token = state.cookies.find((c) => c.name === 'mv_token')?.value;
    expect(token).toBeTruthy();
    const [h, p, s] = token!.split('.');
    const claims = JSON.parse(Buffer.from(p, 'base64url').toString());
    const evil = Buffer.from(JSON.stringify({ ...claims, name: 'Admin', email: 'admin@mkmovies.site' })).toString('base64url');
    // Fresh context so the jar's genuine cookie can't ride along.
    const attacker = await playwright.request.newContext({ baseURL: BASE });
    const genuine = await attacker.get('/api/auth/me', { headers: { ...apiHeaders({ ip }), cookie: `mv_token=${token}` } });
    expect((await genuine.json()).user, 'control: the genuine token is accepted').not.toBeNull();
    const me = await attacker.get('/api/auth/me', { headers: { ...apiHeaders({ ip }), cookie: `mv_token=${h}.${evil}.${s}` } });
    expect((await me.json()).user).toBeNull();
    await attacker.dispose();
    await ctx.dispose();
  });
});
