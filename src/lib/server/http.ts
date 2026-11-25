/**
 * Shared route-handler plumbing:
 *  - withHandler(): always answers JSON, maps errors to status codes, attaches x-request-id, logs.
 *  - readJson(): size-capped body parsing + zod validation.
 *  - json(): NextResponse.json with a safe default Cache-Control.
 *
 * Error mapping:
 *   ZodError                          → 400 VALIDATION (with issues[])
 *   HttpError (incl. ConfigError, DatabaseUnavailableError) → its status
 *   Postgres unreachable / overloaded (ECONNREFUSED, 08xxx, 57P0x, 53300, 57014, pool timeout)
 *                                     → 503 DB_UNAVAILABLE + Retry-After
 *   Postgres 23505 unique_violation   → 409 CONFLICT
 *   Postgres 23514 / 23502 / 22P02 / 22001 / 22003 (check, not-null, bad text, too long, out of range)
 *                                     → 400 BAD_REQUEST
 *   Postgres 23503 foreign_key_violation → 404 NOT_FOUND (referenced row is gone)
 *   anything else                    → 500 INTERNAL (generic message + requestId)
 */
import { NextResponse, type NextRequest } from 'next/server';
import { ZodError, type ZodType } from 'zod';
import { HttpError, ConfigError, PG, isDbUnavailableError, pgSqlState } from './errors';
import { logger } from './logger';

export const MAX_JSON_BODY_BYTES = 64 * 1024;

export interface ErrorBody {
  error: string;
  code: string;
  requestId: string;
  issues?: { path: string; message: string }[];
}

const REQUEST_ID_RE = /^[\w-]{8,64}$/;

export function getRequestId(req: Request): string {
  const incoming = req.headers.get('x-request-id');
  return incoming && REQUEST_ID_RE.test(incoming) ? incoming : crypto.randomUUID();
}

export function json<T>(data: T, init: { status?: number; headers?: Record<string, string> } = {}): NextResponse<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Cache-Control')) headers.set('Cache-Control', 'no-store');
  return NextResponse.json(data, { status: init.status ?? 200, headers });
}

interface MappedError {
  status: number;
  body: Omit<ErrorBody, 'requestId'>;
  headers?: Record<string, string>;
  level: 'warn' | 'error' | 'info';
}

export function mapError(err: unknown): MappedError {
  if (err instanceof ZodError) {
    return {
      status: 400,
      level: 'info',
      body: {
        error: 'Invalid request.',
        code: 'VALIDATION',
        issues: err.issues.slice(0, 20).map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    };
  }
  if (err instanceof HttpError) {
    return {
      status: err.status,
      level: err.status >= 500 ? (err instanceof ConfigError ? 'error' : 'warn') : 'info',
      headers: err.headers,
      body: {
        error: err.message,
        code: err.code,
        ...(Array.isArray(err.details) ? { issues: err.details as ErrorBody['issues'] } : {}),
      },
    };
  }
  if (isDbUnavailableError(err)) {
    return {
      status: 503,
      level: 'warn',
      headers: { 'Retry-After': '10' },
      body: { error: 'Database is temporarily unavailable. Please try again shortly.', code: 'DB_UNAVAILABLE' },
    };
  }
  switch (pgSqlState(err)) {
    case PG.UNIQUE_VIOLATION:
      return { status: 409, level: 'info', body: { error: 'Resource already exists.', code: 'CONFLICT' } };
    case PG.CHECK_VIOLATION:
    case PG.NOT_NULL_VIOLATION:
    case PG.INVALID_TEXT_REPRESENTATION:
    case PG.STRING_DATA_RIGHT_TRUNCATION:
    case PG.NUMERIC_VALUE_OUT_OF_RANGE:
      return { status: 400, level: 'info', body: { error: 'Invalid request.', code: 'BAD_REQUEST' } };
    case PG.FOREIGN_KEY_VIOLATION:
      // The referenced row (review, user…) does not exist (any more).
      return { status: 404, level: 'info', body: { error: 'Not found.', code: 'NOT_FOUND' } };
  }
  return { status: 500, level: 'error', body: { error: 'Something went wrong. Please try again.', code: 'INTERNAL' } };
}

export function errorResponse(err: unknown, requestId: string): NextResponse<ErrorBody> {
  const mapped = mapError(err);
  const headers: Record<string, string> = { 'Cache-Control': 'no-store', 'x-request-id': requestId, ...mapped.headers };
  return NextResponse.json({ ...mapped.body, requestId }, { status: mapped.status, headers });
}

type Handler<C> = (req: NextRequest, ctx: C) => Promise<Response> | Response;

/**
 * Wrap a route handler. `name` is used for logs (e.g. 'reviews.POST').
 * The wrapped handler never throws.
 */
export function withHandler<C = unknown>(name: string, fn: Handler<C>): (req: NextRequest, ctx: C) => Promise<Response> {
  return async (req, ctx) => {
    const requestId = getRequestId(req);
    const started = Date.now();
    const log = logger.child({ route: name, requestId });
    try {
      const res = await fn(req, ctx);
      res.headers.set('x-request-id', requestId);
      log.debug('request', { status: res.status, ms: Date.now() - started });
      return res;
    } catch (err) {
      const mapped = mapError(err);
      const fields: Record<string, unknown> = {
        status: mapped.status,
        code: mapped.body.code,
        method: req.method,
        path: req.nextUrl?.pathname,
        ms: Date.now() - started,
      };
      if (mapped.level !== 'info' || mapped.status >= 500) fields.err = err;
      if (err instanceof ConfigError) fields.reason = err.reason;
      log[mapped.level]('request failed', fields);
      return errorResponse(err, requestId);
    }
  };
}

/** Read + size-cap + JSON.parse + zod-validate a request body. */
export async function readJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > MAX_JSON_BODY_BYTES) {
    throw new HttpError(413, 'Request body too large.', { code: 'PAYLOAD_TOO_LARGE' });
  }
  const text = await req.text();
  if (Buffer.byteLength(text, 'utf8') > MAX_JSON_BODY_BYTES) {
    throw new HttpError(413, 'Request body too large.', { code: 'PAYLOAD_TOO_LARGE' });
  }
  let data: unknown;
  try {
    data = text.length ? JSON.parse(text) : undefined;
  } catch {
    throw new HttpError(400, 'Malformed JSON body.', { code: 'BAD_JSON' });
  }
  return schema.parse(data);
}

/** Validate URLSearchParams (first value per key) against a zod object schema. */
export function readQuery<T>(req: NextRequest, schema: ZodType<T>): T {
  const obj: Record<string, string> = {};
  for (const [k, v] of req.nextUrl.searchParams) if (!(k in obj)) obj[k] = v;
  return schema.parse(obj);
}
