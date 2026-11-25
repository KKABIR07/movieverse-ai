/**
 * Moving trailers (home hero background + hover previews on cards) and the brand icon set.
 */
import { test, expect, isMobileProject } from './support/fixtures';
import { requireTmdb } from './support/env';

const YT_FRAME = 'iframe[src*="youtube-nocookie.com/embed/"]';

test.describe('trailers @smoke', () => {
  test('home hero plays the current slide trailer muted in the background @smoke', async ({ page }) => {
    requireTmdb();
    await page.goto('/');
    const hero = page.locator('section[aria-roledescription="carousel"]');
    const frame = hero.locator(YT_FRAME).first();
    await expect(frame).toBeAttached({ timeout: 15_000 });
    const src = new URL((await frame.getAttribute('src'))!);
    expect(src.searchParams.get('autoplay')).toBe('1');
    expect(src.searchParams.get('mute')).toBe('1');
    expect(src.searchParams.get('controls')).toBe('0');
    // purely decorative: never focusable, never clickable
    expect(await frame.getAttribute('tabindex')).toBe('-1');
    await expect(frame.locator('xpath=..')).toHaveAttribute('aria-hidden', 'true');
  });

  test('no background video with prefers-reduced-motion @smoke', async ({ page }) => {
    requireTmdb();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.waitForTimeout(4_000);
    await expect(page.locator(YT_FRAME)).toHaveCount(0);
  });

  test('pausing the slideshow stops the background video @smoke', async ({ page }) => {
    requireTmdb();
    await page.goto('/');
    const hero = page.locator('section[aria-roledescription="carousel"]');
    await expect(hero.locator(YT_FRAME)).toBeAttached({ timeout: 15_000 });
    await hero.getByRole('button', { name: 'Pause slideshow' }).click();
    await expect(hero.locator(YT_FRAME)).toHaveCount(0);
  });

  test('hovering a poster plays its trailer; leaving stops it @smoke', async ({ page }, info) => {
    test.skip(isMobileProject(info.project.name), 'hover previews are for pointer devices');
    requireTmdb();
    await page.goto('/');
    const card = page.locator('main article').first();
    await card.scrollIntoViewIfNeeded();
    await card.hover();
    await expect(card.locator(YT_FRAME)).toBeAttached({ timeout: 10_000 });
    await page.mouse.move(2, 2);
    await expect(card.locator(YT_FRAME)).toHaveCount(0);
  });

  test('no hover previews on touch screens @smoke', async ({ page }, info) => {
    test.skip(!isMobileProject(info.project.name), 'touch-only check');
    requireTmdb();
    await page.goto('/');
    const card = page.locator('main article').first();
    await card.scrollIntoViewIfNeeded();
    // a stray pointer-over on a (hover: none) device must not start a player
    await card.hover();
    await page.waitForTimeout(1_500);
    await expect(card.locator(YT_FRAME)).toHaveCount(0);
  });
});

test.describe('brand icons @smoke', () => {
  test.skip(({ isMobile }) => isMobile, 'viewport-independent');

  test('favicon.ico, icon, apple-touch-icon and manifest icons are served @smoke', async ({ page, request }) => {
    const ico = await request.get('/favicon.ico');
    expect(ico.status()).toBe(200);
    expect(ico.headers()['content-type']).toMatch(/icon/);
    const body = await ico.body();
    expect(body.readUInt16LE(2), 'ICO type').toBe(1);
    expect(body.readUInt16LE(4), 'ICO image count').toBeGreaterThanOrEqual(3);

    await page.goto('/about');
    for (const rel of ['icon', 'apple-touch-icon', 'manifest']) {
      const href = await page.locator(`link[rel="${rel}"]`).first().getAttribute('href');
      expect(href, `<link rel="${rel}">`).toBeTruthy();
      const res = await request.get(href!);
      expect(res.status(), `${rel} → ${href}`).toBe(200);
    }

    const manifest = await (await request.get('/manifest.webmanifest')).json();
    expect(manifest.name).toBe('mkmovies');
    for (const icon of manifest.icons as { src: string; sizes: string }[]) {
      const res = await request.get(icon.src);
      expect(res.status(), icon.src).toBe(200);
      expect(res.headers()['content-type']).toBe('image/png');
    }
  });

  test('header shows the brand logo @smoke', async ({ page }) => {
    await page.goto('/about');
    const logo = page.getByRole('link', { name: 'mkmovies home' }).first();
    await expect(logo).toBeVisible();
    await expect(logo).toContainText('mkmovies');
  });
});
