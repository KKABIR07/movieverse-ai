/**
 * Next 16 Proxy (formerly middleware) for /api/*.
 *  1. 413 when Content-Length > 64 KB.
 *  2. Mutating methods (POST/PUT/PATCH/DELETE):
 *     - a present Origin header must be same-origin (host / x-forwarded-host / NEXT_PUBLIC_SITE_URL) → else 403
 *     - a request WITH a body must be Content-Type: application/json → else 403
 *       (bodyless requests such as logout / DELETE ?id= are allowed)
 *  3. Per-IP token-bucket rate limiting (see src/lib/server/rate-limit.ts) → 429 + Retry-After.
 * All rejections are JSON: { error, code }.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { TokenBucketLimiter, clientIp, ruleFor } from '@/lib/server/rate-limit';
import { logger } from '@/lib/server/logger';

const MAX_BODY = 64 * 1024;
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Survive dev hot-reloads; single-instance deployment so in-process state is the source of truth.
const g = globalThis as typeof globalThis & { __mkRateLimiter?: TokenBucketLimiter };
const limiter = (g.__mkRateLimiter ??= new TokenBucketLimiter(10_000));

function reject(status: number, code: string, error: string, headers: Record<string, string> = {}) {
  return NextResponse.json({ error, code }, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

function allowedHosts(req: NextRequest): Set<string> {
  const hosts = new Set<string>();
  const host = req.headers.get('host');
  if (host) hosts.add(host.toLowerCase());
  const fwd = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  if (fwd) hosts.add(fwd.toLowerCase());
  hosts.add(req.nextUrl.host.toLowerCase());
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (site) {
    try {
      const u = new URL(site);
      hosts.add(u.host.toLowerCase());
      // www ↔ apex both count as first-party
      hosts.add(u.host.startsWith('www.') ? u.host.slice(4) : `www.${u.host}`);
    } catch {
      /* ignore malformed */
    }
  }
  return hosts;
}

function isSameOrigin(req: NextRequest, origin: string): boolean {
  if (origin === 'null') return false;
  try {
    return allowedHosts(req).has(new URL(origin).host.toLowerCase());
  } catch {
    return false;
  }
}

function hasBody(req: NextRequest): boolean {
  const len = req.headers.get('content-length');
  if (len !== null) return Number(len) > 0;
  // A body is always announced by Content-Length or chunked Transfer-Encoding. `req.body` is a
  // (possibly empty) stream for every POST/DELETE here, so it can't tell us anything.
  return req.headers.has('transfer-encoding');
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method.toUpperCase();

  const len = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(len) && len > MAX_BODY) {
    return reject(413, 'PAYLOAD_TOO_LARGE', 'Request body too large.');
  }

  if (MUTATING.has(method)) {
    const origin = req.headers.get('origin');
    if (origin && !isSameOrigin(req, origin)) {
      logger.warn('proxy: cross-origin mutation blocked', { path: pathname, method, origin: origin.slice(0, 200) });
      return reject(403, 'BAD_ORIGIN', 'Cross-origin request blocked.');
    }
    if (hasBody(req)) {
      const ct = (req.headers.get('content-type') ?? '').toLowerCase();
      if (!ct.startsWith('application/json')) {
        return reject(403, 'BAD_CONTENT_TYPE', 'Content-Type must be application/json.');
      }
    }
  }

  const rule = ruleFor(pathname, method);
  if (rule) {
    const ip = clientIp(req.headers);
    const r = limiter.take(ip, rule);
    if (!r.allowed) {
      logger.info('proxy: rate limited', { path: pathname, method, rule: rule.name });
      return reject(429, 'RATE_LIMITED', 'Too many requests. Please slow down.', {
        'Retry-After': String(r.retryAfterSec),
        'X-RateLimit-Limit': String(r.limit),
        'X-RateLimit-Remaining': '0',
      });
    }
    const res = NextResponse.next();
    res.headers.set('X-RateLimit-Limit', String(r.limit));
    res.headers.set('X-RateLimit-Remaining', String(r.remaining));
    return res;
  }
  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
