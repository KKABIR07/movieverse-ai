> Referenced from: CLAUDE.md, playwright.config.ts, tests/e2e/support/env.ts

# Testing — mkmovies

## Layers

| Layer | Where | Runs with | Needs |
|---|---|---|---|
| Unit + integration | `src/**/*.test.ts` | `npm test` (Vitest) | nothing — the DB layer runs on PGlite (in-process Postgres) |
| E2E: crawl, a11y, user flows, trailers, rails | `tests/e2e/*.spec.ts` | `npm run test:e2e` | a running server (`E2E_BASE_URL`, default `http://localhost:3000`) |
| Security (authz, IDOR, injection, body cap 413, rate limit 429, JWT, cookies) | `tests/security/` | `npm run test:security` | running server with a DB |
| Performance (LCP/CLS/JS budgets) | `tests/perf/` | `npm run test:perf` | running server |
| Bundle secret scan | `scripts/qa/scan-bundle.mjs` | `npm run qa:bundle` | a `next build` |
| Lighthouse, memory soak | `scripts/qa/lighthouse.mjs`, `memory-soak.mjs` | `npm run qa:lighthouse`, `npm run qa:soak -- <url>` | running server |

Playwright projects: `desktop` (1440 px) and `mobile` (360 px, touch). Tags: `@smoke` = read-only, safe against
production; `@full` = creates users/reviews/follows — **never run @full against https://www.mkmovies.site**.

## One command: `npm run qa` (`scripts/qa/run-all.mjs`)

typecheck → vitest → `next build` → bundle scan → `next start` → Playwright → (optional) Lighthouse / soak → stop.

```bash
# local Postgres for the run (throwaway; the server applies migrations on start)
docker run -d --name mkmovies-qa-pg -e POSTGRES_USER=qa -e POSTGRES_PASSWORD=qa_local_only \
  -e POSTGRES_DB=mkmovies_qa -p 127.0.0.1:5434:5432 postgres:17-alpine
export DATABASE_URL=postgres://qa:qa_local_only@127.0.0.1:5434/mkmovies_qa
node scripts/qa/run-all.mjs --dns-shim <path>/dev-dns.cjs --keep-going   # + --lighthouse --soak 60
docker rm -f mkmovies-qa-pg
```

Flags: `--skip-build`, `--skip-unit`, `--grep "<regex>"`, `--port`, `--keep-going`. Given a non-local URL it runs only
`@smoke|@perf` (read-only).

## Capability gates

`tests/e2e/global-setup.ts` probes `/api/health`, `/api/ready`, `/api/tmdb/configuration` once per run. Tests that need
the DB or TMDB **skip with a reason** when those are down (`E2E_REQUIRE_ALL=1` turns skips into failures).
`E2E_PAGES_B=0` re-marks the Pages-B UI tests as fixme (default: on). `X-Real-IP` is spread per test so the
per-IP rate limiter doesn't throttle a whole run (`E2E_NO_IP_SPREAD=1` to disable).

## Local network quirk (this Windows PC, Jio ISP)

Jio's DNS sinkholes `api.themoviedb.org` and sometimes resets TMDB connections. The dev DNS shim
(`dev-dns.cjs`, preloaded with `NODE_OPTIONS=--require=…` / `--dns-shim`) resolves TMDB via public DNS. Even with it,
an occasional TMDB timeout fails one TMDB-backed test — re-run that test (`--grep`) before calling it a bug.
Production (Oracle) is unaffected.

## Pitfalls seen (keep these in mind when a run goes red)

- **`ChunkLoadError` on every page** → a stale `next start` from an earlier session still owns the port and serves an
  old build. On Windows, stopping the parent shell doesn't kill it: find it with
  `Get-NetTCPConnection -LocalPort 3000` and stop that node process.
- **Parallel tests sharing global state**: follower counts are global — tests that assert counts must use different
  people per test (see `personFor` / `uiPersonFor` in `tests/e2e/user-flows.spec.ts`).
- **Full reload right after a click** can abort the in-flight POST: wait for the response
  (`page.waitForResponse`) before `page.goto`.
- **Metadata on dynamic routes is streamed into `<body>`** for browsers (Next 16), and is in `<head>` only for
  HTML-limited bots — the crawl accepts either; `crawl.spec.ts` checks the bot case explicitly with a Bingbot UA.
- `curl -w` is broken on this workstation (error 43) — use Node `fetch` for status checks.
