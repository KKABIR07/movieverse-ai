import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withHandler, readJson, mapError, json } from './http';
import { ConfigError, DatabaseUnavailableError, HttpError } from './errors';

const req = (body?: string, headers: Record<string, string> = {}) =>
  new NextRequest('http://localhost/api/x', { method: body === undefined ? 'GET' : 'POST', body, headers });

const throwing = (err: unknown) =>
  withHandler('test', async () => {
    throw err;
  });

describe('withHandler error mapping', () => {
  it('ZodError → 400 VALIDATION with issues', async () => {
    const res = await throwing(z.object({ a: z.string() }).safeParse({ a: 1 }).error)(req(), undefined);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION');
    expect(body.issues[0].path).toBe('a');
    expect(body.requestId).toBeTruthy();
  });

  // node-postgres DatabaseError as wrapped by Drizzle (DrizzleQueryError → cause)
  const pgErr = (code: string, extra: Record<string, unknown> = {}) =>
    Object.assign(new Error('Failed query: insert into …'), {
      name: 'DrizzleQueryError',
      cause: Object.assign(new Error('pg says no'), { name: 'error', code, ...extra }),
    });

  it('Postgres 23505 unique_violation → 409 CONFLICT (wrapped or bare)', async () => {
    for (const e of [pgErr('23505', { constraint: 'users_email_key' }), Object.assign(new Error('dup'), { code: '23505' })]) {
      const res = await throwing(e)(req(), undefined);
      expect(res.status).toBe(409);
      expect((await res.json()).code).toBe('CONFLICT');
    }
  });

  it('Postgres check / not-null / bad text / too long / out of range → 400 BAD_REQUEST', async () => {
    for (const code of ['23514', '23502', '22P02', '22001', '22003']) {
      const res = await throwing(pgErr(code))(req(), undefined);
      expect(res.status).toBe(400);
      expect((await res.json()).code).toBe('BAD_REQUEST');
    }
  });

  it('Postgres 23503 foreign_key_violation → 404', async () => {
    expect((await throwing(pgErr('23503'))(req(), undefined)).status).toBe(404);
  });

  it('other SQL errors → 500 without leaking the query', async () => {
    const res = await throwing(pgErr('42P01'))(req(), undefined); // undefined_table
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain('insert into');
  });

  it('HttpError → its status, code and headers', async () => {
    const res = await throwing(new HttpError(429, 'slow down', { code: 'X', headers: { 'Retry-After': '7' } }))(req(), undefined);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('7');
    expect(await res.json()).toMatchObject({ error: 'slow down', code: 'X' });
  });

  it('ConfigError → 503 without leaking the variable', async () => {
    const res = await throwing(new ConfigError('JWT_SECRET', 'missing'))(req(), undefined);
    expect(res.status).toBe(503);
    const text = await res.text();
    expect(text).not.toContain('JWT_SECRET');
  });

  it('DB unavailable (connection refused, shutdown, pool timeout, statement timeout) → 503 + Retry-After', async () => {
    const cases: unknown[] = [
      Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), { code: 'ECONNREFUSED' }),
      pgErr('ECONNRESET'),
      pgErr('57P01'), // admin_shutdown
      pgErr('57P03'), // cannot_connect_now (starting up)
      pgErr('53300'), // too_many_connections
      pgErr('08006'), // connection_failure
      pgErr('57014'), // statement_timeout
      new Error('timeout exceeded when trying to connect'),
      Object.assign(new Error('x'), { cause: new Error('Connection terminated unexpectedly') }),
      new AggregateError([Object.assign(new Error('a'), { code: 'ECONNREFUSED' })], 'all failed'),
      new DatabaseUnavailableError(),
    ];
    for (const e of cases) {
      const res = await throwing(e)(req(), undefined);
      expect(res.status, String(e)).toBe(503);
      expect(res.headers.get('Retry-After')).toBe('10');
      expect((await res.json()).code).toBe('DB_UNAVAILABLE');
    }
  });

  it('unknown errors → 500 generic message + request id header', async () => {
    const res = await throwing(new Error('secret internals'))(req(), undefined);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).not.toContain('secret');
    expect(res.headers.get('x-request-id')).toBe(body.requestId);
  });

  it('propagates a safe incoming x-request-id, replaces unsafe ones', async () => {
    const ok = await withHandler('t', async () => json({ ok: 1 }))(req(undefined, { 'x-request-id': 'abc-12345678' }), undefined);
    expect(ok.headers.get('x-request-id')).toBe('abc-12345678');
    const evil = await withHandler('t', async () => json({ ok: 1 }))(req(undefined, { 'x-request-id': '<script>' }), undefined);
    expect(evil.headers.get('x-request-id')).not.toBe('<script>');
  });

  it('json() defaults to Cache-Control: no-store', () => {
    expect(json({}).headers.get('Cache-Control')).toBe('no-store');
    expect(json({}, { headers: { 'Cache-Control': 'public' } }).headers.get('Cache-Control')).toBe('public');
  });

  it('non-Error throwables → 500', () => {
    expect(mapError('boom').status).toBe(500);
  });
});

describe('readJson', () => {
  const schema = z.object({ a: z.number() });

  it('parses + validates', async () => {
    expect(await readJson(req('{"a":1}'), schema)).toEqual({ a: 1 });
  });
  it('malformed JSON → 400 BAD_JSON', async () => {
    await expect(readJson(req('{nope'), schema)).rejects.toMatchObject({ status: 400, code: 'BAD_JSON' });
  });
  it('oversize body → 413 even without content-length', async () => {
    const big = JSON.stringify({ a: 1, pad: 'x'.repeat(70 * 1024) });
    await expect(readJson(req(big), schema)).rejects.toMatchObject({ status: 413 });
  });
  it('declared oversize content-length → 413', async () => {
    await expect(readJson(req('{"a":1}', { 'content-length': String(1024 * 1024) }), schema)).rejects.toMatchObject({
      status: 413,
    });
  });
  it('empty body → validation error', async () => {
    await expect(readJson(req(''), schema)).rejects.toBeInstanceOf(z.ZodError);
  });
});
