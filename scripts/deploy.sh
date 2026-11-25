#!/usr/bin/env bash
# Deploy MovieVerse AI (mkmovies) to the OCI box mkb-007 (Docker: web + PostgreSQL, host Caddy).
#
#   ./scripts/deploy.sh             # ship committed HEAD, build on the box, back up the DB, start, Caddy, checks
#   ./scripts/deploy.sh --no-caddy  # skip the Caddy site-block update
#   ./scripts/deploy.sh --dry-run   # validate local inputs and print the plan; never connects
#
# Env overrides: DEPLOY_HOST, DEPLOY_USER, DEPLOY_KEY, APP_DIR, APP_PORT, MAX_IMAGE_MB, MIN_FREE_MB.
# Idempotent. Preserves the remote .env (created from .env.example on the first run with generated
# JWT_SECRET, POSTGRES_PASSWORD and DATABASE_URL), pgdata/, backups/, logs/ and cache/. Refuses to start while
# required keys are empty — fill external API keys with scripts/push-env.sh. Ships `git archive HEAD`,
# so uncommitted changes are NOT deployed. Works from Git Bash on Windows and from Linux/macOS.
set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:-163.192.105.150}"
DEPLOY_USER="${DEPLOY_USER:-ubuntu}"
DEPLOY_KEY="${DEPLOY_KEY:-/d/DOWNLOAD/Rizuan-oci-vps/ssh-key-2026-11-11.key}"
APP_DIR="${APP_DIR:-/opt/mkmovies}"
APP_PORT="${APP_PORT:-3120}"
MAX_IMAGE_MB="${MAX_IMAGE_MB:-1024}"
MIN_FREE_MB="${MIN_FREE_MB:-500}"
READY_TIMEOUT="${READY_TIMEOUT:-90}"
PROJECT=mkmovies
CONTAINER=mkmovies-web
DB_CONTAINER=mkmovies-db
IMAGE=mkmovies-web
PG_IMAGE=postgres:17-alpine
REQUIRED_KEYS="TMDB_BEARER JWT_SECRET POSTGRES_PASSWORD DATABASE_URL"
OPTIONAL_KEYS="GROQ_API_KEY YOUTUBE_API_KEY"
LIB_DIR=/usr/local/lib/mkmovies
ORIGIN_CERT=/etc/caddy/certs/mkmovies.site.pem
ORIGIN_KEY=/etc/caddy/certs/mkmovies.site.key
CF_SNIPPET=/etc/caddy/mkmovies/cloudflare-ips.caddy

DO_CADDY=1
DRY_RUN=0
usage() { sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; }
for arg in "$@"; do
  case "$arg" in
    --no-caddy) DO_CADDY=0 ;;
    --dry-run) DRY_RUN=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $arg" >&2; usage >&2; exit 2 ;;
  esac
