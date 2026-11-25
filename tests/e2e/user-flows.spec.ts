/**
 * @full user flows — CREATE DATA (users, reviews, chat messages, follows). Local / staging only.
 * Never run against production (`--grep @smoke` there).
 *
 * Each test signs up its own unique user (`e2e+<label>-<ts>@example.com`) in its own browser
 * context, and routes /api/** through a unique X-Real-IP so the per-IP auth bucket (10/min)
 * does not throttle the run (see support/fixtures.ts → spreadIpForContext).
 *
 * UI steps use roles/labels only; data assertions go through the public JSON API contract.
 */
import type { Browser, BrowserContext, Page } from '@playwright/test';
import { test, expect, settle, spreadIpForContext, uniqueTestIp, isMobileProject, hideDevOverlay } from './support/fixtures';
import {
  apiHeaders,
  expectSignedIn,
  expectSignedOut,
  expectStatus,
  FIGHT_CLUB,
  login,
  newTestUser,
  signup,
  type TestUser,
} from './support/api';

test.describe.configure({ mode: 'parallel' });

interface Session {
  context: BrowserContext;
  page: Page;
  user: TestUser;
  ip: string;
}

async function newSession(browser: Browser, label: string, opts: { viaUi?: boolean; user?: TestUser } = {}): Promise<Session> {
  const context = await browser.newContext();
  await hideDevOverlay(context);
  const ip = await spreadIpForContext(context, uniqueTestIp());
  const page = await context.newPage();
  const user = opts.user ?? newTestUser(label);
  if (opts.user) {
    await expectStatus(await login(page.request, user, ip), 200);
  } else {
    await signup(page.request, user, ip);
  }
  return { context, page, user, ip };
}

/** Person ids differ per project so desktop + mobile runs never race on the same follower count. */
const personFor = (project: string) => (isMobileProject(project) ? { id: 819, name: 'Edward Norton' } : { id: 287, name: 'Brad Pitt' });

