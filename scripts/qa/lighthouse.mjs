#!/usr/bin/env node
/**
 * Lighthouse gate for mkmovies (desktop + mobile).
 *
 *   node scripts/qa/lighthouse.mjs [<url>] [--base-url http://localhost:3000] [--paths /,/movie/550]
 *   npm run qa:lighthouse -- https://www.mkmovies.site
 *                                  [--forms desktop,mobile] [--out-dir test-results/lighthouse] [--no-fallback]
 *
 * Thresholds (0–100, override with env):
 *   LH_PERF_DESKTOP 85 · LH_PERF_MOBILE 0 (reported, not enforced — mobile perf is throttled 4× CPU / slow 4G,
 *   set e.g. LH_PERF_MOBILE=70 to enforce) · LH_A11Y 95 · LH_BEST 95 · LH_SEO 95
 *
 * Chrome: uses $CHROME_PATH, else Playwright's bundled Chromium (`npx playwright install chromium`).
 * Lighthouse: `npx --yes lighthouse@12` (downloaded on first use). If Lighthouse cannot run (offline,
 * no Chrome), falls back to the Playwright web-vitals budgets in tests/perf (LCP/CLS/JS bytes) unless
 * --no-fallback is given. Exit 0 = all thresholds met, 1 = a threshold failed, 2 = could not run.
 *
 * Run it against a production build (`npm run build && npm run start`) or the live site — never `next dev`.
 * Note on SEO: /movie/550 etc. on localhost are fine; Lighthouse's "is-crawlable" audit fails if the
 * page sends `noindex`, which is correct behaviour for staging hosts — run SEO gates against prod.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def;
}
const flag = (name) => process.argv.includes(`--${name}`);

// URL: positional (`lighthouse.mjs https://…`) > --base-url > $E2E_BASE_URL > http://localhost:3000
const positionalUrl = process.argv.slice(2).find((a) => /^https?:\/\//i.test(a));
const baseUrl = String(arg('base-url', positionalUrl ?? process.env.E2E_BASE_URL ?? 'http://localhost:3000')).replace(/\/+$/, '');
if (!/^https?:\/\/[^/]+$/i.test(baseUrl)) {
  console.error(`lighthouse: invalid base URL "${baseUrl}" (expected e.g. http://localhost:3000)`);
  process.exit(2);
}
const paths = String(arg('paths', '/,/movie/550')).split(',').filter(Boolean);
const forms = String(arg('forms', 'desktop,mobile')).split(',').filter(Boolean);
const outDir = path.resolve(arg('out-dir', path.join('test-results', 'lighthouse')));
const isWin = process.platform === 'win32';

const T = {
  perf: { desktop: Number(process.env.LH_PERF_DESKTOP ?? 85), mobile: Number(process.env.LH_PERF_MOBILE ?? 0) },
  accessibility: Number(process.env.LH_A11Y ?? 95),
  'best-practices': Number(process.env.LH_BEST ?? 95),
  seo: Number(process.env.LH_SEO ?? 95),
};

async function chromePath() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  try {
    const { chromium } = await import('@playwright/test');
    const p = chromium.executablePath();
    if (p && existsSync(p)) return p;
  } catch {
    /* fall through */
  }
  return null;
}

function run(cmd, args, env = {}) {
  return spawnSync(cmd, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    shell: isWin, // npx is a .cmd shim on Windows
    env: { ...process.env, ...env },
    maxBuffer: 64 * 1024 * 1024,
    timeout: 300_000,
  });
}

function fallback(reason) {
  console.warn(`lighthouse: cannot run Lighthouse (${reason}).`);
  if (flag('no-fallback')) process.exit(2);
  console.warn('lighthouse: falling back to Playwright web-vitals budgets (tests/perf, @perf).');
  const r = spawnSync(isWin ? 'npx.cmd' : 'npx', ['playwright', 'test', 'tests/perf', '--project=desktop', '--grep', '@perf'], {
    stdio: 'inherit',
    shell: isWin,
    env: { ...process.env, E2E_BASE_URL: baseUrl },
  });
  process.exit(r.status ?? 2);
}

