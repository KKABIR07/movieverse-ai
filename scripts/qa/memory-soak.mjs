#!/usr/bin/env node
/**
 * Read-only load / memory soak test. Hits a mixed set of GET routes with N concurrent workers for M
 * seconds and reports throughput, latency percentiles, status codes and error rate per route, plus
 * (optionally) the server's memory over time so a leak shows up as steady growth.
 * Used to verify the 1 GB container under load.
 *
 *   node scripts/qa/memory-soak.mjs [<url>] [--base-url <url>] --concurrency 20 --duration 120
 *   npm run qa:soak -- https://www.mkmovies.site --duration 60
 *     URL default: positional > --base-url > $E2E_BASE_URL > http://localhost:3000
 *     [--docker <container>]        sample `docker stats` memory of that container (e.g. mkmovies-web)
 *     [--pid <pid>]                 sample the RSS of a local process (e.g. the `next start` node process)
 *     [--mem-every 5]               memory sample interval (s)
 *     [--max-mem-mb 900]            exit 1 if peak memory exceeds this (MB)
 *     [--max-mem-growth-mb 150]     exit 1 if avg memory of the last third exceeds the first third by this (MB)
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
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
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
  return 'usage: node scripts/qa/memory-soak.mjs [<url>] [--base-url <url>] [--concurrency 20] [--duration 60] [--routes a,b] [--out file] [--max-error-rate 0.01] [--max-p95 3000] [--docker <name> | --pid <pid>] [--max-mem-mb 900] [--max-mem-growth-mb 150] [--ip-spread]';
}

const positionalUrl = process.argv.slice(2).find((a) => /^https?:\/\//i.test(a));
const baseUrl = String(arg('base-url', positionalUrl ?? process.env.E2E_BASE_URL ?? 'http://localhost:3000')).replace(/\/+$/, '');
if (!/^https?:\/\/[^/]+$/i.test(baseUrl)) {
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
const dockerName = arg('docker');
const pid = arg('pid') ? Number(arg('pid')) : null;
const memEvery = Math.max(1, Number(arg('mem-every', 5)));
const maxMemMb = arg('max-mem-mb') !== undefined ? Number(arg('max-mem-mb')) : null;
const maxGrowthMb = arg('max-mem-growth-mb') !== undefined ? Number(arg('max-mem-growth-mb')) : null;

// ─── memory sampling (optional) ────────────────────────────────────────────────
const UNITS = { b: 1 / 1024 / 1024, kb: 1 / 1024, kib: 1 / 1024, mb: 1, mib: 1, gb: 1024, gib: 1024 };
/** "512.3MiB / 1GiB" → 512.3 */
function parseDockerMem(s) {
  const m = /([\d.]+)\s*([kmg]i?b|b)/i.exec(s.split('/')[0] ?? '');
  return m ? +(Number(m[1]) * UNITS[m[2].toLowerCase()]).toFixed(1) : null;
}
/** Current memory (MB) of the --docker container or --pid process; null when unavailable. Cross-platform. */
function sampleMemMb() {
  try {
    if (dockerName) {
      const out = execFileSync('docker', ['stats', '--no-stream', '--format', '{{.MemUsage}}', dockerName], {
        encoding: 'utf8',
        timeout: 15_000,
      });
      return parseDockerMem(out.trim());
    }
    if (pid) {
      if (process.platform === 'linux') {
        const m = /VmRSS:\s+(\d+)\s+kB/.exec(readFileSync(`/proc/${pid}/status`, 'utf8'));
        return m ? +(Number(m[1]) / 1024).toFixed(1) : null;
      }
      if (process.platform === 'win32') {
        // "node.exe","1234","Console","1","123,456 K"  (separator depends on locale)
        const out = execFileSync('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], { encoding: 'utf8', timeout: 15_000 });
        const cols = out.trim().split('","');
        const kb = Number((cols[cols.length - 1] ?? '').replace(/[^\d]/g, ''));
        return kb ? +(kb / 1024).toFixed(1) : null;
      }
      const out = execFileSync('ps', ['-o', 'rss=', '-p', String(pid)], { encoding: 'utf8', timeout: 15_000 });
      const kb = Number(out.trim());
      return kb ? +(kb / 1024).toFixed(1) : null;
    }
  } catch {
    return null;
  }
  return null;
}
const memory = [];

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
const memSource = dockerName ? `docker:${dockerName}` : pid ? `pid:${pid}` : null;
if (memSource) memory.push({ t: 0, mb: sampleMemMb() });
const memTimer = memSource
  ? setInterval(() => memory.push({ t: Math.round((Date.now() - started) / 1000), mb: sampleMemMb() }), memEvery * 1000)
  : null;
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
if (memTimer) clearInterval(memTimer);
if (memSource) memory.push({ t: Math.round((Date.now() - started) / 1000), mb: sampleMemMb() });
const memVals = memory.map((m) => m.mb).filter((v) => typeof v === 'number');
const third = Math.max(1, Math.floor(memVals.length / 3));
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const memSummary = memSource
  ? {
      source: memSource,
      samples: memVals.length,
      startMb: memVals[0] ?? null,
      peakMb: memVals.length ? Math.max(...memVals) : null,
      endMb: memVals[memVals.length - 1] ?? null,
      // first-third vs last-third average: robust to the GC sawtooth
      growthMb: memVals.length >= 3 ? +(avg(memVals.slice(-third)) - avg(memVals.slice(0, third))).toFixed(1) : null,
    }
  : null;

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
  memory: memSummary ? { ...memSummary, series: memory } : null,
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
if (memSummary) {
  console.log(
    `memory (${memSummary.source}): start ${memSummary.startMb} MB · peak ${memSummary.peakMb} MB · end ${memSummary.endMb} MB · growth ${memSummary.growthMb ?? 'n/a'} MB (${memSummary.samples} samples)`,
  );
  if (!memSummary.samples) console.warn('memory: no samples could be read (wrong --pid / --docker name, or no docker CLI?)');
} else {
  console.log('memory: not sampled (pass --pid <pid> for a local server or --docker <container> on the box)');
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
if (memSummary && maxMemMb !== null && memSummary.peakMb !== null && memSummary.peakMb > maxMemMb) {
  console.error(`FAIL: peak memory ${memSummary.peakMb} MB > ${maxMemMb} MB`);
  failed = true;
}
if (memSummary && maxGrowthMb !== null && memSummary.growthMb !== null && memSummary.growthMb > maxGrowthMb) {
  console.error(`FAIL: memory grew ${memSummary.growthMb} MB (> ${maxGrowthMb} MB) — possible leak`);
  failed = true;
}
if (health.some((h) => h.status !== 200)) {
  console.error('FAIL: /api/health failed during the soak (container restarted or event loop stalled?)');
  failed = true;
}
process.exit(failed ? 1 : 0);