done

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
log() { printf '\n==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------- local validation (no network)
log "Validate inputs"
[[ "$APP_PORT" =~ ^[0-9]+$ ]] && (( APP_PORT >= 1024 && APP_PORT <= 65535 )) || die "APP_PORT must be 1024-65535 (got '$APP_PORT')"
for n in MAX_IMAGE_MB MIN_FREE_MB READY_TIMEOUT; do [[ "${!n}" =~ ^[0-9]+$ ]] || die "$n must be an integer"; done
[[ "$DEPLOY_HOST" =~ ^[A-Za-z0-9.-]+$ ]] || die "DEPLOY_HOST looks invalid: '$DEPLOY_HOST'"
[[ "$DEPLOY_USER" =~ ^[a-z_][a-z0-9_-]*$ ]] || die "DEPLOY_USER looks invalid: '$DEPLOY_USER'"
[[ "$APP_DIR" =~ ^/[A-Za-z0-9/_.-]+$ && "$APP_DIR" != "/" ]] || die "APP_DIR must be an absolute path without spaces (got '$APP_DIR')"
[[ -f "$DEPLOY_KEY" ]] || die "SSH key not found: $DEPLOY_KEY"
for bin in git ssh scp sed; do command -v "$bin" >/dev/null || die "missing local tool: $bin"; done
cd "$ROOT"
git rev-parse --verify -q HEAD >/dev/null || die "not a git repository with commits: $ROOT"
for f in Dockerfile docker-compose.yml .env.example deploy/Caddyfile.mkmovies deploy/cloudflare-ips.caddy \
         deploy/systemd/mkmovies.slice deploy/systemd/mkmovies-backup.service deploy/systemd/mkmovies-backup.timer \
         deploy/systemd/mkmovies-disk-guard.service deploy/systemd/mkmovies-disk-guard.timer \
         scripts/setup-storage.sh scripts/setup-host.sh scripts/backup.sh scripts/restore.sh scripts/disk-guard.sh; do
  git cat-file -e "HEAD:$f" 2>/dev/null || die "$f is not committed at HEAD (deploy ships HEAD only)"
done
for k in $REQUIRED_KEYS $OPTIONAL_KEYS POSTGRES_USER POSTGRES_DB; do
  grep -q "^$k=" .env.example || die ".env.example is missing key $k"
done
grep -q '^MONGODB_URI=' .env.example && die ".env.example still has MONGODB_URI (MongoDB was removed)"
REV="$(git rev-parse --short HEAD)"
if [[ -n "$(git status --porcelain)" ]]; then
  echo "WARNING: uncommitted changes are not deployed (shipping HEAD $REV)." >&2
fi
CADDY_BLOCK="$(sed -e "s/__APP_PORT__/$APP_PORT/g" -e "s|__CF_SNIPPET__|$CF_SNIPPET|g" -e "s|__APP_DIR__|$APP_DIR|g" deploy/Caddyfile.mkmovies)"
grep -qE '__(APP_PORT|CF_SNIPPET|APP_DIR)__' <<<"$CADDY_BLOCK" && die "Caddy template still has placeholders"
echo "OK: host=$DEPLOY_USER@$DEPLOY_HOST dir=$APP_DIR port=127.0.0.1:$APP_PORT rev=$REV caddy=$DO_CADDY max_image=${MAX_IMAGE_MB}MB min_free=${MIN_FREE_MB}MB"

if [[ $DRY_RUN -eq 1 ]]; then
  log "Dry run — plan (nothing was contacted)"
  cat <<PLAN
  1. ssh $DEPLOY_USER@$DEPLOY_HOST hostname                (connectivity)
  2. port $APP_PORT free, or already held by $CONTAINER
  3. sudo setup-storage.sh -> 5 GiB loop-mounted ext4 at $APP_DIR (source, .env, pgdata, backups, logs, cache)
  4. disk budget: print du of app/pgdata/backups/logs/cache; FAIL if < ${MIN_FREE_MB} MB free in $APP_DIR
  5. git archive $REV -> extract into $APP_DIR (keeps .env, pgdata/, backups/, logs/, cache/)
  6. first run: .env from .env.example + generated JWT_SECRET, POSTGRES_PASSWORD, DATABASE_URL
     (postgres://mkmovies:<pw>@db:5432/mkmovies); stop (exit 3) while TMDB_BEARER is empty;
     warn if GROQ_API_KEY / YOUTUBE_API_KEY are empty; drop any stale MONGODB_URI
  7. sudo setup-host.sh -> mkmovies.slice (1G RAM, no swap, 150% CPU, 512 tasks), pgdata/backups/logs/cache dirs,
     $LIB_DIR/{backup,restore,disk-guard}.sh, mkmovies-backup.timer (nightly) + mkmovies-disk-guard.timer (15 min)
  8. $PG_IMAGE present (shared with another tenant; pulled only if missing)
  9. tag $IMAGE:latest -> $IMAGE:previous, docker compose -p $PROJECT build web; image <= ${MAX_IMAGE_MB} MB
 10. up -d db (healthy); if a database already existed: pre-deploy backup ($LIB_DIR/backup.sh --label predeploy)
 11. trim Next.js cache to <= 512 MB; up -d web; prune dangling images + old build cache (postgres untouched)
 12. health http://127.0.0.1:$APP_PORT/api/health, then readiness /api/ready (DB + migrations) within ${READY_TIMEOUT}s
 13. verify both containers run inside mkmovies.slice; slice MemoryMax = 1 GiB
 14. require origin cert $ORIGIN_CERT + key; upload CF-IP snippet -> $CF_SNIPPET
 15. Caddy block (marker-managed, validated, rolled back on failure; access log -> $APP_DIR/logs):
PLAN
  [[ $DO_CADDY -eq 1 ]] && sed 's/^/       | /' <<<"$CADDY_BLOCK" || echo "       (skipped: --no-caddy)"
  echo " 16. docker stats (web + db); slice memory; df -h $APP_DIR; du of each budget item"
  exit 0
fi

SSH=(ssh -i "$DEPLOY_KEY" -o BatchMode=yes -o ConnectTimeout=20 -o StrictHostKeyChecking=accept-new "$DEPLOY_USER@$DEPLOY_HOST")
SCP=(scp -i "$DEPLOY_KEY" -o BatchMode=yes -o ConnectTimeout=20 -o StrictHostKeyChecking=accept-new)
REMOTE_ENV="APP_DIR=$APP_DIR APP_PORT=$APP_PORT PROJECT=$PROJECT CONTAINER=$CONTAINER DB_CONTAINER=$DB_CONTAINER IMAGE=$IMAGE PG_IMAGE=$PG_IMAGE MAX_IMAGE_MB=$MAX_IMAGE_MB MIN_FREE_MB=$MIN_FREE_MB READY_TIMEOUT=$READY_TIMEOUT DEPLOY_USER=$DEPLOY_USER LIB_DIR=$LIB_DIR"

# ---------------------------------------------------------------- remote
log "Connectivity"
"${SSH[@]}" hostname

log "Port check ($APP_PORT must be free or already ours)"
"${SSH[@]}" "$REMOTE_ENV bash -s" <<'EOF'
set -euo pipefail
if sudo ss -Htln "sport = :$APP_PORT" | grep -q . && ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "Port $APP_PORT is taken by another service:" >&2
  sudo ss -Htlnp "sport = :$APP_PORT" >&2
  exit 1
fi
echo "port $APP_PORT OK"
EOF

log "Storage cap (5 GiB loop filesystem at $APP_DIR)"
"${SCP[@]}" scripts/setup-storage.sh "$DEPLOY_USER@$DEPLOY_HOST:/tmp/mkmovies-setup-storage.sh"
"${SSH[@]}" "sudo MNT=$APP_DIR bash /tmp/mkmovies-setup-storage.sh $DEPLOY_USER && rm -f /tmp/mkmovies-setup-storage.sh"

log "Disk budget (everything below shares the 5 GiB filesystem)"
"${SSH[@]}" "$REMOTE_ENV bash -s" <<'EOF'
set -euo pipefail
cd "$APP_DIR"
sz() { sudo du -sh "$@" 2>/dev/null | awk '{print $1}' | head -1; }
app="$(sudo du -sh --exclude=./pgdata --exclude=./backups --exclude=./logs --exclude=./cache --exclude=./lost+found . 2>/dev/null | awk '{print $1}')"
printf '  app(source+.env)=%s  pgdata=%s  backups=%s  logs=%s\n' "${app:-0}" "$(sz pgdata || true)" "$(sz backups || true)" "$(sz logs || true)"
df -h "$APP_DIR" | sed 's/^/  /'
avail_mb=$(( $(df --output=avail -k "$APP_DIR" | tail -1 | tr -d ' ') / 1024 ))
if [ "$avail_mb" -lt "$MIN_FREE_MB" ]; then
  echo "Only ${avail_mb} MB free in $APP_DIR (< ${MIN_FREE_MB} MB) — deploy stopped before changing anything." >&2
  echo "Free space: sudo $LIB_DIR/backup.sh --list ; prune with MAX_TOTAL_MB=<n> sudo -E $LIB_DIR/backup.sh --prune-only" >&2
  exit 8
fi
echo "  free ${avail_mb} MB (minimum ${MIN_FREE_MB} MB) OK"
EOF

log "Upload source (git archive $REV)"
TARBALL="$(mktemp -t mkmovies.XXXXXX)"
trap 'rm -f "$TARBALL"' EXIT
git archive --format=tar.gz -o "$TARBALL" HEAD
"${SCP[@]}" "$TARBALL" "$DEPLOY_USER@$DEPLOY_HOST:/tmp/mkmovies.tar.gz"

log "Extract (keep .env + data), check secrets"
set +e
"${SSH[@]}" "$REMOTE_ENV bash -s" <<'EOF'
set -euo pipefail
cd "$APP_DIR"
# Wipe old source but keep secrets, all persistent data and the ext4 lost+found.
find . -mindepth 1 -maxdepth 1 ! -name .env ! -name data ! -name pgdata ! -name backups ! -name logs \
  ! -name cache ! -name lost+found ! -name DISK_WARNING -exec rm -rf {} +
tar -xzf /tmp/mkmovies.tar.gz -C "$APP_DIR" && rm -f /tmp/mkmovies.tar.gz

getkey() { grep -m1 "^$1=" .env | cut -d= -f2- || true; }
setkey() { # setkey KEY VALUE  — replace or append without sed-escaping problems
  K="$1" V="$2" awk 'BEGIN{k=ENVIRON["K"]; v=ENVIRON["V"]; d=0} index($0, k"=")==1 {if(!d) print k"="v; d=1; next} {print} END{if(!d) print k"="v}' .env > .env.tmp
  cat .env.tmp > .env && rm -f .env.tmp
}
delkey() { K="$1" awk 'BEGIN{k=ENVIRON["K"]} index($0, k"=")!=1' .env > .env.tmp && cat .env.tmp > .env && rm -f .env.tmp; }
umask 077
if [ ! -f .env ]; then
  cp .env.example .env
  setkey JWT_SECRET "$(openssl rand -hex 48)"
  echo "Created .env from .env.example with a generated JWT_SECRET."
fi
chmod 600 .env
setkey APP_PORT "$APP_PORT"
if grep -q '^MONGODB_URI=' .env; then delkey MONGODB_URI; echo "Removed obsolete MONGODB_URI from .env."; fi
[ -n "$(getkey POSTGRES_USER)" ] || setkey POSTGRES_USER mkmovies
[ -n "$(getkey POSTGRES_DB)" ] || setkey POSTGRES_DB mkmovies
[ -n "$(getkey JWT_SECRET)" ] || { setkey JWT_SECRET "$(openssl rand -hex 48)"; echo "Generated JWT_SECRET."; }

# POSTGRES_PASSWORD is baked into pgdata at initdb time: generate it only while no cluster exists yet.
pg_user="$(getkey POSTGRES_USER)"; pg_db="$(getkey POSTGRES_DB)"
if [ -z "$(getkey POSTGRES_PASSWORD)" ]; then
  if sudo test -f pgdata/PG_VERSION; then
    echo "POSTGRES_PASSWORD is empty but $APP_DIR/pgdata already holds a cluster — restore the original" >&2
    echo "password into .env (scripts/push-env.sh POSTGRES_PASSWORD DATABASE_URL). Not generating a new one." >&2
    exit 3
  fi
  setkey POSTGRES_PASSWORD "$(openssl rand -hex 24)"
  echo "Generated POSTGRES_PASSWORD."
fi
pg_pw="$(getkey POSTGRES_PASSWORD)"
expected_url="postgres://$pg_user:$pg_pw@db:5432/$pg_db"
if [ -z "$(getkey DATABASE_URL)" ]; then
  setkey DATABASE_URL "$expected_url"
  echo "Composed DATABASE_URL (host db, user $pg_user, db $pg_db)."
fi
case "$(getkey DATABASE_URL)" in
  "postgres://$pg_user:$pg_pw@db:5432/"*|"postgresql://$pg_user:$pg_pw@db:5432/"*) ;;
  *) echo "DATABASE_URL does not match POSTGRES_USER/POSTGRES_PASSWORD @db:5432 — fix .env." >&2; exit 3 ;;
