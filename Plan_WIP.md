# Plan WIP

## SESSION_CONTEXT_RETRIEVAL
> mkMovies = MovieVerse AI (github.com/KKABIR07/movieverse-ai, Next.js 16 + MongoDB Atlas + TMDB + YouTube + Groq).
> Cloned here 2026-11-25 (commit bc5971c), `.env.local` copied, build + dev OK.
> 2026-11-25: user asked: full visual redesign + full bug scan/fix + tests + deploy to Rizuan OCI box mkb-007
> (163.192.105.150) capped at 1 GB RAM / 5 GB storage, then remove Vercel entirely.
> Domain assumed www.mkmovies.site (www canonical, apex → www) — CONFIRM.
> 2026-11-25: user APPROVED plan + mockup ("Build the website. I will set the DNS."). Domain confirmed www.mkmovies.site.
> Branch `feature/oci-redesign`: Plan_WIP + test tooling committed (repo git identity set to KKABIR07).
> WAVE 1 running in worktrees: backend (Phase 1 + TMDB server-side + /api/health), foundation (tokens, shell,
> primitives, media comps, stores), infra (Docker, caps, Caddy, deploy.sh, next.config, robots).
> NEXT: merge wave 1 → WAVE 2 page agents (P1 browse pages, P2 detail/user pages) → tests/e2e → deploy.
> Dev on this PC needs NODE_OPTIONS=--require=<scratchpad>/dev-dns.cjs (Jio blocks TMDB DNS). JWT_SECRET in
> .env.local is a placeholder — prod gets a generated one. Mockup: https://claude.ai/artifact/25VY1mgzhLi6zz33aikZh8

## Target box (verified read-only 2026-11-25)
- mkb-007, Ubuntu arm64, 4 OCPU / 23 GiB (20 GiB free), 169 GB disk free, ext4. Docker + host Caddy.
- Neighbors: scholaris :8090, talenttie :3100, claimperfect :3110/:8110. **mkmovies → 127.0.0.1:3120** (free).
- Key: `D:\DOWNLOAD\Rizuan-oci-vps\ssh-key-2026-11-11.key`, user ubuntu. Template: `D:\chapter 2 D\job portal_shahbaz` (Dockerfile/compose/deploy.sh/Caddy block).
- DB = MongoDB Atlas (cluster0.7sih1sg, db movieverse) → nothing DB-side on the box.

## Resource caps (how enforced)
- RAM: compose `mem_limit: 1g`, `memswap_limit: 1g`, `cpus: 1.0`, `NODE_OPTIONS=--max-old-space-size=640`.
- Storage 5 GB: `/opt/mkmovies` = a 5 GB ext4 loop image (`/var/lib/mkmovies.img`, fstab) holding source + .env;
  container `read_only` with size-capped tmpfs (`/tmp` 64m, `.next/cache` 256m); json logs 3×10 MB;
  image built from `output: standalone` (target < 400 MB); deploy fails if image > 1 GB. Note: Docker image
  layers live in /var/lib/docker (no per-project quota on ext4) — capped by the budget check, not the kernel.

## Phase 0 — Setup
- [ ] 0.1 Branch `feature/oci-redesign`; add vitest + Playwright (dev deps) — approval needed for new deps.

