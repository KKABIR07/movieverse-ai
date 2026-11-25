#!/usr/bin/env node
/**
 * All-in-one QA gate (npm run qa). Cross-platform (Windows + Linux), Node ≥ 20, no dependencies.
 *
 * LOCAL mode (default — no URL, or a localhost URL):
 *   1. tsc --noEmit            2. vitest run (unit + PGlite integration)
 *   3. next build              4. bundle secret scan (scripts/qa/scan-bundle.mjs)
 *   5. next start -p <port>    6. Playwright: e2e + security + perf (all tags)
 *   7. optional: --lighthouse, --soak <seconds>            8. stop the server
 * REMOTE mode (a non-local URL, e.g. https://www.mkmovies.site): read-only only —
 *   Playwright `@smoke|@perf` against the URL (+ --lighthouse / --soak if asked). Nothing is built or written.
 *
 *   node scripts/qa/run-all.mjs [<url>] [--port 3000] [--skip-build] [--skip-unit] [--lighthouse] [--soak 60]
 *                               [--dns-shim <file.cjs>] [--grep <playwright grep>] [--keep-going]
 *
 * --dns-shim (or $QA_DNS_SHIM): preloaded into `next start` via NODE_OPTIONS=--require=<file> — used on
 *   dev PCs whose ISP sinkholes api.themoviedb.org. The server's env (DATABASE_URL, …) comes from
 *   .env.local / the environment exactly as for `npm run start`.
 * Exit code: 0 all steps passed, 1 a step failed, 2 usage / server failed to start.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const argv = process.argv.slice(2);
function arg(name, def) {
  const i = argv.indexOf(`--${name}`);
  return i > -1 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : def;
}
const flag = (name) => argv.includes(`--${name}`);
const isWin = process.platform === 'win32';
const npx = isWin ? 'npx.cmd' : 'npx';

const positionalUrl = argv.find((a) => /^https?:\/\//i.test(a));
const port = Number(arg('port', 3000));
const baseUrl = String(positionalUrl ?? process.env.E2E_BASE_URL ?? `http://localhost:${port}`).replace(/\/+$/, '');
const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(baseUrl);
const keepGoing = flag('keep-going');
const dnsShim = arg('dns-shim', process.env.QA_DNS_SHIM);
const soakSec = arg('soak');

if (dnsShim && !existsSync(dnsShim)) {
  console.error(`qa: --dns-shim file not found: ${dnsShim}`);
  process.exit(2);
}

const results = [];
function step(name, cmd, args, env = {}) {
  console.log(`\n━━ qa: ${name} ━━ ${cmd} ${args.join(' ')}`);
  const t0 = Date.now();
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: isWin, env: { ...process.env, ...env } });
  const ok = r.status === 0;
  results.push({ name, ok, sec: Math.round((Date.now() - t0) / 1000), code: r.status });
  if (!ok && !keepGoing) finish();
  return ok;
}

let server = null;
function stopServer() {
  if (!server || server.exitCode !== null) return;
  if (isWin) spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
  else {
    try {
      process.kill(-server.pid, 'SIGTERM');
    } catch {
      server.kill('SIGTERM');
    }
  }
}

function finish() {
  stopServer();
  console.log('\n━━ qa summary ━━');
  for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name.padEnd(28)} ${String(r.sec).padStart(5)}s${r.ok ? '' : `  (exit ${r.code})`}`);
  const failed = results.some((r) => !r.ok);
  console.log(failed ? '\nqa: FAILED' : '\nqa: all steps passed');
  process.exit(failed ? 1 : 0);
}
process.on('SIGINT', () => {
  stopServer();
  process.exit(130);
});

async function waitForHealth(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (server && server.exitCode !== null) return false;
    try {
      const r = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(3_000) });
      if (r.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1_000));
  }
  return false;
}

console.log(`qa: ${isLocal ? 'LOCAL' : 'REMOTE (read-only)'} mode → ${baseUrl}`);

if (isLocal) {
  if (!flag('skip-unit')) {
    step('typecheck', npx, ['tsc', '--noEmit']);
    step('unit + integration (vitest)', npx, ['vitest', 'run']);
  }
  if (!flag('skip-build')) step('next build', npx, ['next', 'build']);
  step('bundle secret scan', process.execPath, [path.join('scripts', 'qa', 'scan-bundle.mjs')]);

  let alreadyUp = false;
  try {
    alreadyUp = (await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(2_000) })).ok;
  } catch {
    /* nothing listening */
  }
  if (alreadyUp) {
    console.log(`\nqa: a server is already answering on ${baseUrl} — using it (not started by qa).`);
  } else {
    const nodeOptions = [process.env.NODE_OPTIONS, dnsShim ? `--require=${path.resolve(dnsShim)}` : ''].filter(Boolean).join(' ');
    console.log(`\n━━ qa: next start -p ${port}${dnsShim ? ' (with DNS shim)' : ''} ━━`);
    server = spawn(npx, ['next', 'start', '-p', String(port)], {
      stdio: ['ignore', 'inherit', 'inherit'],
      shell: isWin,
      detached: !isWin,
      env: { ...process.env, ...(nodeOptions ? { NODE_OPTIONS: nodeOptions } : {}) },
    });
    if (!(await waitForHealth(baseUrl, 90_000))) {
      console.error(`qa: server did not become healthy on ${baseUrl}`);
      results.push({ name: 'next start', ok: false, sec: 90, code: server.exitCode });
      finish();
    }
    results.push({ name: 'next start', ok: true, sec: 0, code: 0 });
  }
}

const pwArgs = ['playwright', 'test'];
const grep = arg('grep', isLocal ? undefined : '@smoke|@perf');
if (grep) pwArgs.push('--grep', grep);
step(`playwright${grep ? ` (${grep})` : ''}`, npx, pwArgs, { E2E_BASE_URL: baseUrl });

if (flag('lighthouse')) step('lighthouse', process.execPath, [path.join('scripts', 'qa', 'lighthouse.mjs'), baseUrl]);
if (soakSec) {
  const extra = server && !isWin ? ['--pid', String(server.pid)] : [];
  step('memory soak', process.execPath, [path.join('scripts', 'qa', 'memory-soak.mjs'), baseUrl, '--duration', String(soakSec), ...extra]);
}
finish();
