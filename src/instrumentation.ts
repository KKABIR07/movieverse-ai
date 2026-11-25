/**
 * Next.js instrumentation hook — `register()` runs once per server start, before requests are served.
 *
 * Node.js runtime only: apply pending PostgreSQL migrations (advisory-locked; see src/lib/db/migrate.ts).
 *  - DATABASE_URL unset or MIGRATE_ON_BOOT=false → logs a warning and skips (DB-less dev / health checks).
 *  - Never runs during `next build`.
 *  - Database still starting → retries for up to MIGRATE_MAX_WAIT_MS (default 60 s), then throws so the
 *    process exits non-zero and the container restart policy takes over.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  const { migrateOnBoot } = await import('./lib/db/migrate');
  await migrateOnBoot();
}
