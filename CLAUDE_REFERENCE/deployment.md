> Referenced from: CLAUDE.md

# Deployment — MovieVerse AI (mkmovies) on OCI `mkb-007`

## Architecture

```
Browser ──HTTPS──> Cloudflare edge (proxied, SSL Full (strict))
                      │  HTTPS, Cloudflare Origin Certificate
                      ▼
          host Caddy :443  (site block "# BEGIN mkmovies"; aborts non-Cloudflare peers)
                      │  http://127.0.0.1:3120
                      ▼
   ┌──────────────── systemd slice mkmovies.slice  (1 GiB RAM, no swap, 1.5 CPU, 512 tasks) ────────────────┐
   │  mkmovies-web  (Next.js standalone, 704m)  ──postgres://…@db:5432──>  mkmovies-db (PostgreSQL 17, 288m) │
   │  networks: default (egress + loopback port) + backend      networks: backend only (internal, no egress) │
   └────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                      │ bind mounts
                      ▼
   /opt/mkmovies  = 5 GiB loop-mounted ext4:  source + .env · pgdata/ · backups/ · cache/next/ · logs/
```

The database runs next to the app. There is no MongoDB/Atlas any more; nothing external stores app data.
Migrations are SQL files in `drizzle/migrations`, shipped in the image at `/app/drizzle/migrations` and applied
by the app at startup (`src/instrumentation.ts`, advisory lock). Health: `/api/health` (liveness, no DB) is the
container healthcheck; `/api/ready` (DB reachable, migrations done) is the deploy readiness gate.

## Box facts

| Item | Value |
|---|---|
| Host | `mkb-007` — 163.192.105.150 (Oracle Cloud, Ubuntu, **arm64**, ext4 root, systemd) |
| SSH | `ubuntu@163.192.105.150`, key `/d/DOWNLOAD/Rizuan-oci-vps/ssh-key-2026-11-11.key` (never print/commit it) |
| Runtime | Docker 29 + compose v2, project `docker compose -p mkmovies`; containers `mkmovies-web`, `mkmovies-db`; image `mkmovies-web:latest` (+ `:previous`) and the shared `postgres:17-alpine` |
| App port | **127.0.0.1:3120** → web :3000 (loopback only). The database has **no host port**. |
| Reverse proxy | Host Caddy, `/etc/caddy/Caddyfile`, marker block `# BEGIN mkmovies` … `# END mkmovies` |
| Edge | **Cloudflare** (orange-cloud proxy, SSL mode **Full (strict)**), DNS managed in Cloudflare |
| App dir | `/opt/mkmovies` — 5 GiB loop-mounted ext4 (`/var/lib/mkmovies/disk.img`, fstab) |
| Maintenance | `/usr/local/lib/mkmovies/{backup,restore,disk-guard}.sh` (root-owned copies), timers `mkmovies-backup.timer`, `mkmovies-disk-guard.timer` |
| Other tenants | scholaris :8090, talenttie :3100, claimperfect :3110/:8110 (+ the tenant that owns `postgres:17-alpine`) — not behind Cloudflare. Do not touch their Caddy blocks, Caddy global options, ufw or global Docker settings. |

Canonical URL `https://www.mkmovies.site`; apex `mkmovies.site` → 301 → www (Caddy).

## Files

