#!/usr/bin/env bash
# Deploy MovieVerse AI (mkmovies) to the OCI box mkb-007 (Docker + host Caddy).
#
#   ./scripts/deploy.sh             # ship committed HEAD, build on the box, start, update Caddy, health-check
#   ./scripts/deploy.sh --no-caddy  # skip the Caddy site-block update
#   ./scripts/deploy.sh --dry-run   # validate local inputs and print the plan; never connects
#
# Env overrides: DEPLOY_HOST, DEPLOY_USER, DEPLOY_KEY, APP_DIR, APP_PORT, MAX_IMAGE_MB.
# Idempotent. Preserves the remote .env (created from .env.example on the first run, with a fresh
# JWT_SECRET). Refuses to start the app while required secrets are empty — fill them with
# scripts/push-env.sh. Ships `git archive HEAD`, so uncommitted changes are NOT deployed.
# Works from Git Bash on Windows and from Linux/macOS.
set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:-163.192.105.150}"
DEPLOY_USER="${DEPLOY_USER:-ubuntu}"
DEPLOY_KEY="${DEPLOY_KEY:-/d/DOWNLOAD/Rizuan-oci-vps/ssh-key-2026-11-11.key}"
APP_DIR="${APP_DIR:-/opt/mkmovies}"
APP_PORT="${APP_PORT:-3120}"
MAX_IMAGE_MB="${MAX_IMAGE_MB:-1024}"
PROJECT=mkmovies
CONTAINER=mkmovies-web
IMAGE=mkmovies-web
REQUIRED_KEYS="TMDB_BEARER MONGODB_URI JWT_SECRET GROQ_API_KEY YOUTUBE_API_KEY"
ORIGIN_CERT=/etc/caddy/certs/mkmovies.site.pem
ORIGIN_KEY=/etc/caddy/certs/mkmovies.site.key
CF_SNIPPET=/etc/caddy/mkmovies/cloudflare-ips.caddy

