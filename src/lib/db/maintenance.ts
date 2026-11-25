/**
 * Retention sweeps (no cron needed): run once at boot and opportunistically from request paths.
 *  - chat_messages older than CHAT_RETENTION_DAYS (30 d)
 *  - youtube_cache rows past expires_at (24 h TTL)
 * Each sweep is throttled per process so a hot path never issues more than one DELETE per minute.
 */
import { lt, sql } from 'drizzle-orm';
import { logger } from '@/lib/server/logger';
import type { Db } from './client';
import { CHAT_RETENTION_DAYS, chatMessages, youtubeCache } from './schema';

const log = logger.child({ component: 'db.maintenance' });

export const SWEEP_MIN_INTERVAL_MS = 60_000;

const g = globalThis as typeof globalThis & { __mkSweeps?: Map<string, number> };
const lastRun = (g.__mkSweeps ??= new Map());

/** Delete chat messages older than the retention window. Returns the number of rows removed. */
export async function sweepChatMessages(db: Db): Promise<number> {
  const rows = await db
    .delete(chatMessages)
    .where(lt(chatMessages.createdAt, sql`now() - make_interval(days => ${CHAT_RETENTION_DAYS})`))
    .returning({ id: chatMessages.id });
  return rows.length;
}

/** Delete expired YouTube cache rows. Returns the number of rows removed. */
export async function sweepYoutubeCache(db: Db): Promise<number> {
  const rows = await db.delete(youtubeCache).where(lt(youtubeCache.expiresAt, sql`now()`)).returning({ key: youtubeCache.key });
  return rows.length;
}

/**
 * Fire-and-forget sweep with probability `p`, at most once per SWEEP_MIN_INTERVAL_MS per process.
 * Never throws and never delays the caller.
 */
export function maybeSweep(name: 'chat' | 'youtube', db: Db, p = 0.01): void {
  if (Math.random() >= p) return;
  const now = Date.now();
  if (now - (lastRun.get(name) ?? 0) < SWEEP_MIN_INTERVAL_MS) return;
  lastRun.set(name, now);
  const run = name === 'chat' ? sweepChatMessages : sweepYoutubeCache;
  run(db).then(
    (n) => n && log.info('swept expired rows', { table: name, rows: n }),
    (err) => log.warn('sweep failed', { table: name, err }),
  );
}

/** Tests only. */
export function resetSweepThrottle(): void {
  lastRun.clear();
}