| File | Purpose |
|---|---|
| `Dockerfile` | node:22-alpine multi-stage, Next `output: 'standalone'`, non-root uid 1001, migrations at `/app/drizzle/migrations`, HEALTHCHECK `/api/health`. Builds with no secrets. |
| `docker-compose.yml` | `db` + `web`, per-container caps, `cgroup_parent: mkmovies.slice`, read-only rootfs, internal `backend` network, log caps |
| `deploy/Caddyfile.mkmovies` | www + apex site blocks (origin cert, CF-only lock, real-IP headers, static caching, access log into `/opt/mkmovies/logs`) |
| `deploy/cloudflare-ips.caddy` | Cloudflare edge ranges (`@notcf`), installed to `/etc/caddy/mkmovies/cloudflare-ips.caddy` |
| `deploy/systemd/mkmovies.slice` | the shared 1 GiB / 150% CPU / 512 tasks cap |
| `deploy/systemd/mkmovies-backup.{service,timer}` | nightly 03:17 (+≤10 min jitter, `Persistent=true`) `backup.sh` |
| `deploy/systemd/mkmovies-disk-guard.{service,timer}` | `disk-guard.sh` every 15 min (first run 5 min after boot) |
| `scripts/deploy.sh` | full deploy (`--dry-run`, `--no-caddy`) |
| `scripts/setup-storage.sh` | creates/mounts the 5 GiB filesystem (run by deploy.sh with sudo) |
| `scripts/setup-host.sh` | slice, persistent dirs, maintenance scripts + timers (run by deploy.sh with sudo, idempotent) |
| `scripts/backup.sh` | verified `pg_dump -Fc` + retention (`--label`, `--prune-only`, `--list`) |
| `scripts/restore.sh` | restore a dump (`<dump> --yes`) |
| `scripts/disk-guard.sh` | 80 % warn / 90 % prune; Next cache cap (`--status`, `--trim-cache`) |
| `scripts/push-env.sh` | merges secrets from local `.env.production` into the remote `.env` over ssh stdin |
| `scripts/install-origin-cert.sh` | installs the Cloudflare Origin Certificate + key |
| `scripts/update-cloudflare-ips.sh` | refreshes `deploy/cloudflare-ips.caddy` (`--check` to detect drift) |
| `scripts/rollback.sh` | swaps `mkmovies-web:previous` ↔ `:latest`, recreates **web only** |

## Whole-app caps — what is kernel-enforced vs budget-checked

The caps apply to the **whole application** (web + database + backups + logs + cache together).

### RAM: 1 GiB total (kernel-enforced, cgroup v2)

| Layer | Limit | Mechanism |
|---|---|---|
| Whole app | **1 GiB, no swap**, 1.5 CPU, 512 tasks | systemd slice `mkmovies.slice` (`MemoryMax=1G`, `MemorySwapMax=0`, `CPUQuota=150%`, `TasksMax=512`). Both containers join it through compose `cgroup_parent`. deploy.sh verifies afterwards that each container's `/proc/<pid>/cgroup` is under `mkmovies.slice` and fails (exit 7) otherwise. |
| web | 704 MiB (`mem_limit` = `memswap_limit`), 1 CPU, 256 pids | Docker cgroup inside the slice. V8 heap `--max-old-space-size=448`. `/tmp` is a 32 MB tmpfs (RAM, counted here). |
| db | 288 MiB (`mem_limit` = `memswap_limit`), 1 CPU, 128 pids | Docker cgroup inside the slice. `pg_dump`/`pg_restore` run via `docker exec`, i.e. inside this cgroup too. |

Arithmetic (MiB): **web 704 + db 288 = 992 ≤ 1024** → 32 MiB slack. The per-container limits stop one service from
starving the other; the slice is the hard backstop for the sum.

- **web 704** ≈ V8 heap 448 + Node/V8 native, code and JIT ~120 + sockets/buffers ~40 + `/tmp` tmpfs ≤ 32 + margin.
  Next's in-memory data cache lives in the heap; its default is 50 MB — recommended `cacheMaxMemorySize: 32 * 1024 * 1024`
  in `next.config.ts` (there is no env var for it in Next 16). The persistent data cache is on **disk** (below), not RAM.
- **db 288** ≈ `shared_buffers` 64 + `wal_buffers` 4 + background workers/autovacuum ~30 + 20 connections × (~4 base +
  `work_mem` 2) ≈ 120 worst case + `maintenance_work_mem` 32 (one at a time) + tmpfs ≤ 17 + `/dev/shm` (`shm_size: 64m`,
  only for parallel-query DSM). Other settings: `effective_cache_size=160MB`, `max_connections=20`,
  `max_wal_size=256MB`, `min_wal_size=64MB`, `wal_compression=on`, `checkpoint_timeout=15min`,
  `random_page_cost=1.1`, `log_min_duration_statement=500ms`, autovacuum on, `huge_pages=off`.
- OOM: exceeding a container limit OOM-kills only that container → `restart: unless-stopped`. Verified locally: web pushed
  to 800 MB was OOM-killed at 704 MiB and came back healthy; the db stayed up.
