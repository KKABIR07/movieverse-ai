#!/usr/bin/env bash
# Roll the mkmovies WEB container back to the image that was live before the last deploy.
#
#   ./scripts/rollback.sh             # mkmovies-web:previous -> :latest, recreate web only, health + readiness
#   ./scripts/rollback.sh --dry-run   # show what would happen; never connects
#
# deploy.sh tags the outgoing image as mkmovies-web:previous before every build. The image being
# replaced is kept as mkmovies-web:failed so it can be inspected. Running rollback twice swaps back.
# The database container (mkmovies-db), pgdata/, source and .env are NOT touched.
#
# DATABASE MIGRATIONS ARE FORWARD-ONLY. Rolling back the image does not undo a migration the new image
# already applied. If the previous image cannot work with the newer schema (readiness fails or the app
# errors), restore the pre-deploy dump that deploy.sh took right before starting the new image:
#   ssh ... 'sudo /usr/local/lib/mkmovies/backup.sh --list'          # find mkmovies-<stamp>-predeploy.dump
#   ssh ... 'sudo /usr/local/lib/mkmovies/restore.sh /opt/mkmovies/backups/<that file> --yes'
# (Data written between that deploy and the restore is lost; restore.sh takes a safety dump first.)
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
    echo "       docker compose -p mkmovies up -d --no-build --force-recreate --no-deps web  (db untouched);"
    echo "       health http://127.0.0.1:$APP_PORT/api/health, readiness /api/ready;"
    echo "       on readiness failure: print the newest *-predeploy.dump and the restore.sh command."
    exit 0 ;;
  -h|--help) sed -n '2,19p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
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
# Web only: never recreate (restart) the database during a rollback.
docker compose -p mkmovies --env-file .env up -d --no-build --force-recreate --no-deps web

hint() {
  dump="$(sudo find "$APP_DIR/backups" -maxdepth 1 -name 'mkmovies-*-predeploy.dump' -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)"
  echo "Migrations are forward-only. If the old image cannot use the newer schema, restore the pre-deploy dump:" >&2
  if [ -n "$dump" ]; then
    echo "  sudo /usr/local/lib/mkmovies/restore.sh $dump --yes" >&2
  else
    echo "  (no *-predeploy.dump found — see: sudo /usr/local/lib/mkmovies/backup.sh --list)" >&2
  fi
}

ok=0
for _ in $(seq 1 40); do
  if curl -fsS -o /dev/null "http://127.0.0.1:$APP_PORT/api/health"; then ok=1; break; fi
  sleep 3
done
if [ "$ok" != 1 ]; then
  echo "Rolled-back container is not healthy either:" >&2
  docker logs --tail 60 mkmovies-web >&2 || true
  hint
  exit 1
fi
for _ in $(seq 1 30); do
  if curl -fsS -o /dev/null --max-time 5 "http://127.0.0.1:$APP_PORT/api/ready"; then
    echo "Rolled back. Now serving image $(docker image inspect -f '{{.Id}}' mkmovies-web:latest | cut -c8-19) (healthy + ready)."
    exit 0
  fi
  sleep 3
done
echo "Rolled-back web is live but NOT ready (/api/ready != 200) — likely a schema mismatch." >&2
curl -sS --max-time 5 "http://127.0.0.1:$APP_PORT/api/ready" >&2 || true
hint
exit 1
EOF
