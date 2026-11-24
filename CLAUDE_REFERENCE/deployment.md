> Referenced from: CLAUDE.md

# Deployment — MovieVerse AI (mkmovies) on OCI `mkb-007`

## Box facts

| Item | Value |
|---|---|
| Host | `mkb-007` — 163.192.105.150 (Oracle Cloud, Ubuntu, **arm64**, ext4 root) |
| SSH | `ubuntu@163.192.105.150`, key `/d/DOWNLOAD/Rizuan-oci-vps/ssh-key-2026-11-11.key` (never print/commit it) |
| Runtime | Docker 29 + compose v2, project `docker compose -p mkmovies`, container `mkmovies-web`, image `mkmovies-web:latest` (+ `:previous`) |
| App port | **127.0.0.1:3120** → container :3000 (loopback only) |
| Reverse proxy | Host Caddy, `/etc/caddy/Caddyfile`, marker block `# BEGIN mkmovies` … `# END mkmovies` |
| Edge | **Cloudflare** (orange-cloud proxy, SSL mode **Full (strict)**), DNS managed in Cloudflare |
| App dir | `/opt/mkmovies` — a 5 GiB loop-mounted ext4 filesystem (`/var/lib/mkmovies/disk.img`) |
| Database | MongoDB Atlas (nothing DB-side on the box) |
| Other tenants | scholaris :8090, talenttie :3100, claimperfect :3110/:8110 — not behind Cloudflare, do not touch their blocks, Caddy global options or ufw |

Canonical URL `https://www.mkmovies.site`; apex `mkmovies.site` → 301 → www (Caddy).

## Files

| File | Purpose |
|---|---|
| `Dockerfile` | node:22-alpine multi-stage, Next `output: 'standalone'`, non-root uid 1001, HEALTHCHECK `/api/health` |
| `docker-compose.yml` | caps (RAM/CPU/pids), read-only rootfs, size-capped tmpfs, log caps, loopback port |
| `deploy/Caddyfile.mkmovies` | www + apex site blocks (origin cert, CF-only lock, real-IP headers, static caching, access log) |
| `deploy/cloudflare-ips.caddy` | Cloudflare edge ranges (`@notcf` matcher), installed to `/etc/caddy/mkmovies/cloudflare-ips.caddy` |
| `scripts/deploy.sh` | full deploy (`--dry-run`, `--no-caddy`) |
| `scripts/setup-storage.sh` | creates/mounts the 5 GiB filesystem (run by deploy.sh with sudo) |
| `scripts/push-env.sh` | merges secrets from local `.env.production` into the remote `.env` over ssh stdin |
| `scripts/install-origin-cert.sh` | installs the Cloudflare Origin Certificate + key |
| `scripts/update-cloudflare-ips.sh` | refreshes `deploy/cloudflare-ips.caddy` (`--check` to detect drift) |
| `scripts/rollback.sh` | swaps `mkmovies-web:previous` ↔ `:latest` and recreates |

## Resource caps — what is hard-enforced vs budget-checked

| Resource | Mechanism | Kind |
|---|---|---|
| RAM 1 GB | `mem_limit: 1g` + `memswap_limit: 1g` (cgroup; no extra swap). OOM-kill → `restart: unless-stopped`. V8 heap capped at 640 MB (`NODE_OPTIONS`) so Node GCs before the cgroup kills it. tmpfs (`/tmp` 64 MB, `.next/cache` 256 MB) is RAM and counts inside the same 1 GB. | **Hard** |
| CPU | `cpus: 1.0`, `pids_limit: 256` | **Hard** |
| App disk 5 GB | `/opt/mkmovies` is its own 5 GiB ext4 filesystem (fully allocated with `fallocate`, loop-mounted `nodev,nosuid,noatime,nofail` from `/etc/fstab`). Source extract, `.env`, any future `data/` or `backups/` can never exceed it — writes fail with ENOSPC instead. | **Hard** |
| Container writes | `read_only: true` rootfs; only the size-capped tmpfs mounts are writable. The container cannot write to the host disk at all. | **Hard** |
| Container logs | json-file `max-size 10m`, `max-file 3` → ≤ 30 MB | **Hard** |
| Caddy access log | `roll_size 10MiB`, `roll_keep 5`, 14 days → ≤ ~60 MB in `/var/log/caddy` | **Hard** (by rotation) |
| Docker image layers | Live in the shared `/var/lib/docker` on the root disk. ext4 has no per-project quota there, so this is **not** inside the 5 GiB filesystem. deploy.sh **fails the deploy if the new image > 1024 MB** (`MAX_IMAGE_MB`) and restores the previous one; only `:latest` + `:previous` are kept; dangling images and build cache older than 7 days are pruned after every build. Expected image size ≈ 250–300 MB. | **Budget-checked** |
| Image optimizer | Disabled by design: custom `next/image` loader (`src/lib/image-loader.ts`) serves TMDB CDN size buckets directly; no sharp, no `.next/cache/images`. | By design |