const chrome = await chromePath();
if (!chrome) fallback('no Chrome/Chromium found — set CHROME_PATH or run `npx playwright install chromium`');

const probe = run(isWin ? 'npx.cmd' : 'npx', ['--yes', 'lighthouse@12', '--version']);
if (probe.status !== 0) fallback(`lighthouse CLI unavailable: ${(probe.stderr || probe.error?.message || '').trim().slice(0, 200)}`);

// Fail fast (exit 2) when nothing is listening, instead of N Lighthouse runtime errors.
try {
  const r = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
} catch (err) {
  console.error(`lighthouse: ${baseUrl} is not reachable (/api/health: ${err?.message ?? err}). Start the app or pass the right URL.`);
  process.exit(2);
}

mkdirSync(outDir, { recursive: true });
const results = [];
let failed = false;

for (const form of forms) {
  for (const p of paths) {
    const url = baseUrl + p;
    const slug = `${form}${p.replace(/[^\w]+/g, '-').replace(/-+$/, '') || '-home'}`;
    const outBase = path.join(outDir, slug);
    const args = [
      '--yes',
      'lighthouse@12',
      url,
      '--quiet',
      '--output=json',
      '--output=html',
      `--output-path=${outBase}`,
      '--only-categories=performance,accessibility,best-practices,seo',
      '--chrome-flags=--headless=new --no-sandbox --disable-gpu',
      '--max-wait-for-load=60000',
    ];
    if (form === 'desktop') args.push('--preset=desktop');
    else args.push('--form-factor=mobile');
    process.stdout.write(`lighthouse: ${form.padEnd(7)} ${url} … `);
    const r = run(isWin ? 'npx.cmd' : 'npx', args, { CHROME_PATH: chrome });
    const jsonFile = `${outBase}.report.json`;
    if (r.status !== 0 || !existsSync(jsonFile)) {
      console.log('ERROR');
      console.error((r.stderr || '').split('\n').slice(-8).join('\n'));
      failed = true;
      continue;
    }
    const lhr = JSON.parse(readFileSync(jsonFile, 'utf8'));
    const s = Object.fromEntries(Object.entries(lhr.categories).map(([k, v]) => [k, Math.round((v.score ?? 0) * 100)]));
    const need = {
      performance: T.perf[form] ?? 0,
      accessibility: T.accessibility,
      'best-practices': T['best-practices'],
      seo: T.seo,
    };
    const misses = Object.entries(need).filter(([k, min]) => (s[k] ?? 0) < min);
    const audits = lhr.audits;
    const lcp = audits['largest-contentful-paint']?.displayValue;
    const cls = audits['cumulative-layout-shift']?.displayValue;
    const tbt = audits['total-blocking-time']?.displayValue;
    console.log(
      `perf ${s.performance} · a11y ${s.accessibility} · best ${s['best-practices']} · seo ${s.seo}  (LCP ${lcp}, CLS ${cls}, TBT ${tbt})${misses.length ? '  FAIL' : '  ok'}`,
    );
    for (const [k, min] of misses) {
      const failing = Object.values(audits)
        .filter((a) => lhr.categories[k].auditRefs.some((ref) => ref.id === a.id && ref.weight > 0) && a.score !== null && a.score < 0.9)
        .slice(0, 6)
        .map((a) => `      - ${a.id}: ${a.title}`);
      console.log(`    ${k} ${s[k]} < ${min}\n${failing.join('\n')}`);
    }
    if (misses.length) failed = true;
    results.push({ form, url, scores: s, lcp, cls, tbt, report: `${outBase}.report.html` });
  }
}

console.log(`lighthouse: reports in ${outDir}`);
process.exit(failed ? 1 : 0);