esac

missing=""
for k in TMDB_BEARER JWT_SECRET POSTGRES_PASSWORD DATABASE_URL; do
  [ -n "$(getkey "$k")" ] || missing="$missing $k"
done
jwt="$(getkey JWT_SECRET)"
if [ -n "$jwt" ] && [ "${#jwt}" -lt 32 ]; then missing="$missing JWT_SECRET(<32 chars)"; fi
for k in GROQ_API_KEY YOUTUBE_API_KEY; do
  [ -n "$(getkey "$k")" ] || echo "WARNING: optional $k is empty — that feature stays disabled." >&2
done
if [ -n "$missing" ]; then
  echo "Required keys still empty in $APP_DIR/.env:$missing" >&2
  echo "Fill them with: scripts/push-env.sh  (then re-run deploy). App NOT started." >&2
  exit 3
fi
echo "All required keys present."
EOF
rc=$?
set -e
[[ $rc -eq 0 ]] || exit "$rc"

log "Host integration (slice, dirs, backup + disk-guard timers)"
HOST_OUT="$("${SSH[@]}" "sudo APP_DIR=$APP_DIR SRC_DIR=$APP_DIR bash $APP_DIR/scripts/setup-host.sh $DEPLOY_USER")"
printf '%s\n' "$HOST_OUT"
CGROUP_PARENT="$(printf '%s\n' "$HOST_OUT" | sed -n 's/^CGROUP_PARENT=//p' | tail -1)"
[[ "$CGROUP_PARENT" =~ ^/?mkmovies\.slice$ ]] || die "setup-host.sh did not report a valid CGROUP_PARENT"
# Empty = compose default "mkmovies.slice" (systemd driver); "/mkmovies.slice" for the cgroupfs driver.
CG_VALUE=""
[[ "$CGROUP_PARENT" == "mkmovies.slice" ]] || CG_VALUE="$CGROUP_PARENT"

