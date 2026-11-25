/**
 * PostgreSQL access (node-postgres Pool + Drizzle).
 *
 *  - getDb() lazily creates ONE pg.Pool per process (globalThis-cached so dev HMR does not leak pools).
 *    Importing this module never connects and never throws; DATABASE_URL is validated at first use
 *    (missing → ConfigError → HTTP 503 NOT_CONFIGURED).
 *  - Sized for a 1 GB box: max 5 connections, idle ones closed after 30 s.
 *  - Every statement is capped at 10 s server-side (statement_timeout).
 *  - Tests inject an in-memory PGlite database with setDbForTests(); production always uses the Pool.
 */
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import pg from 'pg';
import { getDatabaseUrl } from '@/lib/server/env';
import { logger } from '@/lib/server/logger';
import * as schema from './schema';

export type Schema = typeof schema;
/** Driver-agnostic Drizzle database (node-postgres in production, PGlite in tests). */
export type Db = PgDatabase<PgQueryResultHKT, Schema>;

export const POOL_OPTIONS = {
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 10_000,
  application_name: 'mkmovies',
} as const;

const log = logger.child({ component: 'db' });

type Cache = { pool: pg.Pool | null; db: Db | null; override: Db | null };
const g = globalThis as typeof globalThis & { __mkPg?: Cache };
const cache: Cache = (g.__mkPg ??= { pool: null, db: null, override: null });

/** Build a pool with the app's standard options (also used by the boot-time migrator). */
export function createPool(connectionString = getDatabaseUrl(), overrides: pg.PoolConfig = {}): pg.Pool {
  const pool = new pg.Pool({ connectionString, ...POOL_OPTIONS, ...overrides });
  // An idle client erroring (e.g. Postgres restarted) must not crash the process.
  pool.on('error', (err) => log.error('idle client error', { err }));
  return pool;
}

export function getDb(): Db {
  if (cache.override) return cache.override;
  if (cache.db) return cache.db;
  const pool = createPool(); // throws ConfigError before any network work when DATABASE_URL is missing
  cache.pool = pool;
  cache.db = drizzle(pool, { schema }) as unknown as Db;
  return cache.db;
}

/** Tests only: route every getDb() call to `db` (pass null to restore the real pool). */
export function setDbForTests(db: Db | null): void {
  cache.override = db;
}

/** Close the pool (graceful shutdown / tests). Safe to call when never opened. */
export async function closeDb(): Promise<void> {
  const pool = cache.pool;
  cache.pool = null;
  cache.db = null;
  if (pool) await pool.end();
}

/** `select 1` with a hard timeout. Resolves true/false, never throws. */
export async function pingDB(timeoutMs = 2000): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });
  const attempt = (async () => {
    try {
      await getDb().execute(sql`select 1`);
      return true;
    } catch (err) {
      log.warn('ping failed', { err });
      return false;
    }
  })();
  try {
    return await Promise.race([attempt, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
