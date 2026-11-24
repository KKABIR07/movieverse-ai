import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit + integration tests live next to the code as *.test.ts(x) or under tests/unit|integration.
// E2E tests (Playwright) live in tests/e2e and are excluded here.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'tests/{unit,integration}/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'tests/e2e/**'],
    testTimeout: 30_000,
    hookTimeout: 120_000, // mongodb-memory-server downloads/starts mongod on first run
    coverage: { provider: 'v8', include: ['src/lib/**', 'src/app/api/**', 'src/store/**'] },
  },
});
