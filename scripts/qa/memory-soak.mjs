#!/usr/bin/env node
/**
 * Read-only load / soak test. Hits a mixed set of GET routes with N concurrent workers for M seconds
 * and reports throughput, latency percentiles, status codes and error rate per route.
 * Used to verify the 1 GB container under load (watch `docker stats mkmovies-web` alongside).
 *
 *   node scripts/qa/memory-soak.mjs --base-url http://localhost:3000 --concurrency 20 --duration 120
 *     [--routes /,/movie/550,...]   override the route mix
 *     [--timeout 15000]             per-request timeout (ms)
 *     [--max-error-rate 0.01]       exit 1 if error rate is above this (errors = network, timeout, 5xx)
 *     [--max-p95 3000]              exit 1 if overall p95 latency (ms) is above this
 *     [--health-every 10]           sample /api/health latency every N seconds (detects event-loop stalls)
 *     [--out report.json]           also write the full JSON report
 *     [--ip-spread]                 send a random X-Real-IP per request (local only — behind Caddy it is
 *                                   overwritten). Without it, API routes may hit the per-IP rate limit (429 —
 *                                   counted separately, NOT as errors).
 *
 * GET only — it never writes. Node ≥ 20 (global fetch), no dependencies, Windows + Linux.
 */
import { writeFileSync } from 'node:fs';
import process from 'node:process';

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] !== undefined && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def;
}
const flag = (name) => process.argv.includes(`--${name}`);

if (flag('help') || flag('h')) {
  console.log(readUsage());
  process.exit(0);
}
function readUsage() {
  return 'usage: node scripts/qa/memory-soak.mjs --base-url <url> [--concurrency 20] [--duration 60] [--routes a,b] [--out file] [--max-error-rate 0.01] [--max-p95 3000] [--ip-spread]';
}

const baseUrl = String(arg('base-url', process.env.E2E_BASE_URL ?? '')).replace(/\/+$/, '');
if (!/^https?:\/\//.test(baseUrl)) {
  console.error(`memory-soak: --base-url is required (got "${baseUrl}")\n${readUsage()}`);
  process.exit(2);
}
const concurrency = Math.max(1, Number(arg('concurrency', 10)));
const durationSec = Math.max(1, Number(arg('duration', 60)));
const timeoutMs = Number(arg('timeout', 15_000));
const maxErrorRate = arg('max-error-rate') !== undefined ? Number(arg('max-error-rate')) : null;
const maxP95 = arg('max-p95') !== undefined ? Number(arg('max-p95')) : null;
const healthEvery = Number(arg('health-every', 10));
const outFile = arg('out');
const ipSpread = flag('ip-spread');

const DEFAULT_ROUTES = [
  // pages (SSR + TMDB fetches)
  '/',
  '/movies',
  '/tv',
  '/trending',
  '/top-rated',
  '/discover',
  '/movie/550',
  '/movie/155',
  '/tv/1399',
  '/person/287',
  '/genre/28',
  '/search?q=batman',
  '/blog',
  '/about',
  // public read-only APIs
  '/api/tmdb/trending/all/week',
  '/api/tmdb/movie/550',
  '/api/reviews?movieId=550',
  '/api/follows/counts?ids=287,819',
  '/api/chat?roomId=general',
  '/api/auth/me',
  // static
  '/robots.txt',
  '/sitemap.xml',
];
const routes = arg('routes') ? String(arg('routes')).split(',').map((s) => s.trim()).filter(Boolean) : DEFAULT_ROUTES;
for (const r of routes) {
  if (!r.startsWith('/')) {
    console.error(`memory-soak: route must start with "/": ${r}`);
    process.exit(2);
  }
}

const stats = new Map(routes.map((r) => [r, { lat: [], statuses: {}, errors: 0, rateLimited: 0, bytes: 0 }]));
const health = [];
let stop = false;
let inFlight = 0;

const randIp = () => `198.18.${Math.floor(Math.random() * 255)}.${1 + Math.floor(Math.random() * 254)}`;

async function hit(route) {
  const s = stats.get(route);
  const t0 = performance.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  inFlight++;
  try {
    const res = await fetch(baseUrl + route, {
      signal: ctrl.signal,
      redirect: 'manual',
      headers: {
        'user-agent': 'mkmovies-memory-soak/1.0',
        'accept-encoding': 'gzip, br',
        ...(ipSpread ? { 'x-real-ip': randIp() } : {}),
      },
    });
    const buf = await res.arrayBuffer();
    s.bytes += buf.byteLength;
    s.statuses[res.status] = (s.statuses[res.status] ?? 0) + 1;
    if (res.status === 429) s.rateLimited++;
    else if (res.status >= 500) s.errors++;
  } catch (err) {
    s.errors++;
    const k = err?.name === 'AbortError' ? 'timeout' : 'network';
    s.statuses[k] = (s.statuses[k] ?? 0) + 1;
  } finally {
    clearTimeout(timer);
    inFlight--;
    s.lat.push(performance.now() - t0);
  }
}

