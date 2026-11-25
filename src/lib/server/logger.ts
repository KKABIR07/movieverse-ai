/**
 * Structured JSON logger (one JSON object per line → docker json-file / journald friendly).
 *
 * - Level threshold via LOG_LEVEL (debug|info|warn|error|silent). Default: info (silent under vitest).
 * - Sensitive keys are redacted recursively (password, token, authorization, cookie, secret, apiKey…).
 * - Errors are serialised to { name, message, code, status, stack? } (stack omitted in production).
 *
 * Safe to import from proxy.ts, route handlers and plain Node code (no Next/DB imports).
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type Threshold = LogLevel | 'silent';

const ORDER: Record<Threshold, number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

const REDACT = /pass(word)?|token|secret|authorization|cookie|api[-_]?key|bearer|jwt|hash/i;

function threshold(): number {
  const raw = (process.env.LOG_LEVEL ?? (process.env.VITEST ? 'silent' : 'info')).toLowerCase();
  return ORDER[(raw in ORDER ? raw : 'info') as Threshold];
}

export function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    const e = err as Error & { code?: unknown; status?: unknown; cause?: unknown };
    const out: Record<string, unknown> = { name: e.name, message: e.message };
    if (e.code !== undefined) out.code = e.code;
    if (e.status !== undefined) out.status = e.status;
    if (process.env.NODE_ENV !== 'production' && e.stack) out.stack = e.stack.split('\n').slice(0, 8).join('\n');
    if (e.cause !== undefined && e.cause !== err) out.cause = serializeError(e.cause);
    return out;
  }
  return { value: String(err) };
}

function sanitize(value: unknown, depth = 0): unknown {
  if (value instanceof Error) return serializeError(value);
  if (depth > 4 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => sanitize(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = REDACT.test(k) ? '[redacted]' : sanitize(v, depth + 1);
  }
  return out;
}

function write(level: LogLevel, msg: string, fields?: Record<string, unknown>): void {
  if (ORDER[level] < threshold()) return;
  const entry = { ts: new Date().toISOString(), level, msg, ...(fields ? (sanitize(fields) as object) : {}) };
  let line: string;
  try {
    line = JSON.stringify(entry);
  } catch {
    line = JSON.stringify({ ts: entry.ts, level, msg, note: 'unserialisable fields' });
  }
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export interface Logger {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
}

function make(bindings: Record<string, unknown>): Logger {
  const merge = (f?: Record<string, unknown>) => ({ ...bindings, ...f });
  return {
    debug: (m, f) => write('debug', m, merge(f)),
    info: (m, f) => write('info', m, merge(f)),
    warn: (m, f) => write('warn', m, merge(f)),
    error: (m, f) => write('error', m, merge(f)),
    child: (b) => make({ ...bindings, ...b }),
  };
}

export const logger: Logger = make({ svc: 'mkmovies' });