log "Build web image (outgoing image kept as $IMAGE:previous), back up the DB, start"
"${SSH[@]}" "$REMOTE_ENV CG_VALUE=$CG_VALUE bash -s" <<'EOF'
set -euo pipefail
cd "$APP_DIR"
K=MKMOVIES_CGROUP_PARENT V="$CG_VALUE" awk 'BEGIN{k=ENVIRON["K"]; v=ENVIRON["V"]; d=0} index($0, k"=")==1 {if(!d) print k"="v; d=1; next} {print} END{if(!d) print k"="v}' .env > .env.tmp
cat .env.tmp > .env && rm -f .env.tmp
DC="docker compose -p $PROJECT --env-file .env"

if ! docker image inspect "$PG_IMAGE" >/dev/null 2>&1; then
  echo "WARNING: $PG_IMAGE is not on the box (expected: shared with another tenant) — pulling it (~110 MB)." >&2
  docker pull -q "$PG_IMAGE"
fi

if docker image inspect "$IMAGE:latest" >/dev/null 2>&1; then
  docker tag "$IMAGE:latest" "$IMAGE:previous"
fi
$DC build --pull web

bytes="$(docker image inspect -f '{{.Size}}' "$IMAGE:latest")"
mb=$(( bytes / 1024 / 1024 ))
echo "image $IMAGE:latest = ${mb} MB (budget ${MAX_IMAGE_MB} MB)"
if [ "$mb" -gt "$MAX_IMAGE_MB" ]; then
  echo "Image exceeds the ${MAX_IMAGE_MB} MB budget — not starting it." >&2
  if docker image inspect "$IMAGE:previous" >/dev/null 2>&1; then
    docker tag "$IMAGE:latest" "$IMAGE:oversize" && docker tag "$IMAGE:previous" "$IMAGE:latest"
    echo "Restored the previous image as :latest (oversize build kept as :oversize for inspection)." >&2
  fi
  exit 4
