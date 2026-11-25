/**
 * Patterns that must never appear in anything shipped to the browser.
 * Shared by scripts/qa/scan-bundle.mjs (build output) and tests/security/client-bundle.spec.ts (live site).
 * Matches are reported REDACTED — never print a secret.
 */

/** @type {{ id: string, re: RegExp, why: string, severity?: 'warn' }[]} */
export const SECRET_PATTERNS = [
  { id: 'jwt', re: /eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{16,}/g, why: 'JWT (e.g. TMDB v4 bearer token)' },
  { id: 'groq', re: /gsk_[A-Za-z0-9]{20,}/g, why: 'Groq API key' },
  { id: 'google', re: /AIza[0-9A-Za-z_-]{35}/g, why: 'Google / YouTube API key' },
  { id: 'postgres-url', re: /postgres(?:ql)?:\/\/[^\s"'`]+/gi, why: 'Postgres connection string' },
  { id: 'mongo-url', re: /mongodb(?:\+srv)?:\/\/[^\s"'`]+/gi, why: 'MongoDB connection string' },
  {
    id: 'server-secret-name',
    re: /\b(?:JWT_SECRET|TMDB_BEARER|GROQ_API_KEY|YOUTUBE_API_KEY|DATABASE_URL|POSTGRES_PASSWORD)\b/g,
    why: 'server-only env var NAME in client output (server module bundled for the browser, or setup text shown to visitors)',
    severity: 'warn', // a name is not a secret; values are checked separately (SECRET_ENV_KEYS)
  },
  { id: 'private-key', re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, why: 'PEM private key' },
];

/** Server-only env vars whose VALUES must not appear in client output (checked when available locally). */
export const SECRET_ENV_KEYS = [
  'TMDB_BEARER',
  'TMDB_API_KEY',
  'NEXT_PUBLIC_TMDB_BEARER', // legacy — must not be inlined anymore
  'NEXT_PUBLIC_TMDB_API_KEY', // legacy — must not be inlined anymore
  'JWT_SECRET',
  'GROQ_API_KEY',
  'YOUTUBE_API_KEY',
  'MONGODB_URI',
  'DATABASE_URL',
  'POSTGRES_PASSWORD',
];

export function redact(s) {
  return s.length <= 10 ? '***' : `${s.slice(0, 6)}…(${s.length} chars)`;
}

/**
 * @param {string} text
 * @param {{ envValues?: Record<string,string> }} [opts]
 * @returns {{ id: string, why: string, sample: string, severity: 'error' | 'warn' }[]}
 */
export function findSecrets(text, opts = {}) {
  const hits = [];
  for (const p of SECRET_PATTERNS) {
    p.re.lastIndex = 0;
    const m = text.match(p.re);
    if (m) for (const s of new Set(m)) hits.push({ id: p.id, why: p.why, sample: redact(s), severity: p.severity ?? 'error' });
  }
  for (const [k, v] of Object.entries(opts.envValues ?? {})) {
    if (v && v.length >= 12 && text.includes(v)) hits.push({ id: `env:${k}`, why: `value of ${k}`, sample: redact(v), severity: 'error' });
  }
  return hits;
}
