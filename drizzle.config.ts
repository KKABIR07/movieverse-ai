import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit config. `npx drizzle-kit generate` diffs src/lib/db/schema.ts against the snapshots in
 * drizzle/migrations/meta and writes a new SQL migration. Migrations are applied at server start by
 * src/instrumentation.ts (advisory-locked), so generating needs no database connection.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/lib/db/schema.ts',
  out: './drizzle/migrations',
  strict: true,
  verbose: true,
  ...(process.env.DATABASE_URL ? { dbCredentials: { url: process.env.DATABASE_URL } } : {}),
});