test.describe('auth @full', () => {
  test('signup via dialog, logout, login @full', async ({ browser }) => {
    const context = await browser.newContext();
    await hideDevOverlay(context);
    const ip = await spreadIpForContext(context);
    const page = await context.newPage();
    const user = newTestUser('ui');

    await page.goto('/');
    await settle(page, 5_000);
    await page.getByRole('banner').getByRole('button', { name: /^sign in$/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('tab', { name: /create account/i }).click();
    await dialog.getByLabel(/^name$/i).fill(user.name);
    await dialog.getByLabel(/email/i).fill(user.email);
    await dialog.getByLabel(/^password$/i).fill(user.password);
    await dialog.getByRole('button', { name: /^create account$/i }).click();
    await expect(dialog).toBeHidden({ timeout: 20_000 });
    const account = page.getByRole('button', { name: new RegExp(`account menu for ${user.name}`, 'i') });
    await expect(account).toBeVisible();
    await expectSignedIn(page.request, user.email, ip);

    // Logout through the account menu
    await account.click();
    await page.getByRole('menuitem', { name: /sign out/i }).click();
    await expect(page.getByRole('banner').getByRole('button', { name: /^sign in$/i })).toBeVisible();
    await expectSignedOut(page.request, ip);

    // Login through the dialog
    await page.getByRole('banner').getByRole('button', { name: /^sign in$/i }).click();
    await dialog.getByLabel(/email/i).fill(user.email);
    await dialog.getByLabel(/^password$/i).fill(user.password);
    await dialog.getByRole('button', { name: /^sign in$/i }).click();
    await expect(dialog).toBeHidden({ timeout: 20_000 });
    await expect(account).toBeVisible();
    await expectSignedIn(page.request, user.email, ip);
    await context.close();
  });

  test('signup rejects duplicate email (409) and wrong password (401) @full', async ({ request }) => {
    const user = newTestUser('dup');
    const ip = uniqueTestIp();
    await signup(request, user, ip);
    const dup = await request.post('/api/auth/signup', { data: user, headers: apiHeaders({ ip }) });
    expect(dup.status()).toBe(409);
    const bad = await login(request, { email: user.email, password: 'definitely-wrong' }, ip);
    expect(bad.status()).toBe(401);
    expect((await bad.json()).code).toBe('INVALID_CREDENTIALS');
  });

  test('logout-all invalidates the session in another browser context @full', async ({ browser }) => {
    const a = await newSession(browser, 'la');
    const b = await newSession(browser, 'lb', { user: a.user });
    await expectSignedIn(b.page.request, a.user.email, b.ip);

    const res = await a.page.request.post('/api/auth/logout-all', { headers: apiHeaders({ ip: a.ip }) });
    await expectStatus(res, 200);

    await expectSignedOut(a.page.request, a.ip);
    await expectSignedOut(b.page.request, b.ip);
    const wl = await b.page.request.get('/api/watchlist', { headers: apiHeaders({ ip: b.ip }) });
    expect(wl.status(), 'revoked token must not reach protected endpoints').toBe(401);
    // And the UI in context B shows signed-out after a reload.
    await b.page.goto('/');
    await expect(b.page.getByRole('banner').getByRole('button', { name: /^sign in$/i })).toBeVisible();
    await a.context.close();
    await b.context.close();
  });
});

test.describe('watchlist @full', () => {
  test('movie and TV show with the same id are distinct; remove one @full', async ({ browser }) => {
    const s = await newSession(browser, 'wl');
    const h = apiHeaders({ ip: s.ip });
    await expectStatus(
      await s.page.request.post('/api/watchlist', {
        data: { id: 550, media_type: 'movie', title: FIGHT_CLUB.title, poster_path: FIGHT_CLUB.poster, vote_average: 8.4 },
        headers: h,
      }),
      201,
    );
    await expectStatus(
      await s.page.request.post('/api/watchlist', { data: { id: 550, media_type: 'tv', name: 'TV 550', vote_average: 7 }, headers: h }),
      201,
    );
    // idempotent re-add
    await expectStatus(await s.page.request.post('/api/watchlist', { data: { id: 550, media_type: 'tv', name: 'TV 550' }, headers: h }), 200);

    let items = (await (await s.page.request.get('/api/watchlist', { headers: h })).json()).items as { id: number; media_type: string }[];
    expect(items.map((i) => `${i.media_type}:${i.id}`).sort()).toEqual(['movie:550', 'tv:550']);

    const del = await s.page.request.delete('/api/watchlist?id=550&media_type=tv', { headers: h });
    await expectStatus(del, 200);
    items = (await (await s.page.request.get('/api/watchlist', { headers: h })).json()).items;
    expect(items.map((i) => `${i.media_type}:${i.id}`)).toEqual(['movie:550']);
    await s.context.close();
  });

  test('watchlist added in the UI persists across reload and storage wipe (server-backed) @full', async ({ browser }) => {
    const s = await newSession(browser, 'wlui');
    await s.page.goto('/movie/550');
    const add = s.page.getByRole('button', { name: /add .*fight club.* to watchlist/i }).first();
    await expect(add).toBeVisible({ timeout: 20_000 });
    await add.click();
    await expect(s.page.getByRole('button', { name: /remove .*fight club.* from watchlist/i }).first()).toBeVisible();

    // Server must know about it (the whole point of a signed-in watchlist).
    await expect
      .poll(async () => {
        const r = await s.page.request.get('/api/watchlist', { headers: apiHeaders({ ip: s.ip }) });
        return ((await r.json()).items as { id: number; media_type: string }[]).map((i) => `${i.media_type}:${i.id}`);
      }, { message: 'UI add should be persisted via /api/watchlist', timeout: 10_000 })
      .toContain('movie:550');

    // Wipe client storage → a server-backed list must come back after reload.
    await s.page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await s.page.goto('/watchlist');
    await expect(s.page.locator('main a[href="/movie/550"]').first()).toBeVisible({ timeout: 20_000 });
    await s.context.close();
  });

  test('share link round-trips a unicode list name @full', async ({ browser }) => {
    const s = await newSession(browser, 'share');
    await s.context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const listName = 'Été 🎬 映画 — ñandú';

    await s.page.goto('/watchlist');
    await s.page.getByRole('button', { name: /new list|create list/i }).first().click();
    await s.page.getByRole('textbox').last().fill(listName);
    await s.page.getByRole('button', { name: /^create( list)?$/i }).click();
    await expect(s.page.getByText(listName).first()).toBeVisible();

    await s.page.goto('/movie/550');
    await s.page.getByRole('button', { name: /add .*fight club.* to watchlist/i }).first().click();

    await s.page.goto('/watchlist');
    await s.page.getByText(listName).first().click();
    await s.page.getByRole('button', { name: /^share$/i }).click();
    await expect(s.page.getByRole('button', { name: /copied/i })).toBeVisible({ timeout: 5_000 });
    const link = await s.page.evaluate(() => navigator.clipboard.readText());
    expect(link).toMatch(/\/watchlist\/share\?/);

    const viewer = await browser.newContext();
    const vp = await viewer.newPage();
    await vp.goto(link);
    await expect(vp.getByRole('heading', { level: 1 })).toContainText(listName);
    await expect(vp.locator('main a[href="/movie/550"]').first()).toBeVisible();
    await viewer.close();
    await s.context.close();
  });
});

test.describe('reviews @full', () => {
  test('write, edit, like/unlike, delete a review @full', async ({ browser }) => {
    const a = await newSession(browser, 'rva');
    const b = await newSession(browser, 'rvb');
    const ha = apiHeaders({ ip: a.ip });
    const hb = apiHeaders({ ip: b.ip });
    const movieId = 550;
    const base = { movieId, movieTitle: FIGHT_CLUB.title, moviePoster: FIGHT_CLUB.poster, spoiler: false };

    const created = await a.page.request.post('/api/reviews', { data: { ...base, rating: 8, content: `E2E review ${a.user.email}` }, headers: ha });
    await expectStatus(created, 201);
    const review = (await created.json()).review as { id: string; isMine: boolean; rating: number };
    expect(review.isMine).toBe(true);

    const edited = await a.page.request.post('/api/reviews', { data: { ...base, rating: 6, content: 'Edited E2E review' }, headers: ha });
    await expectStatus(edited, 200);
    expect((await edited.json()).review).toMatchObject({ id: review.id, rating: 6, content: 'Edited E2E review' });

    const liked = await b.page.request.post('/api/reviews/like', { data: { id: review.id, like: true }, headers: hb });
    await expectStatus(liked, 200);
    expect((await liked.json()).review).toMatchObject({ likeCount: 1, likedByMe: true, isMine: false });
    const likedTwice = await b.page.request.post('/api/reviews/like', { data: { id: review.id, like: true }, headers: hb });
    expect((await likedTwice.json()).review.likeCount, 'like is idempotent').toBe(1);
    const unliked = await b.page.request.post('/api/reviews/like', { data: { id: review.id, like: false }, headers: hb });
    expect((await unliked.json()).review).toMatchObject({ likeCount: 0, likedByMe: false });

    // Public listing shows it, without leaking user ids
    const list = await (await b.page.request.get(`/api/reviews?movieId=${movieId}`, { headers: hb })).json();
    const mine = (list.reviews as Record<string, unknown>[]).find((r) => r.id === review.id);
    expect(mine).toBeTruthy();
    expect(Object.keys(mine!)).not.toContain('userId');
    expect(Object.keys(mine!)).not.toContain('likedBy');

    await expectStatus(await a.page.request.delete(`/api/reviews?id=${encodeURIComponent(review.id)}`, { headers: ha }), 200);
    const after = await (await a.page.request.get(`/api/reviews?movieId=${movieId}`, { headers: ha })).json();
    expect((after.reviews as { id: string }[]).some((r) => r.id === review.id)).toBe(false);
    await a.context.close();
    await b.context.close();
  });

  test('a review stored on the server is shown on the movie page @full', async ({ browser }) => {
    const a = await newSession(browser, 'rvui');
    const content = `Server-backed review ${Date.now()}`;
    await expectStatus(
      await a.page.request.post('/api/reviews', {
        data: { movieId: 550, movieTitle: FIGHT_CLUB.title, rating: 9, content, spoiler: false },
        headers: apiHeaders({ ip: a.ip }),
      }),
      201,
    );
    const viewer = await browser.newContext();
    const vp = await viewer.newPage();
    await vp.goto('/movie/550');
    await expect(vp.getByText(content)).toBeVisible({ timeout: 20_000 });
    await viewer.close();
    await a.context.close();
  });
});

test.describe('follows @full', () => {
  test('follow / unfollow a person changes the follower count @full', async ({ browser }, info) => {
    const person = personFor(info.project.name);
    const s = await newSession(browser, 'fol');
    const h = apiHeaders({ ip: s.ip });
    const count = async () =>
      ((await (await s.page.request.get(`/api/follows/counts?ids=${person.id}`, { headers: h })).json()).counts[person.id] as number | undefined) ?? 0;

    const before = await count();
    await s.page.goto(`/person/${person.id}`);
    const follow = s.page.getByRole('button', { name: /^follow\b/i }).first();
    await expect(follow).toBeVisible({ timeout: 20_000 });
    await follow.click();
    await expect(s.page.getByRole('button', { name: /^following\b|unfollow/i }).first()).toBeVisible();
    await expect.poll(count, { timeout: 10_000 }).toBe(before + 1);

    // GET /api/follows lists it
    const following = (await (await s.page.request.get('/api/follows', { headers: h })).json()).following as { personId: number }[];
    expect(following.map((f) => f.personId)).toContain(person.id);

    await s.page.getByRole('button', { name: /^following\b|unfollow/i }).first().click();
    await expect(s.page.getByRole('button', { name: /^follow\b/i }).first()).toBeVisible();
    await expect.poll(count, { timeout: 10_000 }).toBe(before);
    await s.context.close();
  });
});

test.describe('chat @full', () => {
  test('a message sent in a room is seen by another user @full', async ({ browser }) => {
    const a = await newSession(browser, 'cha');
    const b = await newSession(browser, 'chb');
    const text = `hello from e2e ${Date.now()}`;

    for (const s of [a, b]) {
      await s.page.goto('/about');
      await settle(s.page, 5_000);
      await s.page.getByRole('banner').getByRole('button', { name: /community chat/i }).click();
      await expect(s.page.getByRole('dialog', { name: /community chat/i })).toBeVisible();
    }

    const panelA = a.page.getByRole('dialog', { name: /community chat/i });
    await panelA.getByRole('textbox', { name: /message #/i }).fill(text);
    await panelA.getByRole('button', { name: /send message/i }).click();
    await expect(panelA.getByText(text)).toBeVisible();

    // B polls every ~5 s
    await expect(b.page.getByRole('dialog', { name: /community chat/i }).getByText(text)).toBeVisible({ timeout: 20_000 });

    // API contract: isMine is per-viewer, no user ids leak
    const msgs = (await (await b.page.request.get('/api/chat?roomId=general', { headers: apiHeaders({ ip: b.ip }) })).json())
      .messages as Record<string, unknown>[];
    const m = msgs.find((x) => x.text === text);
    expect(m).toMatchObject({ isMine: false });
    expect(Object.keys(m!)).not.toContain('userId');
    await a.context.close();
    await b.context.close();
  });
});