Worst-case on-disk total for this project: 5 GiB (app fs) + ~2 × 300 MB (images) + 30 MB (logs) + 60 MB (Caddy logs) + transient build cache.

## Cloudflare setup (one-time, by the user)

DNS moves from GoDaddy to Cloudflare; after this, manage records **in Cloudflare, not GoDaddy**.

1. Cloudflare dashboard → **Add a site** → `mkmovies.site` (Free plan is fine). Let it import records, then delete the old Vercel records.
2. At **GoDaddy** → Domain → Nameservers → *Change* → enter the two Cloudflare nameservers shown. Wait until Cloudflare says the site is **Active**.
3. **DNS** (Cloudflare): `A @ → 163.192.105.150` **Proxied** (orange) and `A www → 163.192.105.150` **Proxied**. No AAAA record is needed (Cloudflare serves IPv6 to visitors and talks IPv4 to the origin).
4. **SSL/TLS → Overview**: mode **Full (strict)**.
5. **SSL/TLS → Origin Server → Create Certificate**: RSA 2048 (or ECC), hostnames `mkmovies.site` and `*.mkmovies.site`, validity **15 years**. Save the certificate and the private key into two local files outside the repo (e.g. `D:\secrets\mkmovies-origin.pem` / `.key`). Then run `./scripts/install-origin-cert.sh <cert.pem> <key.pem>`.
6. **SSL/TLS → Edge Certificates**: **Always Use HTTPS** on; Automatic HTTPS Rewrites on. Leave HSTS in Cloudflare off (the app already sends HSTS without `preload`).
7. Optional: the apex → www redirect can be a Cloudflare *Redirect Rule* instead; Caddy already does it, so this is not required.

### Caching guidance for Cloudflare

- `/_next/static/*` is content-hashed and sent with `Cache-Control: public, max-age=31536000, immutable` (Next + Caddy) — Cloudflare caches it automatically at the edge.
- HTML and `/api/*` are dynamic/per-user: by default Cloudflare does **not** cache HTML or JSON, which is correct. **Do not** add a "Cache Everything" rule — it would serve one user's pages/session-dependent API responses to others.
- Images come straight from `image.tmdb.org` / `i.ytimg.com` (their CDNs), not through Cloudflare.
- After a deploy no purge is needed (new builds get new hashed asset URLs).

### Origin lock and real client IP

- Each mkmovies site block imports `/etc/caddy/mkmovies/cloudflare-ips.caddy` (defines `@notcf not remote_ip <CF ranges>`) and runs `abort @notcf` first inside a `route`, so direct-to-origin requests get the connection dropped. This is **site scope only**; Caddy global options and ufw are untouched (other tenants are not behind Cloudflare).
- Caddy sets `X-Real-IP` and `X-Forwarded-For` to `CF-Connecting-IP` for the app — trustworthy only because of the lock. The app's rate limiter reads `X-Real-IP`.
- Cloudflare's ranges change rarely. Refresh: `./scripts/update-cloudflare-ips.sh` → commit `deploy/cloudflare-ips.caddy` → `./scripts/deploy.sh`. Drift check: `./scripts/update-cloudflare-ips.sh --check`.

## MongoDB Atlas