DO_CADDY=1
DRY_RUN=0
usage() { sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'; }
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
[[ "$MAX_IMAGE_MB" =~ ^[0-9]+$ ]] || die "MAX_IMAGE_MB must be an integer"
[[ "$DEPLOY_HOST" =~ ^[A-Za-z0-9.-]+$ ]] || die "DEPLOY_HOST looks invalid: '$DEPLOY_HOST'"
[[ "$DEPLOY_USER" =~ ^[a-z_][a-z0-9_-]*$ ]] || die "DEPLOY_USER looks invalid: '$DEPLOY_USER'"
[[ "$APP_DIR" =~ ^/[A-Za-z0-9/_.-]+$ && "$APP_DIR" != "/" ]] || die "APP_DIR must be an absolute path without spaces (got '$APP_DIR')"
[[ -f "$DEPLOY_KEY" ]] || die "SSH key not found: $DEPLOY_KEY"
for bin in git ssh scp sed; do command -v "$bin" >/dev/null || die "missing local tool: $bin"; done
cd "$ROOT"
git rev-parse --verify -q HEAD >/dev/null || die "not a git repository with commits: $ROOT"
for f in Dockerfile docker-compose.yml .env.example deploy/Caddyfile.mkmovies deploy/cloudflare-ips.caddy scripts/setup-storage.sh; do
  git cat-file -e "HEAD:$f" 2>/dev/null || die "$f is not committed at HEAD (deploy ships HEAD only)"
done
for k in $REQUIRED_KEYS; do
  grep -q "^$k=" .env.example || die ".env.example is missing required key $k"
done
REV="$(git rev-parse --short HEAD)"
if [[ -n "$(git status --porcelain)" ]]; then
  echo "WARNING: uncommitted changes are not deployed (shipping HEAD $REV)." >&2
fi
CADDY_BLOCK="$(sed -e "s/__APP_PORT__/$APP_PORT/g" -e "s|__CF_SNIPPET__|$CF_SNIPPET|g" deploy/Caddyfile.mkmovies)"
grep -qE '__(APP_PORT|CF_SNIPPET)__' <<<"$CADDY_BLOCK" && die "Caddy template still has placeholders"
echo "OK: host=$DEPLOY_USER@$DEPLOY_HOST dir=$APP_DIR port=127.0.0.1:$APP_PORT rev=$REV caddy=$DO_CADDY max_image=${MAX_IMAGE_MB}MB"

if [[ $DRY_RUN -eq 1 ]]; then
  log "Dry run — plan (nothing was contacted)"
  cat <<PLAN
  1. ssh $DEPLOY_USER@$DEPLOY_HOST hostname                (connectivity)
  2. port $APP_PORT free, or already held by $CONTAINER
  3. sudo setup-storage.sh -> 5 GiB loop-mounted ext4 at $APP_DIR
  4. git archive $REV -> extract into $APP_DIR (keeps .env)
  5. first run: .env from .env.example + generated JWT_SECRET; stop if required keys are empty
  6. tag $IMAGE:latest -> $IMAGE:previous, docker compose -p $PROJECT build
  7. image size <= ${MAX_IMAGE_MB} MB, then up -d; prune dangling images + old build cache
  8. health: http://127.0.0.1:$APP_PORT/api/health (Caddy untouched if this fails)
  9. require origin cert $ORIGIN_CERT + key; upload CF-IP snippet -> $CF_SNIPPET
 10. Caddy block (marker-managed, validated, rolled back on failure):
PLAN
  [[ $DO_CADDY -eq 1 ]] && sed 's/^/       | /' <<<"$CADDY_BLOCK" || echo "       (skipped: --no-caddy)"
  echo " 11. docker stats ; df -h $APP_DIR"
  exit 0
fi

SSH=(ssh -i "$DEPLOY_KEY" -o BatchMode=yes -o ConnectTimeout=20 -o StrictHostKeyChecking=accept-new "$DEPLOY_USER@$DEPLOY_HOST")
SCP=(scp -i "$DEPLOY_KEY" -o BatchMode=yes -o ConnectTimeout=20 -o StrictHostKeyChecking=accept-new)
REMOTE_ENV="APP_DIR=$APP_DIR APP_PORT=$APP_PORT PROJECT=$PROJECT CONTAINER=$CONTAINER IMAGE=$IMAGE MAX_IMAGE_MB=$MAX_IMAGE_MB DEPLOY_USER=$DEPLOY_USER"

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

log "Upload source (git archive $REV)"
TARBALL="$(mktemp -t mkmovies.XXXXXX)"
trap 'rm -f "$TARBALL"' EXIT
git archive --format=tar.gz -o "$TARBALL" HEAD
"${SCP[@]}" "$TARBALL" "$DEPLOY_USER@$DEPLOY_HOST:/tmp/mkmovies.tar.gz"

log "Extract (keep .env), check secrets"
set +e
"${SSH[@]}" "$REMOTE_ENV bash -s" <<'EOF'
set -euo pipefail
cd "$APP_DIR"
# Wipe old source but keep secrets, persistent data and the ext4 lost+found.
find . -mindepth 1 -maxdepth 1 ! -name .env ! -name data ! -name backups ! -name lost+found -exec rm -rf {} +
tar -xzf /tmp/mkmovies.tar.gz -C "$APP_DIR" && rm -f /tmp/mkmovies.tar.gz

setkey() { # setkey KEY VALUE  — replace or append without sed-escaping problems
  K="$1" V="$2" awk 'BEGIN{k=ENVIRON["K"]; v=ENVIRON["V"]; d=0} index($0, k"=")==1 {if(!d) print k"="v; d=1; next} {print} END{if(!d) print k"="v}' .env > .env.tmp
  cat .env.tmp > .env && rm -f .env.tmp
}
umask 077
if [ ! -f .env ]; then
  cp .env.example .env
  setkey JWT_SECRET "$(openssl rand -hex 48)"
  echo "Created .env from .env.example with a generated JWT_SECRET."
fi
chmod 600 .env
setkey APP_PORT "$APP_PORT"

missing=""
for k in TMDB_BEARER MONGODB_URI JWT_SECRET GROQ_API_KEY YOUTUBE_API_KEY; do
  v="$(grep -m1 "^$k=" .env | cut -d= -f2- || true)"
  [ -n "$v" ] || missing="$missing $k"
done
jwt="$(grep -m1 '^JWT_SECRET=' .env | cut -d= -f2- || true)"
if [ -n "$jwt" ] && [ "${#jwt}" -lt 32 ]; then missing="$missing JWT_SECRET(<32 chars)"; fi
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

log "Build image (outgoing image kept as $IMAGE:previous)"
"${SSH[@]}" "$REMOTE_ENV bash -s" <<'EOF'
set -euo pipefail
cd "$APP_DIR"
if docker image inspect "$IMAGE:latest" >/dev/null 2>&1; then
  docker tag "$IMAGE:latest" "$IMAGE:previous"
fi
docker compose -p "$PROJECT" --env-file .env build --pull web

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

docker compose -p "$PROJECT" --env-file .env up -d --no-build --remove-orphans

# Disk hygiene for the shared /var/lib/docker: only latest + previous of our image survive.
docker images "$IMAGE" --format '{{.Repository}}:{{.Tag}}' | grep -vE ":(latest|previous)$" | grep -v ':<none>$' | xargs -r docker rmi >/dev/null 2>&1 || true
docker image prune -f >/dev/null
docker builder prune -f --filter until=168h >/dev/null 2>&1 || true
EOF

log "Health check (container, loopback)"
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
  "${SSH[@]}" "CF_SNIPPET=$CF_SNIPPET bash -s" <<'EOF'
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
sudo install -d -o caddy -g caddy -m 755 /var/log/caddy 2>/dev/null || sudo mkdir -p /var/log/caddy
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
"${SSH[@]}" "docker stats --no-stream --format 'container={{.Name}} mem={{.MemUsage}} cpu={{.CPUPerc}}' $CONTAINER; df -h $APP_DIR; docker image ls $IMAGE"
echo "OK: rev $REV serving on 127.0.0.1:$APP_PORT. Public: https://www.mkmovies.site (via Cloudflare, proxied A @/www -> $DEPLOY_HOST)"