fi

had_db=0
if sudo test -f pgdata/PG_VERSION; then had_db=1; fi
$DC up -d --no-build db
for _ in $(seq 1 30); do
  [ "$(docker inspect -f '{{.State.Health.Status}}' "$DB_CONTAINER" 2>/dev/null)" = healthy ] && break
  sleep 3
done
if [ "$(docker inspect -f '{{.State.Health.Status}}' "$DB_CONTAINER" 2>/dev/null)" != healthy ]; then
  echo "Database container did not become healthy:" >&2
  docker logs --tail 60 "$DB_CONTAINER" >&2 || true
  exit 9
fi
echo "db healthy"

# Migrations are forward-only: snapshot the existing database before a new web image can migrate it.
if [ "$had_db" = 1 ]; then
  echo "pre-deploy backup:"
  sudo "$LIB_DIR/backup.sh" --label predeploy || { echo "Pre-deploy backup FAILED — the new web image was NOT started." >&2; exit 10; }
else
  echo "fresh database (first deploy) — no pre-deploy backup needed"
fi

# Next.js data cache (bind mount on the 5 GiB fs) is capped at 512 MB: trim oldest files if over.
sudo "$LIB_DIR/disk-guard.sh" --trim-cache

$DC up -d --no-build --remove-orphans