## Phase 1 — Security & API fixes (backend audit)
- [ ] 1.1 TMDB server-only: `TMDB_BEARER` (no NEXT_PUBLIC); server fetch with `revalidate`; drop axios. USER: rotate TMDB token after.
- [ ] 1.2 `src/proxy.ts` for /api/*: per-IP token bucket + 64 KB body cap + JSON/Origin check.
- [ ] 1.3 zod validation + shared `withHandler` (JSON errors, Cast/Validation→400, 11000→409, logging) on all 11 routes.
- [ ] 1.4 AI route: role whitelist, length caps, lazy Groq client, 429/502 mapping; `groq-sdk` → dependencies.
- [ ] 1.5 YouTube: rate limit, param validation, no quota-burning key check, Mongo-backed cache.
- [ ] 1.6 Auth: JWT secret fail-fast (≥32 chars), HS256 pinned, tokenVersion revocation, 7d expiry, cookie flags on clear, bcrypt cost 11, timing-safe login.
- [ ] 1.7 Watchlist/reviews/chat/follows: field whitelists, caps, unique review per user, chat TTL, no userId leaks; fix mediaType mismatch.
- [ ] 1.8 Mongo: lazy URI check, listeners, maxPoolSize 5, remove duplicate indexes.

## Phase 2 — Architecture / SEO / performance
- [ ] 2.1 Content pages → Server Components + client islands (movie/tv/person/genre/trending/movies/tv/top-rated/stars/discover/home); `generateMetadata`, `notFound()`, JSON-LD.
- [ ] 2.2 `SITE_URL` env, `metadataBase`, remove hard-coded mkmovies.site; `robots.ts`; real sitemap (top movie/TV/person); noindex private pages.
- [ ] 2.3 `output: standalone`; TMDB image loader (no server-side sharp work); security headers; `poweredByHeader: false`; http→https left to Caddy.
- [ ] 2.4 Error/loading/not-found boundaries; drop WebGL hero + eager iframes (lite-YouTube facade); remove unused deps (framer-motion/gsap/three if unused after redesign).

## Phase 3 — Full visual redesign (mockup approval FIRST)
- [ ] 3.1 Mockup (home + detail, desktop + mobile) → user approval.
- [ ] 3.2 Design tokens in Tailwind 4 `@theme` (surfaces, fg, accent, type scale, radii, motion), Geist actually applied, AA contrast.
- [ ] 3.3 Shared primitives: Button, IconButton, Chip/ToggleGroup, SectionHeader, Pagination, PageHeader, Dialog (focus trap), MediaCard, Rail.
- [ ] 3.4 New shell: top nav + mobile bottom tab bar, ⌘K search palette; filters move into Discover (no permanent sidebar).
- [ ] 3.5 Restyle every page (home, browse lists, detail, person, search, discover, shorts, watchlist, profile, about, blog).
- [ ] 3.6 Honest data: remove fake RT/Metacritic/follower numbers & unverified stats.

## Phase 4 — Frontend bug fixes (frontend audit + crawl)
- [ ] 4.1 Zustand hydration mismatch (skipHydration + rehydrate), clear user data on logout.
- [ ] 4.2 Watchlist key `${media_type}:${id}`; share link unicode-safe + validated.
- [ ] 4.3 Search (URL sync, TV discover, years to current), Discover (all filters, page reset).
- [ ] 4.4 UTC date formatting; HorizontalScroll Link; shorts (mute restart, key hijack, z-index, labels).
- [ ] 4.5 Chat actually shared (fetch from API) or removed; store selectors; reduced-motion; a11y labels/dialogs.
- [ ] 4.6 Crawl-specific bugs (see Notes).

## Phase 5 — Tests (all green before deploy)
- [ ] 5.1 Unit (vitest): validators, auth helpers, rate limiter, formatters, watchlist store.
- [ ] 5.2 Integration: route handlers against a test DB (Atlas test db `movieverse_test`).
- [ ] 5.3 E2E (Playwright): crawl all routes desktop+mobile (0 console errors, 0 5xx, no overflow), auth + watchlist + review + AI flows.
- [ ] 5.4 Security: auth bypass/IDOR/injection/rate-limit cases; `npm audit` high/critical = 0.
- [ ] 5.5 lint + tsc + build clean; Lighthouse on home + detail.

## Phase 6 — Deploy to mkb-007
- [ ] 6.1 Dockerfile, docker-compose.yml, .dockerignore, .env.example, deploy/Caddyfile.mkmovies, scripts/deploy.sh (talenttie pattern + 5 GB loop mount + image budget).
- [ ] 6.2 First deploy (port 3120), health check, memory under load.
- [ ] 6.3 USER: Cloudflare A `www` + `@` → 163.192.105.150 (DNS-only). Caddy issues LE cert. Verify HTTPS, redirects, headers.
- [ ] 6.4 Post-deploy crawl against the live domain.

## Phase 7 — Cutover & docs
- [ ] 7.1 Remove Vercel project (CONFIRM first; only after 6.4 passes).
- [ ] 7.2 Real README, CLAUDE.md, CLAUDE_REFERENCE/deployment.md; update Rizuan-oci-vps/Plan_WIP.md tenant list.
- [ ] 7.3 PR → main.

## Completed
- [x] Clone repo into `D:\chapter 2 D\mkMovies` (2026-11-25)
- [x] Copy `.env.local`, install deps, build + dev server verified (2026-11-25)
- [x] Backend + frontend audits (2026-11-25)

## Cloudflare (user request 2026-11-25)
- Site goes Cloudflare (proxied) → Caddy (CF Origin cert, Full strict, origin locked to CF IPs at site scope) → app :3120.
- GoDaddy DNS state 2026-11-25: A @ and A www → 163.192.105.150 (published). Vercel project already DEPLOYMENT_DISABLED (402).
- [x] USER: zone added (NS paul/sneh.ns.cloudflare.com set at GoDaddy), both A records proxied, SSL Full (strict),
      Universal edge cert active (2027-02-23). (2026-11-25)
- [x] Origin cert (CF Origin CA, *.mkmovies.site + apex, to 2041-11-20) saved D:\DOWNLOAD\mkmovies-origin\ and
      installed on box /etc/caddy/certs/mkmovies.site.{pem,key}; neighbours erp/talenttie/claimperfect still OK. (2026-11-25)
- [ ] Origin private key was pasted into chat → recommend revoke + regenerate (save to files only) + rerun install script.
- [ ] Caddy block goes in with the first ./scripts/deploy.sh.

## DB switch (user decision 2026-11-25): MongoDB/Atlas DROPPED → local PostgreSQL 17 on the box
- Caps are for the WHOLE app: 5 GB storage (app + pgdata + backups + logs, all inside the /opt/mkmovies loop fs)
  and 1 GB RAM (web 704m + db 288m inside systemd slice mkmovies.slice MemoryMax=1G). Fresh DB, no data migration.
- Deps: drizzle-orm + pg (+ drizzle-kit, @types/pg, PGlite for tests); mongoose + mongodb-memory-server removed (a398618).
- [ ] DB-port agent: schema, migrations (drizzle/migrations, run in instrumentation.ts), all routes, PGlite tests.
- [ ] Infra agent: db service, slice, backups (≤1 GB, nightly + pre-deploy), disk guard, docs.
- Atlas blockers below are OBSOLETE.

## Blockers / Notes
- BLOCKER (2026-11-25 crawl): Atlas SRV `_mongodb._tcp.cluster0.7sih1sg.mongodb.net` = NXDOMAIN (local + 8.8.8.8) →
  cluster paused or deleted → signup/login/reviews/follows all 500. USER must resume it (or give a new URI).
- Jio DNS sinkholes `api.themoviedb.org` (→ 49.44.79.236); image.tmdb.org is fine. Browser-side TMDB calls fail for
  Jio users → Phase 2.1 (server-side TMDB) fixes it for visitors too. Local dev: set Windows DNS to 1.1.1.1/8.8.8.8.
- Crawl extras: detail pages retry 3×10s (40 s skeleton) and say "not found" on network error; /robots.txt 404;
  /genre/<id> H1 "Genre" without TMDB (use static genre map); header overlaps "Trending" heading when hero empty;
  /api/reviews + /api/follows/counts 500 with empty body. Screenshots: scratchpad\crawl\.
- Domain mkmovies.site: registrar GoDaddy (reg. 2026-06-14 21:03:48 UTC, expires 2027-06-14), NS domaincontrol.com.
  FOUND 2026-11-25: GoDaddy customer # 723767748 (Masum Biswas, kabirbiswas131@gmail.com), order 4099065410,
  paid ₹127.91. Auto-renews 14-06-2027 for ₹5,237.14 + tax. Log in with the customer # (not the email) — the
  email also has a second, empty GoDaddy account. Needed for the DNS cutover step (6.3).
- `.env.local` is gitignored — never commit it.
- Domain name to confirm (assumed www.mkmovies.site).
- TMDB token has been public in the bundle → rotate after 1.1 ships.
