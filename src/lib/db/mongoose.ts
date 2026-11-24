import mongoose from 'mongoose';
import { getMongoUri } from '@/lib/server/env';
import { DatabaseUnavailableError } from '@/lib/server/errors';
import { logger } from '@/lib/server/logger';

/**
 * Cached Mongoose connection (survives dev hot-reloads via globalThis).
 * The URI is validated only here, at first use — importing this module never throws.
 * Connection failures surface as DatabaseUnavailableError (→ HTTP 503).
 */

type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null; listeners: boolean };
const g = globalThis as typeof globalThis & { __mkMongoose?: Cache };
const cached: Cache = (g.__mkMongoose ??= { conn: null, promise: null, listeners: false });

const log = logger.child({ component: 'mongo' });

function attachListeners(): void {
  if (cached.listeners) return;
  cached.listeners = true;
  const c = mongoose.connection;
  c.on('connected', () => log.info('connected', { db: c.name }));
  c.on('reconnected', () => log.info('reconnected'));
  c.on('disconnected', () => log.warn('disconnected'));
  c.on('error', (err: unknown) => log.error('connection error', { err }));
}

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn && mongoose.connection.readyState === 1) return cached.conn;
  const uri = getMongoUri(); // ConfigError (503) when missing — thrown before any network work
  if (!cached.promise) {
    attachListeners();
    cached.promise = mongoose.connect(uri, {
      bufferCommands: false,
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 30000,
    });
  }
  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (err) {
    cached.promise = null;
    cached.conn = null;
    log.error('connect failed', { err });
    throw new DatabaseUnavailableError(err);
  }
}

/** Test helper: close and forget the cached connection. */
export async function disconnectDB(): Promise<void> {
  cached.promise = null;
  cached.conn = null;
  await mongoose.disconnect();
}

/** Ping the DB with a hard timeout. Resolves true/false, never throws. */
export async function pingDB(timeoutMs = 2000): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });
  const attempt = (async () => {
    try {
      const m = await connectDB();
      const db = m.connection.db;
      if (!db) return false;
      await db.admin().ping();
      return true;
    } catch {
      return false;
    }
  })();
  try {
    return await Promise.race([attempt, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
