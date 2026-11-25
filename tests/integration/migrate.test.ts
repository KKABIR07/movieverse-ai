/**
 * Migrations: the committed SQL applies cleanly, re-running is a no-op, the advisory lock is
 * released afterwards (even on failure), and the boot hook skips without DATABASE_URL.
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { Db } from '@/lib/db/client';
import { MIGRATION_LOCK_KEY, migrateOnBoot, migrationsDir, withMigrationLock } from '@/lib/db/migrate';
import { MIGRATIONS_FOLDER, rowsOf } from './helpers';

afterEach(() => vi.unstubAllEnvs());

const journal = JSON.parse(fs.readFileSync(path.join(MIGRATIONS_FOLDER, 'meta', '_journal.json'), 'utf8')) as {
  entries: unknown[];
};

async function advisoryLocksHeld(db: Db): Promise<number> {
  const r = await db.execute(
    sql`select count(*)::int n from pg_locks where locktype = 'advisory' and objid = ${MIGRATION_LOCK_KEY % 2 ** 32}`,
  );
  return rowsOf<{ n: number }>(r)[0].n;
}

describe('migrations', () => {
  it('apply under the advisory lock, are idempotent, and release the lock', async () => {
    const client = new PGlite();
    const db = drizzle(client) as unknown as Db;
    const run = () => withMigrationLock(db, () => migrate(drizzle(client), { migrationsFolder: MIGRATIONS_FOLDER }));
    await run();
    await run(); // second run: nothing to apply, no error

    const applied = await db.execute(sql`select count(*)::int n from drizzle.__drizzle_migrations`);
    expect(rowsOf<{ n: number }>(applied)[0].n).toBe(journal.entries.length);

    const tables = await db.execute(
      sql`select table_name from information_schema.tables where table_schema = 'public' order by 1`,
    );
    expect(rowsOf<{ table_name: string }>(tables).map((r) => r.table_name)).toEqual([
      'chat_messages',
      'follows',
      'review_likes',
      'reviews',
      'users',
      'watchlist_items',
      'youtube_cache',
    ]);
    expect(await advisoryLocksHeld(db)).toBe(0);
    await client.close();
  });

  it('releases the lock when a migration fails', async () => {
    const client = new PGlite();
    const db = drizzle(client) as unknown as Db;
    let heldInside = -1;
    await expect(
      withMigrationLock(db, async () => {
        heldInside = await advisoryLocksHeld(db);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(heldInside).toBe(1);
    expect(await advisoryLocksHeld(db)).toBe(0);
    await client.close();
  });

  it('migrateOnBoot skips (no throw) without DATABASE_URL or with MIGRATE_ON_BOOT=false', async () => {
    vi.stubEnv('DATABASE_URL', '');
    expect(await migrateOnBoot()).toBe('skipped');
    vi.stubEnv('DATABASE_URL', 'postgres://u:p@127.0.0.1:1/x');
    vi.stubEnv('MIGRATE_ON_BOOT', 'false');
    expect(await migrateOnBoot()).toBe('skipped');
  });

  it('migrateOnBoot gives up after MIGRATE_MAX_WAIT_MS when Postgres is unreachable', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://u:p@127.0.0.1:1/x'); // port 1: connection refused
    vi.stubEnv('MIGRATE_MAX_WAIT_MS', '1');
    await expect(migrateOnBoot()).rejects.toMatchObject({ code: 'ECONNREFUSED' });
  });

  it('migrations directory defaults to ./drizzle/migrations and honours MIGRATIONS_DIR', () => {
    expect(migrationsDir()).toBe(path.join(process.cwd(), 'drizzle', 'migrations'));
    vi.stubEnv('MIGRATIONS_DIR', '/app/drizzle/migrations');
    expect(migrationsDir()).toBe('/app/drizzle/migrations');
  });
});
