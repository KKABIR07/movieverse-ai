# mkmovies

Discover movies and TV shows — trending lists, Top 10s, genres, cast, trailers, reviews and a personal watchlist.

**Live:** https://www.mkmovies.site

## Stack

Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · PostgreSQL 17 + Drizzle ORM · TMDB API · YouTube Data API ·
Groq (AI assistant). Self-hosted with Docker on an Oracle Cloud VM behind Cloudflare; the whole app (web + database)
runs inside a 1 GiB RAM / 5 GiB disk budget.

## Features

- Home hero with muted background trailers, hover-to-preview trailers on every poster, Top 10 rows
- Discover with filters (type, years, rating, language, genres, sort), search, genre and people pages
- Movie / TV / person detail pages with cast, videos, where-to-watch, seasons and JSON-LD
- Accounts: watchlist (shareable link), reviews and likes, following people, feed, community chat
- AI recommendations (Groq), Shorts (YouTube)
- Accessible (keyboard, screen readers, reduced motion), responsive down to 360 px, SEO (sitemap, canonical URLs)

## Run locally

Requirements: Node 22+, Docker (for a local Postgres).

```bash
cp .env.example .env.local          # fill TMDB_BEARER (required), JWT_SECRET (≥ 32 chars), DATABASE_URL
docker run -d --name mkmovies-pg -e POSTGRES_USER=mk -e POSTGRES_PASSWORD=mk -e POSTGRES_DB=mkmovies \
  -p 127.0.0.1:5432:5432 postgres:17-alpine
npm ci
npm run dev                         # http://localhost:3000 — migrations run automatically on start
```

Optional: `GROQ_API_KEY` (AI assistant, `GROQ_MODEL` defaults to `openai/gpt-oss-120b`), `YOUTUBE_API_KEY` (Shorts).

## Quality gates

```bash
npm run check        # lint + typecheck + unit/integration tests
npm run qa           # + production build, bundle secret scan, Playwright e2e/security/perf against `next start`
```

See `CLAUDE_REFERENCE/testing.md`.

## Deploy

`./scripts/deploy.sh` ships the committed `HEAD` to the server (build on the box, DB backup, migrations, health and
readiness checks, Caddy, resource report). Runbook: `CLAUDE_REFERENCE/deployment.md`.

## Credits

Movie and TV data and images from [TMDB](https://www.themoviedb.org/) (this product uses the TMDB API but is not
endorsed or certified by TMDB). Streaming availability by JustWatch via TMDB. Trailers from YouTube.
