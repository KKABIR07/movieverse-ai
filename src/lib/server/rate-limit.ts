/**
 * In-memory token-bucket rate limiter (single instance — fine for the one-container OCI deploy).
 * Pure: no Next imports, time is injectable → unit-tested in rate-limit.test.ts.
 *
 * Memory is bounded: at most `maxKeys` buckets; the least-recently-used bucket is evicted first
 * (Map insertion order, refreshed on access), and fully-refilled idle buckets are swept periodically.
 */

export interface RateRule {
  /** Bucket name — part of the key so different rules never share tokens. */
  name: string;
  /** Burst size = tokens when full. */
  capacity: number;
  /** Time to refill a full bucket from empty (ms). Refill rate = capacity / windowMs. */
  windowMs: number;
}

export interface RateResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  /** Seconds until at least one token is available (0 when allowed). */
  retryAfterSec: number;
}

interface Bucket {
  tokens: number;
  updated: number;
}

export class TokenBucketLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private lastSweep = 0;

  constructor(
    private readonly maxKeys = 10_000,
    private readonly sweepEveryMs = 60_000,
  ) {}

  get size(): number {
    return this.buckets.size;
  }

  take(id: string, rule: RateRule, now: number = Date.now(), cost = 1): RateResult {
    this.maybeSweep(now);
    const key = `${rule.name}|${id}`;
    const ratePerMs = rule.capacity / rule.windowMs;
    let b = this.buckets.get(key);
    if (b) {
      this.buckets.delete(key); // refresh LRU position
      const elapsed = Math.max(0, now - b.updated);
      b.tokens = Math.min(rule.capacity, b.tokens + elapsed * ratePerMs);
      b.updated = now;
    } else {
      b = { tokens: rule.capacity, updated: now };
      while (this.buckets.size >= this.maxKeys) {
        const oldest = this.buckets.keys().next().value;
        if (oldest === undefined) break;
        this.buckets.delete(oldest);
      }
    }
    this.buckets.set(key, b);

    if (b.tokens >= cost) {
      b.tokens -= cost;
      return { allowed: true, remaining: Math.floor(b.tokens), limit: rule.capacity, retryAfterSec: 0 };
    }
    const missing = cost - b.tokens;
    return {
      allowed: false,
      remaining: 0,
      limit: rule.capacity,
      retryAfterSec: Math.max(1, Math.ceil(missing / ratePerMs / 1000)),
    };
  }

  /** Drop buckets idle long enough to be full again (they carry no state worth keeping). */
  private maybeSweep(now: number): void {
    if (now - this.lastSweep < this.sweepEveryMs) return;
    this.lastSweep = now;
    // Conservative: anything untouched for 10 minutes is surely refilled for our rules (max window 60s).
    const cutoff = now - 10 * 60_000;
    for (const [k, b] of this.buckets) {
      if (b.updated < cutoff) this.buckets.delete(k);
    }
  }

  reset(): void {
    this.buckets.clear();
  }
}

// ─── Route rules ────────────────────────────────────────────────────────────────

const MIN = 60_000;

export const RULES = {
  auth: { name: 'auth', capacity: 10, windowMs: MIN },
  ai: { name: 'ai', capacity: 20, windowMs: MIN },
  chatPost: { name: 'chat-post', capacity: 10, windowMs: 10_000 },
  youtube: { name: 'youtube', capacity: 30, windowMs: MIN },
  tmdb: { name: 'tmdb', capacity: 300, windowMs: MIN },
  default: { name: 'default', capacity: 120, windowMs: MIN },
} as const satisfies Record<string, RateRule>;

/** Which bucket applies to a request. Returns null for exempt paths (health checks). */
export function ruleFor(pathname: string, method: string): RateRule | null {
  if (pathname === '/api/health' || pathname === '/api/ready') return null;
  if (pathname.startsWith('/api/auth/')) return RULES.auth;
  if (pathname.startsWith('/api/ai/')) return RULES.ai;
  if (pathname === '/api/chat' && method === 'POST') return RULES.chatPost;
  if (pathname.startsWith('/api/youtube/')) return RULES.youtube;
  if (pathname.startsWith('/api/tmdb/')) return RULES.tmdb;
  return RULES.default;
}

/**
 * Client IP for rate-limit keys. Production path: Cloudflare → Caddy → app.
 *   1. `X-Real-IP` — set by Caddy from Cloudflare's CF-Connecting-IP (origin only accepts Cloudflare IPs).
 *   2. LAST hop of `X-Forwarded-For` — appended by the nearest proxy; earlier hops are client-supplied.
 *   3. 'unknown'.
 * The FIRST XFF hop is never used: clients can put anything there (Cloudflare appends, not replaces).
 * Values are length-capped to bound key size.
 */
export function clientIp(headers: Headers): string {
  const real = headers.get('x-real-ip')?.trim();
  if (real) return real.slice(0, 64);
  const hops = (headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean);
  const last = hops[hops.length - 1];
  return (last || 'unknown').slice(0, 64);
}