# Disk hygiene for the shared /var/lib/docker: only latest + previous of OUR image survive.
# (Only $IMAGE tags and dangling layers are touched — the shared postgres image is never removed.)
docker images "$IMAGE" --format '{{.Repository}}:{{.Tag}}' | grep -vE ":(latest|previous)$" | grep -v ':<none>$' | xargs -r docker rmi >/dev/null 2>&1 || true
docker image prune -f >/dev/null
docker builder prune -f --filter until=168h >/dev/null 2>&1 || true
EOF

log "Health (liveness /api/health, then readiness /api/ready incl. DB + migrations)"
healthy=0
for _ in $(seq 1 40); do
  if "${SSH[@]}" "curl -fsS -o /dev/null http://127.0.0.1:$APP_PORT/api/health"; then healthy=1; break; fi
  sleep 3
done
if [[ $healthy -ne 1 ]]; then
  echo "Health check FAILED — Caddy was NOT touched. Logs (roll back with scripts/rollback.sh):" >&2
  "${SSH[@]}" "docker logs --tail 80 $CONTAINER" >&2 || true
  exit 1
fi
echo "healthy: http://127.0.0.1:$APP_PORT/api/health"
if ! "${SSH[@]}" "deadline=\$(( \$(date +%s) + $READY_TIMEOUT )); while [ \$(date +%s) -lt \$deadline ]; do curl -fsS -o /dev/null --max-time 5 http://127.0.0.1:$APP_PORT/api/ready && exit 0; sleep 3; done; exit 1"; then
  echo "Readiness FAILED within ${READY_TIMEOUT}s (/api/ready != 200: DB unreachable or migration error). Caddy NOT touched." >&2
  "${SSH[@]}" "curl -sS --max-time 5 http://127.0.0.1:$APP_PORT/api/ready; echo; docker logs --tail 80 $CONTAINER" >&2 || true
  echo "Roll back: scripts/rollback.sh (web image). If the schema changed, also restore the pre-deploy dump." >&2
  exit 1
fi
echo "ready: http://127.0.0.1:$APP_PORT/api/ready"

