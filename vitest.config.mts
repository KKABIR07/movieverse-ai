import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit + integration tests live next to the code as *.test.ts(x) or under tests/unit|integration.
// Playwright suites (tests/e2e, tests/security, tests/perf) are excluded here; run them with `npm run test:e2e`.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'tests/{unit,integration}/**/*.test.{ts,tsx}'],
    // Playwright suites (browser / live-server) never run under vitest.
    exclude: ['node_modules', '.next', '.claude/**', 'tests/e2e/**', 'tests/security/**', 'tests/perf/**', 'scripts/qa/**'],
    testTimeout: 30_000,
    hookTimeout: 120_000, // PGlite boot + migrations in integration suites
    coverage: { provider: 'v8', include: ['src/lib/**', 'src/app/api/**', 'src/store/**'] },
  },
});
