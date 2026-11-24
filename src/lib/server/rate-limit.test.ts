import { describe, expect, it } from 'vitest';
import { TokenBucketLimiter, RULES, clientIp, ruleFor, type RateRule } from './rate-limit';

const rule: RateRule = { name: 't', capacity: 3, windowMs: 3000 }; // 1 token / second

describe('TokenBucketLimiter', () => {
  it('allows up to capacity, then rejects with Retry-After', () => {
    const l = new TokenBucketLimiter();
    const t0 = 1_000_000;
    expect(l.take('ip', rule, t0)).toMatchObject({ allowed: true, remaining: 2, limit: 3 });
    expect(l.take('ip', rule, t0).allowed).toBe(true);
    expect(l.take('ip', rule, t0).allowed).toBe(true);
    const r = l.take('ip', rule, t0);
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
    expect(r.retryAfterSec).toBe(1);
  });

  it('refills over time proportionally to the window', () => {
    const l = new TokenBucketLimiter();
    const t0 = 5_000_000;
    for (let i = 0; i < 3; i++) l.take('ip', rule, t0);
    expect(l.take('ip', rule, t0 + 500).allowed).toBe(false);
    expect(l.take('ip', rule, t0 + 1000).allowed).toBe(true); // 1 token after 1s
    expect(l.take('ip', rule, t0 + 1000).allowed).toBe(false);
  });

  it('never exceeds capacity after long idle', () => {
    const l = new TokenBucketLimiter();
    l.take('ip', rule, 0);
    const r = l.take('ip', rule, 10 ** 9);
    expect(r.remaining).toBe(2);
  });

  it('isolates keys and rules', () => {
    const l = new TokenBucketLimiter();
    for (let i = 0; i < 3; i++) l.take('a', rule, 0);
    expect(l.take('a', rule, 0).allowed).toBe(false);
    expect(l.take('b', rule, 0).allowed).toBe(true);
    expect(l.take('a', { ...rule, name: 'other' }, 0).allowed).toBe(true);
  });

  it('bounds memory by evicting the least-recently-used key', () => {
    const l = new TokenBucketLimiter(3);
    for (let i = 0; i < 3; i++) l.take('b', rule, 0); // b exhausted
    expect(l.take('b', rule, 0).allowed).toBe(false);
    l.take('a', rule, 0);
    l.take('c', rule, 0);
    l.take('a', rule, 0); // refresh a → b is the LRU entry
    l.take('d', rule, 0); // evicts b
    expect(l.size).toBe(3);
    // b was evicted, so it starts with a full bucket again
    expect(l.take('b', rule, 0)).toMatchObject({ allowed: true, remaining: 2 });
    expect(l.size).toBe(3);
  });

  it('sweeps idle buckets', () => {
    const l = new TokenBucketLimiter(100, 1000);
    l.take('a', rule, 0);
    l.take('b', rule, 0);
    expect(l.size).toBe(2);
    l.take('c', rule, 11 * 60_000);
    expect(l.size).toBe(1);
  });
});

describe('ruleFor', () => {
  it.each([
    ['/api/auth/login', 'POST', RULES.auth],
    ['/api/auth/me', 'GET', RULES.auth],
    ['/api/ai/recommend', 'POST', RULES.ai],
    ['/api/chat', 'POST', RULES.chatPost],
    ['/api/chat', 'GET', RULES.default],
    ['/api/youtube/shorts', 'GET', RULES.youtube],
    ['/api/tmdb/movie/550', 'GET', RULES.tmdb],
    ['/api/reviews', 'GET', RULES.default],
  ])('%s %s', (path, method, expected) => {
    expect(ruleFor(path, method)).toBe(expected);
  });

  it('exempts health checks', () => {
    expect(ruleFor('/api/health', 'GET')).toBeNull();
    expect(ruleFor('/api/ready', 'GET')).toBeNull();
  });

  it('has the required limits', () => {
    expect(RULES.auth).toMatchObject({ capacity: 10, windowMs: 60_000 });
    expect(RULES.ai).toMatchObject({ capacity: 20, windowMs: 60_000 });
    expect(RULES.chatPost).toMatchObject({ capacity: 10, windowMs: 10_000 });
    expect(RULES.youtube).toMatchObject({ capacity: 30, windowMs: 60_000 });
    expect(RULES.default).toMatchObject({ capacity: 120, windowMs: 60_000 });
  });
});

describe('clientIp', () => {
  const h = (o: Record<string, string>) => new Headers(o);

  it('prefers x-real-ip (set by Caddy from CF-Connecting-IP)', () => {
    expect(clientIp(h({ 'x-real-ip': '9.9.9.9', 'x-forwarded-for': '1.1.1.1, 2.2.2.2' }))).toBe('9.9.9.9');
  });

  it('a spoofed leading XFF hop cannot change the key when x-real-ip is present', () => {
    const honest = clientIp(h({ 'x-real-ip': '203.0.113.7', 'x-forwarded-for': '203.0.113.7' }));
    const spoofed = clientIp(h({ 'x-real-ip': '203.0.113.7', 'x-forwarded-for': '6.6.6.6, 203.0.113.7' }));
    const spoofed2 = clientIp(h({ 'x-real-ip': '203.0.113.7', 'x-forwarded-for': `${Math.random()}, 1.2.3.4` }));
    expect(spoofed).toBe(honest);
    expect(spoofed2).toBe(honest);

    // and therefore the limiter keeps counting against the same bucket
    const l = new TokenBucketLimiter();
    for (let i = 0; i < 3; i++) l.take(clientIp(h({ 'x-real-ip': '203.0.113.7', 'x-forwarded-for': `10.0.0.${i}` })), rule, 0);
    expect(l.take(spoofed, rule, 0).allowed).toBe(false);
  });

  it('falls back to the LAST x-forwarded-for hop, never the first', () => {
    expect(clientIp(h({ 'x-forwarded-for': '6.6.6.6, 10.0.0.1, 198.51.100.4' }))).toBe('198.51.100.4');
    expect(clientIp(h({ 'x-forwarded-for': ' 198.51.100.4 ' }))).toBe('198.51.100.4');
    expect(clientIp(h({ 'x-forwarded-for': '1.1.1.1,,' }))).toBe('1.1.1.1');
  });

  it("returns 'unknown' when no headers", () => {
    expect(clientIp(h({}))).toBe('unknown');
  });

  it('caps key length', () => {
    expect(clientIp(h({ 'x-real-ip': 'x'.repeat(500) })).length).toBe(64);
  });
});
