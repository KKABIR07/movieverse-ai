/**
 * Error types shared by route handlers. Pure module (no Next / Mongo imports).
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

const DB_UNAVAILABLE_NAMES = new Set([
  'MongooseServerSelectionError',
  'MongoServerSelectionError',
  'MongoNetworkError',
  'MongoNetworkTimeoutError',
  'MongoTopologyClosedError',
  'MongoNotConnectedError',
  'MongoPoolClearedError',
]);

/** True for driver errors that mean "DB unreachable" (→ 503) rather than a bug (→ 500). */
export function isDbUnavailableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err instanceof DatabaseUnavailableError) return true;
  return DB_UNAVAILABLE_NAMES.has(err.name);
}