log "Verify the shared 1 GiB cap (both containers inside mkmovies.slice)"
"${SSH[@]}" "CONTAINER=$CONTAINER DB_CONTAINER=$DB_CONTAINER bash -s" <<'EOF'
set -euo pipefail
for c in "$CONTAINER" "$DB_CONTAINER"; do
  pid="$(docker inspect -f '{{.State.Pid}}' "$c")"
  cg="$(cut -d: -f3- "/proc/$pid/cgroup" | head -1)"
  case "$cg" in
    */mkmovies.slice/*) echo "  $c -> $cg" ;;
    *) echo "  $c is NOT inside mkmovies.slice ($cg) — the shared RAM cap is not enforced" >&2; exit 7 ;;
  esac
done
echo "  mkmovies.slice MemoryMax=$(systemctl show -P MemoryMax mkmovies.slice) MemoryCurrent=$(systemctl show -P MemoryCurrent mkmovies.slice)"
EOF

if [[ $DO_CADDY -eq 1 ]]; then
  log "Caddy site block (Cloudflare origin cert, CF-only lock; validated, rolled back on failure)"
  # Refuse to wire the public site until the Cloudflare Origin Certificate is installed.
  if ! "${SSH[@]}" "sudo test -s $ORIGIN_CERT && sudo test -s $ORIGIN_KEY"; then
    echo "Cloudflare origin certificate not found on the box ($ORIGIN_CERT / $ORIGIN_KEY)." >&2
    echo "Run: ./scripts/install-origin-cert.sh <origin-cert.pem> <origin-key.pem>   then re-run deploy." >&2
    echo "The app IS running on 127.0.0.1:$APP_PORT, but it is not published through Caddy yet." >&2
    exit 6
  fi
  printf '%s\n' "$CADDY_BLOCK" | "${SSH[@]}" "cat > /tmp/mkmovies.caddy"
  "${SSH[@]}" "cat > /tmp/mkmovies-cf-ips.caddy" < deploy/cloudflare-ips.caddy
  "${SSH[@]}" "CF_SNIPPET=$CF_SNIPPET APP_DIR=$APP_DIR bash -s" <<'EOF'
set -euo pipefail
CF=/etc/caddy/Caddyfile
STAMP="$(date +%Y%m%d%H%M%S)"
BAK="$CF.bak-$STAMP-mkmovies"
sudo cp "$CF" "$BAK"
SNIP_BAK=""
if sudo test -f "$CF_SNIPPET"; then SNIP_BAK="$CF_SNIPPET.bak-$STAMP"; sudo cp "$CF_SNIPPET" "$SNIP_BAK"; fi
restore() {
  sudo cp "$BAK" "$CF"
  if [ -n "$SNIP_BAK" ]; then sudo cp "$SNIP_BAK" "$CF_SNIPPET"; fi
}
# The access log lives inside the 5 GiB cap; setup-host.sh created it caddy-owned.
sudo -u caddy test -w "$APP_DIR/logs" || { echo "caddy cannot write $APP_DIR/logs — re-run setup-host.sh" >&2; exit 5; }
sudo install -d -o root -g root -m 755 "$(dirname "$CF_SNIPPET")"
sudo install -o root -g root -m 644 /tmp/mkmovies-cf-ips.caddy "$CF_SNIPPET" && rm -f /tmp/mkmovies-cf-ips.caddy
sudo sed -i '/^# BEGIN mkmovies/,/^# END mkmovies/d' "$CF"
sudo tee -a "$CF" </tmp/mkmovies.caddy >/dev/null && rm -f /tmp/mkmovies.caddy
if ! sudo caddy validate --config "$CF" --adapter caddyfile >/dev/null 2>/tmp/mkmovies-caddy-validate.log; then
  echo "caddy validate FAILED — restoring $BAK" >&2
  tail -5 /tmp/mkmovies-caddy-validate.log >&2
  restore
  exit 5
fi
if ! sudo systemctl reload caddy; then
  echo "caddy reload FAILED — restoring $BAK and reloading" >&2
  restore
  sudo systemctl reload caddy || true
  exit 5
fi
echo "Caddy reloaded (backup: $BAK)"
EOF
fi

log "Resource usage"
"${SSH[@]}" "APP_DIR=$APP_DIR bash -s" <<EOF
docker stats --no-stream --format 'container={{.Name}} mem={{.MemUsage}} cpu={{.CPUPerc}}' $CONTAINER $DB_CONTAINER
echo "mkmovies.slice memory: \$(( \$(systemctl show -P MemoryCurrent mkmovies.slice) / 1048576 )) MiB of 1024 MiB"
df -h $APP_DIR
sudo du -sh $APP_DIR/pgdata $APP_DIR/backups $APP_DIR/logs $APP_DIR/cache 2>/dev/null
docker image ls $IMAGE
EOF
echo "OK: rev $REV serving on 127.0.0.1:$APP_PORT. Public: https://www.mkmovies.site (via Cloudflare, proxied A @/www -> $DEPLOY_HOST)"
