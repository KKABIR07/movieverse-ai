#!/usr/bin/env bash
# Roll mkmovies back to the image that was live before the last deploy.
#
#   ./scripts/rollback.sh             # mkmovies-web:previous -> :latest, recreate, health-check
#   ./scripts/rollback.sh --dry-run   # show what would happen; never connects
#
# deploy.sh tags the outgoing image as mkmovies-web:previous before every build. The image being
# replaced is kept as mkmovies-web:failed so it can be inspected. Running rollback twice swaps back.
# Only the container image is rolled back; /opt/mkmovies (source + .env) is left as is.
#
# Env overrides: DEPLOY_HOST, DEPLOY_USER, DEPLOY_KEY, APP_DIR, APP_PORT.
set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:-163.192.105.150}"
DEPLOY_USER="${DEPLOY_USER:-ubuntu}"
DEPLOY_KEY="${DEPLOY_KEY:-/d/DOWNLOAD/Rizuan-oci-vps/ssh-key-2026-11-11.key}"
APP_DIR="${APP_DIR:-/opt/mkmovies}"
APP_PORT="${APP_PORT:-3120}"

case "${1:-}" in
  "") ;;
  --dry-run)
    echo "Would: ssh $DEPLOY_USER@$DEPLOY_HOST; tag mkmovies-web:latest->:failed, :previous->:latest, :failed->:previous;"
    echo "       docker compose -p mkmovies up -d --no-build --force-recreate; health http://127.0.0.1:$APP_PORT/api/health"
    exit 0 ;;
  -h|--help) sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
  *) echo "Unknown argument: $1" >&2; exit 2 ;;
esac

[[ -f "$DEPLOY_KEY" ]] || { echo "SSH key not found: $DEPLOY_KEY" >&2; exit 1; }
[[ "$APP_PORT" =~ ^[0-9]+$ ]] || { echo "APP_PORT invalid" >&2; exit 1; }
[[ "$APP_DIR" =~ ^/[A-Za-z0-9/_.-]+$ ]] || { echo "APP_DIR invalid" >&2; exit 1; }
SSH=(ssh -i "$DEPLOY_KEY" -o BatchMode=yes -o ConnectTimeout=20 -o StrictHostKeyChecking=accept-new "$DEPLOY_USER@$DEPLOY_HOST")

"${SSH[@]}" "APP_DIR=$APP_DIR APP_PORT=$APP_PORT bash -s" <<'EOF'
set -euo pipefail
cd "$APP_DIR"
docker image inspect mkmovies-web:previous >/dev/null 2>&1 || { echo "No mkmovies-web:previous image to roll back to." >&2; exit 1; }
docker tag mkmovies-web:latest mkmovies-web:failed
docker tag mkmovies-web:previous mkmovies-web:latest
docker tag mkmovies-web:failed mkmovies-web:previous
docker compose -p mkmovies --env-file .env up -d --no-build --force-recreate
for _ in $(seq 1 40); do
  if curl -fsS -o /dev/null "http://127.0.0.1:$APP_PORT/api/health"; then
    echo "Rolled back. Now serving image $(docker image inspect -f '{{.Id}}' mkmovies-web:latest | cut -c8-19)."
    exit 0
  fi
  sleep 3
done
echo "Rolled-back container is not healthy either:" >&2
docker logs --tail 60 mkmovies-web >&2 || true
exit 1
EOF
