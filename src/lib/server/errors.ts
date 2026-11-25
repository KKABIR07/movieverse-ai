/**
 * Error types shared by route handlers. Pure module (no Next / DB driver imports).
 */

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly headers?: Record<string, string>;
  readonly details?: unknown;

  constructor(
    status: number,
    message: string,
    opts: { code?: string; headers?: Record<string, string>; details?: unknown; cause?: unknown } = {},
  ) {
    super(message, opts.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = 'HttpError';
    this.status = status;
    this.code = opts.code ?? defaultCode(status);
    this.headers = opts.headers;
    this.details = opts.details;
  }
}

/** Thrown by env getters when a required secret/config value is missing or invalid. */
export class ConfigError extends HttpError {
  readonly variable: string;
  /** Operator-facing reason — logged, never sent to the client. */
  readonly reason: string;
  constructor(variable: string, reason: string) {
    super(503, 'Service is not configured.', { code: 'NOT_CONFIGURED' });
    this.name = 'ConfigError';
    this.variable = variable;
    this.reason = `${variable}: ${reason}`;
  }
}

/** Database could not be reached (connect / server selection / network). */
export class DatabaseUnavailableError extends HttpError {
  constructor(cause?: unknown) {
    super(503, 'Database is temporarily unavailable. Please try again shortly.', {
      code: 'DB_UNAVAILABLE',
      headers: { 'Retry-After': '10' },
      cause,
    });
    this.name = 'DatabaseUnavailableError';
  }
}

export const unauthorized = (message = 'Authentication required.') =>
  new HttpError(401, message, { code: 'UNAUTHORIZED' });
export const forbidden = (message = 'Forbidden.') => new HttpError(403, message, { code: 'FORBIDDEN' });
export const notFound = (message = 'Not found.') => new HttpError(404, message, { code: 'NOT_FOUND' });
export const badRequest = (message = 'Invalid request.', details?: unknown) =>
  new HttpError(400, message, { code: 'BAD_REQUEST', details });

function defaultCode(status: number): string {
  switch (status) {
    case 400: return 'BAD_REQUEST';
    case 401: return 'UNAUTHORIZED';
    case 403: return 'FORBIDDEN';
    case 404: return 'NOT_FOUND';
    case 409: return 'CONFLICT';
    case 413: return 'PAYLOAD_TOO_LARGE';
    case 415: return 'UNSUPPORTED_MEDIA_TYPE';
    case 429: return 'RATE_LIMITED';
    case 502: return 'UPSTREAM_ERROR';
    case 503: return 'UNAVAILABLE';
    default: return status >= 500 ? 'INTERNAL' : 'ERROR';
  }
}

// ─── PostgreSQL error classification ─────────────────────────────────────────
// Drizzle wraps driver errors (DrizzleQueryError → cause = pg DatabaseError), so every helper
// walks the `cause` chain.

function* causeChain(err: unknown): Generator<unknown> {
  let cur: unknown = err;
  for (let depth = 0; cur && depth < 6; depth++) {
    yield cur;
    cur = (cur as { cause?: unknown }).cause;
  }
}

/** First string `code` found on the error or its causes (SQLSTATE like '23505', or errno like 'ECONNREFUSED'). */
export function dbErrorCode(err: unknown): string | undefined {
  for (const e of causeChain(err)) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return undefined;
}

/** SQLSTATE of a Postgres error (5 chars), if any. */
export function pgSqlState(err: unknown): string | undefined {
  const code = dbErrorCode(err);
  return code && /^(?=.*\d)[0-9A-Z]{5}$/.test(code) ? code : undefined;
}

/** Name of the violated constraint (pg `constraint` field), if any. */
export function pgConstraint(err: unknown): string | undefined {
  for (const e of causeChain(err)) {
    const c = (e as { constraint?: unknown }).constraint;
    if (typeof c === 'string') return c;
  }
  return undefined;
}

export const PG = {
  UNIQUE_VIOLATION: '23505',
  FOREIGN_KEY_VIOLATION: '23503',
  CHECK_VIOLATION: '23514',
  NOT_NULL_VIOLATION: '23502',
  INVALID_TEXT_REPRESENTATION: '22P02',
  STRING_DATA_RIGHT_TRUNCATION: '22001',
  NUMERIC_VALUE_OUT_OF_RANGE: '22003',
} as const;

const NET_ERRNOS = new Set(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE', 'EHOSTUNREACH', 'ENETUNREACH']);
// 08xxx connection exception · 57P01-03 admin/crash shutdown, cannot connect now · 53300 too many connections
// · 57014 query_canceled (statement_timeout) · 40P01 deadlock (transient)
const UNAVAILABLE_SQLSTATE = /^(08...|57P0[1-3]|53300|57014|40P01)$/;
const UNAVAILABLE_MESSAGE =
  /timeout exceeded when trying to connect|Connection terminated|connection timeout|Client has encountered a connection error|Cannot use a pool after calling end/i;

/** True for errors that mean "DB unreachable / overloaded" (→ 503) rather than a bug (→ 500). */
export function isDbUnavailableError(err: unknown): boolean {
  for (const e of causeChain(err)) {
    if (e instanceof DatabaseUnavailableError) return true;
    const code = (e as { code?: unknown }).code;
    if (typeof code === 'string' && (NET_ERRNOS.has(code) || UNAVAILABLE_SQLSTATE.test(code))) return true;
    if (e instanceof Error && UNAVAILABLE_MESSAGE.test(e.message)) return true;
    if (e instanceof AggregateError && e.errors.some((x) => isDbUnavailableError(x))) return true;
  }
  return false;
}
