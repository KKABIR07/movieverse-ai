@AGENTS.md

# mkmovies (MovieVerse AI)

Movie & TV discovery site — https://www.mkmovies.site. Repo: github.com/KKABIR07/movieverse-ai.
Next.js 16 (App Router, `output: standalone`) · React 19 · Tailwind 4 · PostgreSQL 17 via Drizzle · TMDB · YouTube ·
Groq. Self-hosted on the OCI box **mkb-007** behind Cloudflare. **No Vercel, no MongoDB** (both retired 2026-11).

## Reference docs (read before working on the topic)

| Topic | Doc |
|---|---|
| Deploy, box, caps, backups, rollback, Cloudflare, troubleshooting | `CLAUDE_REFERENCE/deployment.md` |
| Tests, QA runner, local quirks, known pitfalls | `CLAUDE_REFERENCE/testing.md` |
| Global standards (env, git, planning) | `~/.claude/CLAUDE.md` + `~/.claude/CLAUDE_REFERENCE/` |
| Current work / resume point | `Plan_WIP.md` (`SESSION_CONTEXT_RETRIEVAL`) |

## Commands

```bash
npm run dev            # local dev (this PC needs the TMDB DNS shim — see testing.md)
npm run check          # lint + typecheck + vitest
npm test               # vitest (unit + PGlite integration)
npm run qa             # full gate: typecheck, vitest, build, bundle scan, start, Playwright (needs DATABASE_URL)
./scripts/deploy.sh    # ship committed HEAD to mkb-007 (Git Bash). --dry-run first if unsure
ENV_FILE=.env.local ./scripts/push-env.sh --restart TMDB_BEARER   # update one server secret
node scripts/gen-icons.mjs   # regenerate favicon / app icons from the brand mark
```

## Architecture (short)

- `src/app/` — routes. Public content pages are Server Components (TMDB fetched server-side, revalidated) with
  small client islands; user pages (watchlist, profile, feed, following) are client + `noindex`.
- `src/app/api/*` — route handlers behind `src/proxy.ts` (per-IP token-bucket rate limit, 64 KB body cap,
  JSON/Origin checks). Shared `withHandler` + zod validation in `src/lib/server/`.
  Endpoints: auth (signup/login/logout/logout-all/me), watchlist, reviews (+like), follows (+counts), chat,
  ai/recommend (Groq), youtube (shorts/status), tmdb/[...path] (allowlisted proxy), health, ready.
- `src/lib/db/` — Drizzle schema, client, auth (JWT HS256 cookie, tokenVersion revocation, bcrypt). Migrations in
  `drizzle/migrations`, applied at startup (`src/instrumentation.ts`, advisory lock).
- `src/lib/tmdb*`, `src/lib/media/trailers.ts` — TMDB access (browser → `/api/tmdb` proxy; server → direct).
- `src/store/` — zustand stores (auth not persisted; watchlist/follows server-backed with optimistic rollback).
- `src/components/` — `ui/` primitives, `media/` (cards, rails, hero, BackgroundTrailer), `layout/` (header, logo).

## Business rules / conventions

- Honest data only: no invented stats, follower counts or third-party scores. Ratings come from TMDB.
- One watchlist per account, keyed `${media_type}:${id}` (a movie and a TV show can share an id).
- Secrets only server-side (`TMDB_BEARER`, `GROQ_API_KEY`, `YOUTUBE_API_KEY`, `JWT_SECRET`, `DATABASE_URL`);
  `npm run qa:bundle` fails the build gate if one reaches the client. Never commit `.env*` (only `.env.example`).
- Whole app is capped at **1 GiB RAM / 5 GiB disk** (systemd slice + loop fs) — budget every new dependency.
- Trailers autoplay only muted, never with `prefers-reduced-motion` or Save-Data; hover previews only on
  pointer devices.
- Brand: "Noir & Gold" mark (`src/components/layout/Logo.tsx` = `scripts/gen-icons.mjs` geometry — keep in sync).
- Next 16 differs from older Next: read `node_modules/next/dist/docs/` before using routing/metadata/caching APIs.

## Pitfalls (details in the reference docs)

- Client clicks during the sign-in check must `await resolveAuthStatus()` — never treat `'unknown'` as signed out.
- Store hydrate-from-server must not overwrite items the user changed while the fetch was in flight.
- Horizontal rails are `overflow-y-hidden` (oversized glyphs otherwise make them scroll vertically).
- Deploy validates Caddy as the `caddy` user (a root validate once left a root-owned log → Cloudflare 525).

## Collaboration

Branch per task (`feature/`, `fix/`, `chore/`), small commits with `feat:`/`fix:`/`chore:`/`test:`/`wip:` prefixes,
PR into `main`. Keep `Plan_WIP.md` updated before each major step; update `CLAUDE_REFERENCE/` when deploy, schema,
endpoints or env vars change.