- Driver: Ubuntu + Docker 29 default to the **systemd** cgroup driver (`cgroup_parent: mkmovies.slice` → Docker creates
  `docker-<id>.scope` units in the slice). `setup-host.sh` runs `docker info --format '{{.CgroupDriver}}'`; with the
  **cgroupfs** driver it reports `/mkmovies.slice` and deploy.sh writes `MKMOVIES_CGROUP_PARENT=/mkmovies.slice` into `.env`
  (Docker then creates `/sys/fs/cgroup/mkmovies.slice/<id>` below systemd's slice; the limit still applies hierarchically).
  cgroup v1 is refused (no unified memory cap).

### Storage: 5 GiB total (kernel-enforced, loop filesystem)

Everything persistent lives in `/opt/mkmovies`, a fully allocated (`fallocate`) 5 GiB ext4 image, loop-mounted
`nodev,nosuid,noatime,nofail,x-systemd.before=caddy.service`. Writes beyond it fail with ENOSPC — the kernel enforces
the 5 GiB for all app data together. Container root filesystems are `read_only`.

| Item | Path | Budget | Enforced by |
|---|---|---|---|
| Source + `.env` | `/opt/mkmovies/*` | ~3 MB today (≤ 60 MB) | `git archive` of HEAD; no `node_modules` (built in Docker) |
| Database | `pgdata/` (70:70, 0700) | starts < 50 MB; WAL adds up to ~256–320 MB (`max_wal_size`) | grows with data; the rest of the fs is its headroom |
| Backups | `backups/` (root, 0700) | **≤ 1 GiB** total | `backup.sh` retention (below) |
| Next.js data cache | `cache/next/` (1001:1001) → `/app/.next/cache` | **≤ 512 MB** | `disk-guard.sh` trims oldest files to ≤ 384 MB every 15 min and on every deploy |
| Caddy access log | `logs/caddy-access.log` (caddy, 0750) | ≤ 40 MB (10 MiB + 3 gzipped rolls, 14 days) | Caddy `roll_size 10MiB roll_keep 3` |
| Headroom | — | ~3.3 GB | `disk-guard.sh` warns at 80 % (~4 GB), acts at 90 %; deploy.sh refuses to start with < 500 MB free |

### Outside the 5 GiB (budget-checked, not kernel-enforced)

`/var/lib/docker` is on the shared root disk; ext4 has no per-project quota there, so these are **budget-checked only**:

| Item | Budget | How |
|---|---|---|
| `mkmovies-web` image | ≤ 1024 MB (expected ~170–300 MB) × 2 (`:latest` + `:previous`) | deploy.sh fails (exit 4) if a new image is over `MAX_IMAGE_MB` and restores the previous one; other tags, dangling layers and build cache > 7 days are pruned after each build |
| `postgres:17-alpine` | 0 extra (already pulled by another tenant) | reused by tag; never pruned by our scripts; pulled only if missing (deploy warns) |
| Container json logs | ≤ 30 MB per container (10m × 3) | Docker `json-file` options |

## Backups and restore

**What runs:** `mkmovies-backup.timer` → `/usr/local/lib/mkmovies/backup.sh --label nightly` at 03:17 (box time).
deploy.sh also runs `backup.sh --label predeploy` **before** starting a new web image whenever a database already exists
(migrations are forward-only). Files: `/opt/mkmovies/backups/mkmovies-YYYYmmdd-HHMM[-label].dump` (mode 600).

**How:** `docker exec mkmovies-db pg_dump -Fc -Z 6` → `.partial` file → verified (PGDMP header + `pg_restore --list`
over the whole TOC) → renamed. Only after a successful verification is the retention applied:
1. delete dumps older than 7 days, but always keep the newest 2;
2. then delete the oldest until all dumps (nightly + predeploy + prerestore) total ≤ 1 GiB, always keeping the newest.

A free-space guard refuses to dump unless (live DB size + 256 MB) is free, pruning older dumps first if needed, so a
backup can never push Postgres into ENOSPC. Runs are serialized with `flock`.

```bash
sudo /usr/local/lib/mkmovies/backup.sh --list                    # dumps + total vs budget
sudo /usr/local/lib/mkmovies/backup.sh --label manual            # ad-hoc dump
sudo systemctl start mkmovies-backup.service; journalctl -u mkmovies-backup -n 20
systemctl list-timers 'mkmovies-*'
# copy a dump off the box (it contains user data — keep it private):
ssh -i $KEY ubuntu@163.192.105.150 'sudo cat /opt/mkmovies/backups/<file>.dump' > <file>.dump
```

**Restore** (on the box):

```bash
sudo /usr/local/lib/mkmovies/restore.sh /opt/mkmovies/backups/mkmovies-20261125-0317.dump --yes
```

It verifies the dump, takes a `prerestore` safety dump of the current DB, stops `mkmovies-web`, runs
`pg_restore --clean --if-exists --no-owner --no-privileges --single-transaction --exit-on-error` (all-or-nothing: on
error nothing changes), starts web again and waits up to 90 s for `/api/ready`. `--no-safety-backup` skips step 2.

## Disk guard

`mkmovies-disk-guard.timer` runs `/usr/local/lib/mkmovies/disk-guard.sh` every 15 min (journal: `journalctl -u mkmovies-disk-guard`):

| Condition | Action |
|---|---|
| always | Next cache > 512 MB → delete its oldest files until ≤ 384 MB |
| `/opt/mkmovies` not mounted | error in journal (the cap is not in effect) |
| usage ≥ 80 % | warning (priority 4) with a du breakdown; writes `/opt/mkmovies/DISK_WARNING` (removed once below 80 %) |
| usage ≥ 90 % | also prunes dumps to the newest 2, deletes rotated Caddy logs, empties the Next cache |
| still ≥ 90 % after that | error + exit 1 — the live database itself is filling the cap; nothing else is deleted automatically |

It **never** touches `pgdata/`, `.env` or the source. `sudo /usr/local/lib/mkmovies/disk-guard.sh --status` prints usage only.
If the DB really outgrows 5 GiB, the options are a bigger loop image (`SIZE_GIB`, offline resize) — a user decision.

## Caddy log and the loop mount

The mkmovies access log is `/opt/mkmovies/logs/caddy-access.log` (inside the cap). The loop mount is ordered
`x-systemd.before=caddy.service`, and `setup-host.sh` also creates a caddy-owned `logs/` on the **underlying** mount
point (via a non-recursive bind of `/opt`), so if the image ever fails to mount at boot (`nofail`), Caddy still starts
and the other tenants are unaffected. `/opt/mkmovies` is mode 751 (traverse only) so the caddy user can reach `logs/`.

## Cloudflare setup (one-time, by the user)

Done 2026-11-25 (zone active, both A records proxied, Full (strict), origin cert installed). For reference:

1. Cloudflare → **Add a site** `mkmovies.site`; set the two Cloudflare nameservers at GoDaddy.
2. **DNS**: `A @ → 163.192.105.150` and `A www → 163.192.105.150`, both **Proxied**.
3. **SSL/TLS**: mode **Full (strict)**; Edge Certificates: Always Use HTTPS on. Leave Cloudflare HSTS off (the app sends HSTS).
4. **Origin Server → Create Certificate** (`mkmovies.site`, `*.mkmovies.site`, 15 years) → save to two local files outside the repo → `./scripts/install-origin-cert.sh <cert.pem> <key.pem>`.

Caching: `/_next/static/*` is immutable and cached at the edge automatically. HTML and `/api/*` are per-user — **never**
add a "Cache Everything" rule. Images come straight from `image.tmdb.org` / YouTube CDNs. No purge needed after deploys.

Origin lock: each mkmovies site block imports the CF-range snippet and `abort @notcf` first (site scope only). Caddy sets
`X-Real-IP`/`X-Forwarded-For` from `CF-Connecting-IP`. Refresh ranges: `./scripts/update-cloudflare-ips.sh` → commit → deploy.

## First deploy (in order)

```bash
# 0. Locally (Git Bash on Windows or Linux), everything committed — deploy ships HEAD. The DB-port code must be merged
#    (the image must build and /api/ready must check Postgres).
./scripts/deploy.sh --dry-run                    # validates inputs, prints the plan, no network

# 1. Mounts the 5 GiB fs, uploads source, creates /opt/mkmovies/.env with generated JWT_SECRET, POSTGRES_PASSWORD
#    and DATABASE_URL (postgres://mkmovies:<pw>@db:5432/mkmovies), removes any old MONGODB_URI, then STOPS (exit 3)
#    because TMDB_BEARER is empty. Nothing is started yet.
./scripts/deploy.sh

# 2. Put TMDB_BEARER (+ TMDB_API_KEY, GROQ_API_KEY, YOUTUBE_API_KEY — the last two optional) in a local,
#    gitignored .env.production, then:
./scripts/push-env.sh --dry-run                  # shows key NAMES only
./scripts/push-env.sh

# 3. Full run: slice + timers, build web, start db (fresh initdb, no pre-deploy dump on the first run), start web
#    (runs migrations), /api/health + /api/ready, slice check, Caddy block, resource report.
./scripts/deploy.sh
```

Exit 6 = origin certificate missing (already installed on this box). `--no-caddy` skips the Caddy step on purpose.

## Routine deploy

```bash
git commit ...           # deploy ships committed HEAD only
./scripts/deploy.sh      # previous image kept as mkmovies-web:previous; DB dumped (predeploy) before the new web starts
```

Secret change: `./scripts/push-env.sh KEY1 KEY2 --restart` (recreates web only). `POSTGRES_PASSWORD`/`DATABASE_URL` are
not pushed by default — the password is fixed at initdb; changing it needs `ALTER ROLE` in the DB first.

## Rollback

```bash
./scripts/rollback.sh    # :previous -> :latest, recreate web only (db untouched), /api/health + /api/ready
```

**Migrations are forward-only.** If the previous image cannot run against the newer schema (readiness fails),
rollback.sh prints the newest `*-predeploy.dump`; restore it with
`sudo /usr/local/lib/mkmovies/restore.sh /opt/mkmovies/backups/<file>-predeploy.dump --yes` (data written since that
deploy is lost; restore takes a safety dump first). Caddy blocks are backed up as `/etc/caddy/Caddyfile.bak-<stamp>-mkmovies`.

## Logs and status

```bash
ssh -i $KEY ubuntu@163.192.105.150
docker compose -p mkmovies ps
docker logs --tail 200 -f mkmovies-web          # app
docker logs --tail 200 -f mkmovies-db           # Postgres (slow queries > 500 ms are logged)
docker stats --no-stream mkmovies-web mkmovies-db
systemctl status mkmovies.slice                 # Memory: current / max for web + db together
curl -s http://127.0.0.1:3120/api/health; curl -s http://127.0.0.1:3120/api/ready
sudo /usr/local/lib/mkmovies/disk-guard.sh --status
sudo tail -f /opt/mkmovies/logs/caddy-access.log
docker exec -it mkmovies-db psql -U mkmovies -d mkmovies   # local socket inside the container
```

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| deploy exits 3 | Required key empty (`TMDB_BEARER`) → `scripts/push-env.sh`; or `POSTGRES_PASSWORD` missing while `pgdata` exists / `DATABASE_URL` inconsistent → restore the original values. |
| deploy exits 4 | Image > 1 GB budget; previous image restored. Check `.dockerignore` / dependencies. |
| deploy exits 5 | `caddy validate` failed (Caddyfile + snippet restored) or caddy cannot write `/opt/mkmovies/logs`. |
| deploy exits 6 | Origin certificate missing → `scripts/install-origin-cert.sh`. |
| deploy exits 7 | A container is not inside `mkmovies.slice` → check `docker info` cgroup driver and `MKMOVIES_CGROUP_PARENT` in `.env`. |
| deploy exits 8 | < 500 MB free in `/opt/mkmovies` → `backup.sh --list`, prune, check `disk-guard.sh --status`. |
| deploy exits 9 | db not healthy → `docker logs mkmovies-db` (permissions on `pgdata`: must be 70:70 0700). |
| deploy exits 10 | Pre-deploy backup failed → new web NOT started; see the printed `[backup]` error. |
| Readiness fails after deploy | DB unreachable or migration error → `docker logs mkmovies-web`; `scripts/rollback.sh` (+ restore the predeploy dump if the schema changed). |
| `OOMKilled=true` | One container hit its cap (`docker inspect -f '{{.State.OOMKilled}}' mkmovies-web`); check `systemctl status mkmovies.slice`. |
| `DISK_WARNING` file present | ≥ 80 % used; see `journalctl -u mkmovies-disk-guard` for the breakdown. |
| Cloudflare 526 / 521 / 522 | Bad origin cert / Caddy down / CF ranges changed (`update-cloudflare-ips.sh`). |
| `/opt/mkmovies` not mounted after reboot | `sudo mount /opt/mkmovies`; check the fstab line and `journalctl -b | grep mkmovies`. |
| Port 3120 taken | `APP_PORT=… ./scripts/deploy.sh` and update this doc. |
