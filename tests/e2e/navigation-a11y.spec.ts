/**
 * @smoke navigation + accessibility — read-only, safe against production.
 * Shell contract (see src/components/README.md): skip link, Primary nav, search command palette
 * (Ctrl+K), Sign in dialog, Mobile tab bar (< 768px), footer.
 */
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect, settle, isMobileProject } from './support/fixtures';
import { requireTmdb } from './support/env';

const PRIMARY = [
  { name: 'Home', href: '/' },
  { name: 'Movies', href: '/movies' },
  { name: 'TV shows', href: '/tv' },
  { name: 'Discover', href: '/discover' },
  { name: 'Shorts', href: '/shorts' },
  { name: 'People', href: '/stars' },
];

const searchDialog = (page: import('@playwright/test').Page) => page.getByRole('dialog', { name: /search/i });
const searchBox = (page: import('@playwright/test').Page) =>
  searchDialog(page).getByRole('combobox', { name: /search/i });

test.describe('navigation @smoke', () => {
  test('skip link moves focus to main content @smoke', async ({ page }, info) => {
    test.skip(isMobileProject(info.project.name), 'keyboard-first check runs on desktop');
    await page.goto('/');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: /skip to (main )?content/i });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible(); // visible when focused
    await page.keyboard.press('Enter');
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName.toLowerCase()))
      .toMatch(/^(main)$/);
  });

  test('primary header navigation links @smoke', async ({ page }, info) => {
    test.skip(isMobileProject(info.project.name), 'header nav is hidden below 768px');
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Primary' });
    for (const { name, href } of PRIMARY) {
      await expect(nav.getByRole('link', { name, exact: true })).toHaveAttribute('href', href);
    }
    await nav.getByRole('link', { name: 'Movies', exact: true }).click();
    await expect(page).toHaveURL(/\/movies$/);
    await expect(nav.getByRole('link', { name: 'Movies', exact: true })).toHaveAttribute('aria-current', 'page');
  });

  test('Ctrl+K palette: search "inception", Enter opens a detail page @smoke', async ({ page }, info) => {
    test.skip(isMobileProject(info.project.name), 'keyboard shortcut is a desktop affordance');
    requireTmdb(); // live suggestions come from /api/tmdb/search/multi
    await page.goto('/');
    await settle(page, 5_000);
    await page.keyboard.press('Control+k');
    await expect(searchDialog(page)).toBeVisible();
    await expect(searchBox(page)).toBeFocused();
    await searchBox(page).fill('inception');
    const firstResult = searchDialog(page).getByRole('option', { name: /inception/i }).first();
    await expect(firstResult).toBeVisible({ timeout: 20_000 });
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/(movie|tv|person)\/\d+|\/search\?q=inception/i);
    await expect(searchDialog(page)).toBeHidden();
  });

  test('Esc closes the palette and returns focus to the trigger @smoke', async ({ page }, info) => {
    test.skip(isMobileProject(info.project.name), 'header trigger is desktop');
    await page.goto('/');
    const trigger = page.getByRole('banner').getByRole('button', { name: /^search/i }).first();
    await trigger.click();
    await expect(searchDialog(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(searchDialog(page)).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('Sign in opens the auth dialog @smoke', async ({ page }) => {
    await page.goto('/');
    await settle(page, 5_000);
    await page.getByRole('banner').getByRole('button', { name: /^sign in$/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel(/email/i)).toBeVisible();
    await expect(dialog.getByLabel(/^password$/i)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('mobile tab bar navigates @smoke', async ({ page }, info) => {
    test.skip(!isMobileProject(info.project.name), 'tab bar only exists below 768px');
    await page.goto('/');
    const tabs = page.getByRole('navigation', { name: 'Mobile' });
    await expect(tabs).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeHidden();

    await tabs.getByRole('link', { name: 'Discover' }).tap();
    await expect(page).toHaveURL(/\/discover$/);
    await tabs.getByRole('link', { name: 'Shorts' }).tap();
    await expect(page).toHaveURL(/\/shorts$/);
    await tabs.getByRole('link', { name: 'Home' }).tap();
    await expect(page).toHaveURL(/\/$/);

    await tabs.getByRole('button', { name: 'Search' }).tap();
    await expect(searchDialog(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(searchDialog(page)).toBeHidden();

    // Signed out → Watchlist asks to sign in.
    await tabs.getByRole('button', { name: /watchlist/i }).tap();
    await expect(page.getByRole('dialog')).toBeVisible();
  });
});

// ─── axe-core (optional) ────────────────────────────────────────────────────────
// @axe-core/playwright is not a dependency. If the axe-core package is resolvable (it currently
// arrives transitively via eslint-plugin-jsx-a11y) we inject it directly; otherwise we skip with a
// clear message. Recommended: add `@axe-core/playwright` (or `axe-core`) as a devDependency.

function loadAxeSource(): string | null {
  try {
    const req = createRequire(join(process.cwd(), 'package.json'));
    const p = req.resolve('axe-core/axe.min.js');
    return existsSync(p) ? readFileSync(p, 'utf8') : null;
  } catch {
    return null;
  }
}

const AXE = loadAxeSource();
// Pages A (merged) + one Pages B detail page (tagged so the report shows which branch owns it).
const AXE_PAGES = ['/', '/discover', '/search?q=batman', '/stars', '/movie/550'];

interface AxeViolation {
  id: string;
  impact: string | null;
  help: string;
  nodes: { target: string[] }[];
}

test.describe('axe accessibility @smoke', () => {
  test.use({ bypassCSP: true }); // a future nonce-based CSP must not block the injected axe script
  test.skip(!AXE, 'axe-core not installed — add "@axe-core/playwright" (or "axe-core") as a devDependency');

  for (const path of AXE_PAGES) {
    test(`axe: no serious/critical WCAG A/AA violations on ${path} @smoke${path.startsWith('/movie/') ? ' @pagesB' : ''}`, async ({ page }) => {
      requireTmdb();
      await page.goto(path);
      await settle(page);
      await page.addScriptTag({ content: AXE! });
      const violations = await page.evaluate(async () => {
        const axe = (window as unknown as { axe: { run: (ctx: unknown, opts: unknown) => Promise<{ violations: AxeViolation[] }> } }).axe;
        const r = await axe.run(document, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
          resultTypes: ['violations'],
        });
        return r.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          nodes: v.nodes.slice(0, 3).map((n) => ({ target: n.target })),
        }));
      });
      const blocking = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(
        blocking,
        blocking.map((v) => `${v.impact} ${v.id}: ${v.help} → ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`).join('\n'),
      ).toEqual([]);
    });
  }
});
