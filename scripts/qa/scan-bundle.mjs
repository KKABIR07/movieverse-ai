#!/usr/bin/env node
/**
 * Scan the client build output for leaked secrets. Run after `next build`.
 *
 *   node scripts/qa/scan-bundle.mjs [--dir .next/static] [--no-prerendered] [--env-file .env.local] [--json]
 *
 * - Walks every *.js / *.mjs / *.css / *.json / *.html / *.map file under --dir (default .next/static).
 * - Also scans the PRERENDERED pages that are sent to browsers verbatim (.html and .rsc files under .next/server/app)
 *   unless --no-prerendered. (Server JS chunks are NOT scanned — they legitimately read secrets.)
 * - Looks for secret-shaped strings (scripts/qa/secret-patterns.mjs) and, if an env file is given or
 *   found (.env.production, .env.local), the literal VALUES of server-only secrets.
 * - Prints redacted findings only. Exit 0 = clean, 1 = leak found, 2 = usage / no build output.
 * Cross-platform (Node ≥ 20, no deps).
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { findSecrets, SECRET_ENV_KEYS } from './secret-patterns.mjs';

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def;
}
const flag = (name) => process.argv.includes(`--${name}`);

const root = process.cwd();
const dir = path.resolve(root, arg('dir', path.join('.next', 'static')));
const asJson = flag('json');

if (!existsSync(dir) || !statSync(dir).isDirectory()) {
  console.error(`scan-bundle: build output not found at ${dir} — run \`npm run build\` first.`);
  process.exit(2);
}

/** Minimal .env parser (KEY=VALUE, optional quotes, # comments). Values never printed. */
function parseEnv(file) {
  const out = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

const envFileArg = arg('env-file');
const envCandidates = envFileArg ? [envFileArg] : ['.env.production', '.env.local', '.env'];
const envValues = {};
let envSource = null;
for (const f of envCandidates) {
  const p = path.resolve(root, f);
  if (existsSync(p)) {
    const parsed = parseEnv(p);
    for (const k of SECRET_ENV_KEYS) if (parsed[k]) envValues[k] = parsed[k];
    envSource = f;
    break;
  }
}
for (const k of SECRET_ENV_KEYS) if (!envValues[k] && process.env[k]) envValues[k] = process.env[k];

const EXT = new Set(['.js', '.mjs', '.cjs', '.css', '.json', '.html', '.txt', '.map', '.rsc']);
function* walk(d) {
  for (const entry of readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (EXT.has(path.extname(entry.name))) yield p;
  }
}

let files = 0;
let bytes = 0;
const findings = [];
function scanFile(file, { skipNames = false } = {}) {
  const text = readFileSync(file, 'utf8');
  files++;
  bytes += text.length;
  for (const hit of findSecrets(text, { envValues })) {
    // An env var NAME inside rendered HTML (e.g. docs/blog text) is not a leak of its value.
    if (skipNames && hit.id === 'server-secret-name') continue;
    findings.push({ file: path.relative(root, file), ...hit });
  }
}
for (const file of walk(dir)) scanFile(file);

const prerenderedDir = path.resolve(root, '.next', 'server', 'app');
const scanPrerendered = !flag('no-prerendered') && !arg('dir') && existsSync(prerenderedDir);
let prerendered = 0;
if (scanPrerendered) {
  for (const file of walk(prerenderedDir)) {
    if (!/\.(html|rsc)$/.test(file)) continue;
    prerendered++;
    scanFile(file, { skipNames: true });
  }
}

const summary = {
  dir: path.relative(root, dir) || '.',
  files,
  prerenderedFiles: prerendered,
  megabytes: +(bytes / 1024 / 1024).toFixed(2),
  envValuesChecked: Object.keys(envValues),
  envSource,
  findings,
};

if (asJson) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  console.log(
    `scan-bundle: scanned ${files} files (${summary.megabytes} MB) in ${summary.dir}` +
      (scanPrerendered ? ` + ${prerendered} prerendered HTML/RSC files in .next/server/app` : ''),
  );
  console.log(`scan-bundle: secret values checked: ${summary.envValuesChecked.join(', ') || '(none — no env file found)'}`);
  if (!findings.length) console.log('scan-bundle: OK — no secrets found.');
  for (const f of findings) console.log(`  LEAK [${f.id}] ${f.why} in ${f.file}: ${f.sample}`);
}
process.exit(findings.length ? 1 : 0);
