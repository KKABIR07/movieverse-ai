#!/usr/bin/env bash
# Restore the mkmovies database from a pg_dump -Fc file (run ON the box, as root).
#
#   sudo /usr/local/lib/mkmovies/restore.sh /opt/mkmovies/backups/mkmovies-20261125-0317.dump --yes
#   sudo /usr/local/lib/mkmovies/restore.sh <dump> --yes --no-safety-backup
#
# Steps: verify the dump (PGDMP header + pg_restore --list) -> take a "prerestore" safety backup of the
# current database (skip with --no-safety-backup) -> stop the web container -> pg_restore --clean
# --if-exists --single-transaction (all-or-nothing: on any error nothing is changed) -> start web ->
# wait for /api/ready (200) up to READY_TIMEOUT seconds. The web container is started again even if
# the restore fails, so the site comes back on the untouched old data.
#
# Env (optional): DB_CONTAINER=mkmovies-db WEB_CONTAINER=mkmovies-web APP_PORT=3120 READY_TIMEOUT=90
#                 BACKUP_SH=<dir of this script>/backup.sh DOCKER=docker
set -euo pipefail

DB_CONTAINER="${DB_CONTAINER:-mkmovies-db}"
WEB_CONTAINER="${WEB_CONTAINER:-mkmovies-web}"
APP_PORT="${APP_PORT:-3120}"
READY_TIMEOUT="${READY_TIMEOUT:-90}"
DOCKER="${DOCKER:-docker}"
BACKUP_SH="${BACKUP_SH:-$(cd "$(dirname "$0")" && pwd)/backup.sh}"

log() { printf '[restore] %s\n' "$*"; }
die() { printf '[restore] ERROR: %s\n' "$*" >&2; exit 1; }

DUMP=""
YES=0
SAFETY=1
for arg in "$@"; do
  case "$arg" in
    --yes) YES=1 ;;
    --no-safety-backup) SAFETY=0 ;;
    -h|--help) sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*) die "unknown flag: $arg" ;;
    *) [[ -z "$DUMP" ]] || die "only one dump file may be given"; DUMP="$arg" ;;
  esac
done
[[ -n "$DUMP" ]] || die "usage: $0 <dump-file> --yes"
[[ -f "$DUMP" && -s "$DUMP" ]] || die "dump not found or empty: $DUMP"
[[ "$APP_PORT" =~ ^[0-9]+$ && "$READY_TIMEOUT" =~ ^[0-9]+$ ]] || die "APP_PORT/READY_TIMEOUT must be integers"
[[ $YES -eq 1 ]] || die "this REPLACES the live database with $DUMP — re-run with --yes to confirm"
[[ "$("$DOCKER" inspect -f '{{.State.Running}}' "$DB_CONTAINER" 2>/dev/null || true)" == "true" ]] \
  || die "database container $DB_CONTAINER is not running"

log "verifying $DUMP"
[[ "$(head -c 5 "$DUMP")" == "PGDMP" ]] || die "not a pg_dump custom-format file (no PGDMP header)"
entries="$("$DOCKER" exec -i "$DB_CONTAINER" pg_restore --list < "$DUMP" | grep -cv '^;' || true)"
log "dump OK ($entries TOC entries)"

if [[ $SAFETY -eq 1 ]]; then
  log "safety backup of the current database first"
  DB_CONTAINER="$DB_CONTAINER" bash "$BACKUP_SH" --label prerestore || die "safety backup failed — nothing was changed"
fi

web_was_running=0
if [[ "$("$DOCKER" inspect -f '{{.State.Running}}' "$WEB_CONTAINER" 2>/dev/null || true)" == "true" ]]; then
  web_was_running=1
  log "stopping $WEB_CONTAINER"
  "$DOCKER" stop -t 20 "$WEB_CONTAINER" >/dev/null
fi
start_web() {
  if "$DOCKER" inspect "$WEB_CONTAINER" >/dev/null 2>&1; then
    log "starting $WEB_CONTAINER"
    "$DOCKER" start "$WEB_CONTAINER" >/dev/null || true
  fi
}

log "restoring (single transaction: all or nothing)"
set +e
"$DOCKER" exec -i "$DB_CONTAINER" sh -c \
  'exec pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-privileges --single-transaction --exit-on-error' \
  < "$DUMP"
rc=$?
set -e
if [[ $rc -ne 0 ]]; then
  log "pg_restore FAILED (exit $rc) — the transaction was rolled back, the old data is unchanged"
  start_web
  exit 1
fi
log "restore committed"

start_web
if [[ $web_was_running -eq 0 ]] && ! "$DOCKER" inspect "$WEB_CONTAINER" >/dev/null 2>&1; then
  log "no web container exists; skipping the readiness check"
  exit 0
fi
log "waiting for http://127.0.0.1:$APP_PORT/api/ready (max ${READY_TIMEOUT}s)"
deadline=$(( $(date +%s) + READY_TIMEOUT ))
while (( $(date +%s) < deadline )); do
  if curl -fsS -o /dev/null --max-time 5 "http://127.0.0.1:$APP_PORT/api/ready"; then
    log "ready — restore complete"
    exit 0
  fi
  sleep 3
done
die "web did not become ready within ${READY_TIMEOUT}s — check: docker logs --tail 100 $WEB_CONTAINER"