- The cluster must be **running** (free/flex clusters auto-pause when idle; a paused cluster makes the SRV lookup fail with `querySrv ENOTFOUND`).
- Atlas → Network Access: add **163.192.105.150/32** unless the list already allows `0.0.0.0/0`.

## First deploy (in order)

```bash
# 0. Locally, from the repo root (Git Bash on Windows or Linux). Everything must be committed — deploy ships HEAD.
./scripts/deploy.sh --dry-run                    # validates inputs, prints the plan, no network

# 1. Creates the 5 GiB fs, uploads source, creates /opt/mkmovies/.env with a generated JWT_SECRET,
#    then STOPS (exit 3) listing the empty required keys. Nothing is started yet.
./scripts/deploy.sh

# 2. Put the real values in a local, gitignored .env.production (TMDB_BEARER, TMDB_API_KEY,
#    MONGODB_URI, GROQ_API_KEY, YOUTUBE_API_KEY; JWT_SECRET optional — it was generated), then:
./scripts/push-env.sh --dry-run                  # shows key NAMES only
./scripts/push-env.sh

# 3. Cloudflare steps 1–6 above, then install the origin certificate:
./scripts/install-origin-cert.sh /path/origin-cert.pem /path/origin-key.pem

# 4. Build, start, health-check, publish through Caddy:
./scripts/deploy.sh
```

If the certificate is not installed yet, step 4 still builds and starts the app on loopback, then exits 6 before touching Caddy, telling you to run `install-origin-cert.sh`. `--no-caddy` skips the Caddy step on purpose.

## Routine deploy

```bash
git commit ...           # deploy ships committed HEAD only
./scripts/deploy.sh      # previous image is kept as mkmovies-web:previous
```

Secret change only: `./scripts/push-env.sh KEY1 KEY2 --restart`.

## Rollback

```bash
./scripts/rollback.sh    # :previous -> :latest, recreate, health-check (run again to swap back)
```

Only the image is rolled back; `/opt/mkmovies` source and `.env` stay as they are. Caddy blocks are backed up as `/etc/caddy/Caddyfile.bak-<stamp>-mkmovies` on every deploy.

## Logs and status

```bash
ssh -i $KEY ubuntu@163.192.105.150
docker logs --tail 200 -f mkmovies-web
docker stats --no-stream mkmovies-web
docker inspect -f '{{.State.Health.Status}}' mkmovies-web
df -h /opt/mkmovies
sudo tail -f /var/log/caddy/mkmovies.access.log
curl -s http://127.0.0.1:3120/api/health
```

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| deploy exits 3 | Required keys empty in `/opt/mkmovies/.env` → `scripts/push-env.sh`. |
| deploy exits 4 | Image > 1 GB budget; previous image restored. Check `.dockerignore` / dependencies. |
| deploy exits 5 | `caddy validate` failed; Caddyfile + snippet were restored. Read the printed error. |
| deploy exits 6 | Origin certificate missing → `scripts/install-origin-cert.sh`. |
| Cloudflare 526 | Invalid origin cert (expired, wrong host, or SSL mode Full (strict) with a non-origin cert). Reinstall the origin cert. |
| Cloudflare 521/522 | Caddy down or port 443 blocked; or `abort @notcf` hitting because Cloudflare changed ranges → `update-cloudflare-ips.sh`. |
| Direct `curl https://163.192.105.150` gets an empty reply | Expected — origin lock. Test via Cloudflare or `curl 127.0.0.1:3120` on the box. |
| Container restarting, `OOMKilled=true` | Memory spike past 1 GB; check `docker inspect -f '{{.State.OOMKilled}}' mkmovies-web` and recent logs. |
| `querySrv ENOTFOUND` in logs | Atlas cluster paused or IP not allow-listed. |
| Health check fails, Caddy untouched | App crash at boot — `docker logs mkmovies-web`; roll back with `scripts/rollback.sh`. |
| Port 3120 taken | Another service bound it; pick a free port with `APP_PORT=… ./scripts/deploy.sh` and update this doc. |
| `/opt/mkmovies` not mounted after reboot | `sudo mount /opt/mkmovies`; check `/etc/fstab` line and `journalctl -b | grep mkmovies`. |
