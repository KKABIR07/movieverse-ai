/**
 * Horizontal rails must never scroll vertically: a vertical mouse wheel over any rail (incl. the Top 10 with
 * its oversized numerals, whose glyphs overflow their line box) scrolls the page, not the rail.
 */
import { test, expect, isMobileProject } from './support/fixtures';
import { requireTmdb } from './support/env';

test('rails never scroll vertically; the wheel over Top 10 scrolls the page @smoke', async ({ page }, info) => {
  test.skip(isMobileProject(info.project.name), 'mouse-wheel check runs on desktop');
  requireTmdb();
  await page.goto('/');
  const top10 = page.locator('section', { has: page.getByRole('heading', { name: /top 10/i }) }).first();
  await top10.scrollIntoViewIfNeeded();

  const verticallyScrollable = await page.locator('main ul').evaluateAll((uls) =>
    uls
      .filter((u) => getComputedStyle(u).overflowX !== 'visible' && getComputedStyle(u).overflowY !== 'hidden')
      .filter((u) => u.scrollHeight > u.clientHeight + 1)
      .map((u) => u.getAttribute('aria-label') ?? u.parentElement?.querySelector('h2')?.textContent ?? 'rail'),
  );
  expect(verticallyScrollable, 'rails that can scroll vertically').toEqual([]);

  const track = top10.locator('ul').first();
  const box = (await track.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const before = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 400);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before + 100);
  expect(await track.evaluate((u) => u.scrollTop)).toBe(0);
});
