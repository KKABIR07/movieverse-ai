import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy, config } from './proxy';

let ipSeq = 0;
const freshIp = () => `198.51.100.${++ipSeq % 250}-${ipSeq}`;

function req(path: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: init.method ?? 'GET',
    // Real HTTP/1.1 requests from Caddy always announce a body with Content-Length (or chunked).
    headers: {
      host: 'localhost:3000',
      'x-real-ip': freshIp(),
      ...(init.body !== undefined ? { 'content-length': String(Buffer.byteLength(init.body)) } : {}),
      ...init.headers,
    },
    body: init.body,
  });
}

const passes = (res: Response) => res.headers.get('x-middleware-next') === '1';

afterEach(() => vi.unstubAllEnvs());

describe('proxy', () => {
  it('matches /api only', () => {
    expect(config.matcher).toBe('/api/:path*');
  });

  it('passes normal GETs and sets rate-limit headers', () => {
    const res = proxy(req('/api/reviews?movieId=1'));
    expect(passes(res)).toBe(true);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('120');
  });

  it('413 when content-length > 64 KB', async () => {
    const res = proxy(
      req('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json', 'content-length': String(65 * 1024) } }),
    );
    expect(res.status).toBe(413);
    expect((await res.json()).code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('403 for cross-origin mutations', async () => {
    const res = proxy(
      req('/api/watchlist', { method: 'POST', body: '{}', headers: { origin: 'https://evil.example', 'content-type': 'application/json' } }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('BAD_ORIGIN');
    expect(proxy(req('/api/auth/logout', { method: 'POST', headers: { origin: 'null' } })).status).toBe(403);
  });

  it('allows same-origin, forwarded host and the configured site (www ↔ apex)', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.mkmovies.site');
    const json = { 'content-type': 'application/json' };
    expect(passes(proxy(req('/api/chat', { method: 'POST', body: '{}', headers: { ...json, origin: 'http://localhost:3000' } })))).toBe(true);
    expect(
      passes(
        proxy(
          req('/api/chat', {
            method: 'POST',
            body: '{}',
            headers: { ...json, origin: 'https://www.mkmovies.site', 'x-forwarded-host': 'www.mkmovies.site' },
          }),
        ),
      ),
    ).toBe(true);
    expect(passes(proxy(req('/api/chat', { method: 'POST', body: '{}', headers: { ...json, origin: 'https://mkmovies.site' } })))).toBe(true);
  });

  it('403 when a mutating request with a body is not JSON (CSRF via text/plain forms)', async () => {
    const res = proxy(req('/api/reviews', { method: 'POST', body: 'a=b', headers: { 'content-type': 'text/plain' } }));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('BAD_CONTENT_TYPE');
  });

  it('403 for a chunked (no Content-Length) non-JSON body', async () => {
    const res = proxy(req('/api/reviews', { method: 'POST', headers: { 'transfer-encoding': 'chunked', 'content-type': 'text/plain' } }));
    expect(res.status).toBe(403);
  });

  it('allows bodyless mutations (logout, DELETE ?id=) without content-type', () => {
    expect(passes(proxy(req('/api/auth/logout', { method: 'POST', headers: { 'content-length': '0' } })))).toBe(true);
    expect(passes(proxy(req('/api/auth/logout', { method: 'POST' })))).toBe(true);
    expect(passes(proxy(req('/api/reviews?id=507f1f77bcf86cd799439011', { method: 'DELETE' })))).toBe(true);
  });

  it('429 + Retry-After after the auth bucket (10/min) is exhausted, per IP', async () => {
    const ip = '203.0.113.50';
    const hit = () => proxy(req('/api/auth/logout', { method: 'POST', headers: { 'x-real-ip': ip } }));
    for (let i = 0; i < 10; i++) expect(passes(hit())).toBe(true);
    const res = hit();
    expect(res.status).toBe(429);
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThanOrEqual(1);
    expect((await res.json()).code).toBe('RATE_LIMITED');
    // another IP is unaffected
    expect(passes(proxy(req('/api/auth/logout', { method: 'POST', headers: { 'x-real-ip': '203.0.113.51' } })))).toBe(true);
  });

  it('spoofed XFF first hops do not dodge the limiter when x-real-ip is set', () => {
    const ip = '203.0.113.60';
    const hit = (i: number) => proxy(req('/api/auth/logout', { method: 'POST', headers: { 'x-real-ip': ip, 'x-forwarded-for': `10.9.9.${i}, ${ip}` } }));
    for (let i = 0; i < 10; i++) hit(i);
    expect(hit(99).status).toBe(429);
  });

  it('GET /api/auth/me is on the default bucket, so normal browsing never signs the user out', () => {
    const ip = '203.0.113.55';
    for (let i = 0; i < 30; i++) expect(passes(proxy(req('/api/auth/me', { headers: { 'x-real-ip': ip } })))).toBe(true);
  });

  it('chat POST bucket is 10 per 10s', () => {
    const ip = '203.0.113.70';
    const post = () =>
      proxy(req('/api/chat', { method: 'POST', body: '{}', headers: { 'x-real-ip': ip, 'content-type': 'application/json' } }));
    for (let i = 0; i < 10; i++) expect(passes(post())).toBe(true);
    expect(post().status).toBe(429);
    // GET polling uses the default bucket, still allowed
    expect(passes(proxy(req('/api/chat?roomId=general', { headers: { 'x-real-ip': ip } })))).toBe(true);
  });

  it('health checks are never rate limited', () => {
    const ip = '203.0.113.80';
    for (let i = 0; i < 300; i++) expect(passes(proxy(req('/api/health', { headers: { 'x-real-ip': ip } })))).toBe(true);
  });
});