async function worker(id) {
  let i = id;
  while (!stop) {
    await hit(routes[i % routes.length]);
    i += concurrency; // stagger so workers don't all hit the same route at once
  }
}

function pct(sorted, p) {
  if (!sorted.length) return 0;
  return Math.round(sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]);
}

async function sampleHealth() {
  const t0 = performance.now();
  try {
    const r = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(timeoutMs) });
    await r.arrayBuffer();
    health.push({ t: Math.round((Date.now() - started) / 1000), ms: Math.round(performance.now() - t0), status: r.status });
  } catch {
    health.push({ t: Math.round((Date.now() - started) / 1000), ms: null, status: 'error' });
  }
}

console.log(
  `memory-soak: ${baseUrl} · ${routes.length} routes · concurrency ${concurrency} · ${durationSec}s${ipSpread ? ' · ip-spread' : ''} (GET only)`,
);
const started = Date.now();
const healthTimer = healthEvery > 0 ? setInterval(sampleHealth, healthEvery * 1000) : null;
const progress = setInterval(() => {
  const done = [...stats.values()].reduce((a, s) => a + s.lat.length, 0);
  const err = [...stats.values()].reduce((a, s) => a + s.errors, 0);
  process.stdout.write(`  t=${Math.round((Date.now() - started) / 1000)}s requests=${done} errors=${err} inFlight=${inFlight}\n`);
}, 10_000);
const timer = setTimeout(() => {
  stop = true;
}, durationSec * 1000);

process.on('SIGINT', () => {
  stop = true;
});

await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(i)));
clearTimeout(timer);
clearInterval(progress);
if (healthTimer) clearInterval(healthTimer);

const elapsed = (Date.now() - started) / 1000;
const all = [];
const perRoute = [];
let totalErrors = 0;
let totalRateLimited = 0;
let totalBytes = 0;
for (const [route, s] of stats) {
  const sorted = [...s.lat].sort((a, b) => a - b);
  all.push(...sorted);
  totalErrors += s.errors;
  totalRateLimited += s.rateLimited;
  totalBytes += s.bytes;
  perRoute.push({
    route,
    count: sorted.length,
    p50: pct(sorted, 50),
    p95: pct(sorted, 95),
    p99: pct(sorted, 99),
    max: Math.round(sorted[sorted.length - 1] ?? 0),
    errors: s.errors,
    rateLimited: s.rateLimited,
    statuses: s.statuses,
  });
}
all.sort((a, b) => a - b);
const report = {
  baseUrl,
  concurrency,
  durationSec: +elapsed.toFixed(1),
  requests: all.length,
  rps: +(all.length / elapsed).toFixed(1),
  errorRate: all.length ? +(totalErrors / all.length).toFixed(4) : 0,
  rateLimited: totalRateLimited,
  megabytes: +(totalBytes / 1024 / 1024).toFixed(1),
  latencyMs: { p50: pct(all, 50), p95: pct(all, 95), p99: pct(all, 99), max: Math.round(all[all.length - 1] ?? 0) },
  health,
  perRoute,
};

console.log('\nroute'.padEnd(42) + 'count'.padStart(7) + 'p50'.padStart(7) + 'p95'.padStart(7) + 'p99'.padStart(7) + 'err'.padStart(6) + '429'.padStart(6));
for (const r of perRoute) {
  console.log(
    r.route.slice(0, 40).padEnd(41) +
      String(r.count).padStart(7) +
      String(r.p50).padStart(7) +
      String(r.p95).padStart(7) +
      String(r.p99).padStart(7) +
      String(r.errors).padStart(6) +
      String(r.rateLimited).padStart(6),
  );
}
console.log(
  `\nTOTAL ${report.requests} req · ${report.rps} req/s · error rate ${(report.errorRate * 100).toFixed(2)}% · 429s ${report.rateLimited} · p50 ${report.latencyMs.p50}ms p95 ${report.latencyMs.p95}ms p99 ${report.latencyMs.p99}ms`,
);
if (health.length) {
  const ok = health.filter((h) => typeof h.ms === 'number').map((h) => h.ms);
  console.log(`/api/health under load: ${health.length} samples, max ${ok.length ? Math.max(...ok) : 'n/a'}ms, failures ${health.length - ok.length}`);
}
if (outFile) {
  writeFileSync(outFile, JSON.stringify(report, null, 2));
  console.log(`report written to ${outFile}`);
}

let failed = false;
if (maxErrorRate !== null && report.errorRate > maxErrorRate) {
  console.error(`FAIL: error rate ${report.errorRate} > ${maxErrorRate}`);
  failed = true;
}
if (maxP95 !== null && report.latencyMs.p95 > maxP95) {
  console.error(`FAIL: p95 ${report.latencyMs.p95}ms > ${maxP95}ms`);
  failed = true;
}
if (health.some((h) => h.status !== 200)) {
  console.error('FAIL: /api/health failed during the soak (container restarted or event loop stalled?)');
  failed = true;
}
process.exit(failed ? 1 : 0);
