/**
 * Server-side environment access. Every getter is LAZY and FAIL-FAST:
 * nothing is read at import time (so `next build` works without secrets), and a missing/invalid
 * required value throws a ConfigError (→ HTTP 503 NOT_CONFIGURED) the first time it is used.
 *
 * Server-only vars: TMDB_BEARER (required, v4 read token), TMDB_API_KEY (optional v3 fallback),
 * MONGODB_URI, JWT_SECRET (>= 32 chars), GROQ_API_KEY (optional feature), YOUTUBE_API_KEY (optional feature).
 * Public: NEXT_PUBLIC_SITE_URL.
 */
import { ConfigError } from './errors';

const PLACEHOLDER = /^(your[_-]|changeme|change[_-]?me|xxx|<|placeholder)/i;

function read(name: string): string | undefined {
  const v = process.env[name]?.trim();
  if (!v || PLACEHOLDER.test(v)) return undefined;
  return v;
}

export type TmdbAuth = { kind: 'bearer'; token: string } | { kind: 'apiKey'; key: string };

/** TMDB credentials: v4 bearer preferred, v3 api_key as fallback. Throws if neither is usable. */
export function getTmdbAuth(): TmdbAuth {
  const bearer = read('TMDB_BEARER');
  if (bearer && bearer.length >= 20) return { kind: 'bearer', token: bearer };
  const key = read('TMDB_API_KEY');
  if (key && key.length >= 10) return { kind: 'apiKey', key };
  throw new ConfigError('TMDB_BEARER', 'missing (and no usable TMDB_API_KEY fallback)');
}

export function isTmdbConfigured(): boolean {
  try {
    getTmdbAuth();
    return true;
  } catch {
    return false;
  }
}

export function getMongoUri(): string {
  const uri = read('MONGODB_URI');
  if (!uri) throw new ConfigError('MONGODB_URI', 'missing');
  if (!/^mongodb(\+srv)?:\/\//.test(uri)) throw new ConfigError('MONGODB_URI', 'must start with mongodb:// or mongodb+srv://');
  return uri;
}

export function getJwtSecret(): string {
  const secret = read('JWT_SECRET');
  if (!secret) throw new ConfigError('JWT_SECRET', 'missing');
  if (secret.length < 32) throw new ConfigError('JWT_SECRET', 'must be at least 32 characters');
  return secret;
}

/** Optional feature key — returns null when not configured (route answers 503). */
export function getGroqApiKey(): string | null {
  return read('GROQ_API_KEY') ?? null;
}

/** Optional feature key — returns null when not configured (route answers 503). */
export function getYoutubeApiKey(): string | null {
  const k = read('YOUTUBE_API_KEY');
  return k && k.length >= 20 ? k : null;
}

/** Canonical public site URL without trailing slash. */
export function getSiteUrl(): string {
  const raw = read('NEXT_PUBLIC_SITE_URL') ?? 'http://localhost:3000';
  return raw.replace(/\/+$/, '');
}

export const isProduction = (): boolean => process.env.NODE_ENV === 'production';
