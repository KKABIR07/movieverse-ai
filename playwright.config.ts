/**
 * Playwright config — E2E + security suites for mkmovies.
 *
 *   E2E_BASE_URL       target (default http://localhost:3000). Production: https://www.mkmovies.site
 *   E2E_START_SERVER=1 let Playwright run `npm run build && npm run start` itself (local only)
 *   E2E_CHROME_CHANNEL use an installed browser instead of Playwright's Chromium (e.g. "chrome")
 *   CI                 retries 1, forbid .only
 *
 * Tags (filter with --grep):
 *   @smoke  read-only, no signups → safe against PRODUCTION
 *   @full   creates users / reviews / chat messages, bursts the rate limiter → local or staging only
 *
 * See CLAUDE_REFERENCE/testing.md for the full runbook.
 */
import { defineConfig, devices } from '@playwright/test';

const BASE_URL = (process.env.E2E_BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
const isCI = Boolean(process.env.CI);
const channel = process.env.E2E_CHROME_CHANNEL || undefined;
const startServer = process.env.E2E_START_SERVER === '1';
const port = (() => {
  try {
    return new URL(BASE_URL).port || '3000';
  } catch {
    return '3000';
  }
})();

export default defineConfig({
  testDir: './tests',
  testMatch: ['e2e/**/*.spec.ts', 'security/**/*.spec.ts', 'perf/**/*.spec.ts'],
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  // Dev servers compile routes on first hit; keep worker count modest so the box isn't swamped.
  workers: process.env.E2E_WORKERS ? Number(process.env.E2E_WORKERS) : isCI ? 2 : 3,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: isCI
    ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }], ['json', { outputFile: 'test-results/results.json' }]]
    : [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    navigationTimeout: 45_000,
    actionTimeout: 15_000,
    ...(channel ? { channel } : {}),
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, ...(channel ? { channel } : {}) },
    },
    {
      name: 'mobile',
      use: {
        // Pixel-7-like, but on Chromium (devices['Pixel 7'] is Chromium already; pinned explicitly for clarity).
        ...devices['Pixel 7'],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2.625,
        isMobile: true,
        hasTouch: true,
        ...(channel ? { channel } : {}),
      },
      // Security/perf suites are viewport-independent: run them once (desktop).
      testIgnore: ['security/**', 'perf/**'],
    },
  ],
  webServer: startServer
    ? {
        command: `npm run build && npm run start -- -p ${port}`,
        url: `${BASE_URL}/api/health`,
        reuseExistingServer: !isCI,
        timeout: 600_000,
        stdout: 'pipe',
        stderr: 'pipe',
      }
    : undefined,
});
