#!/usr/bin/env bash
# PostgreSQL backup for mkmovies: pg_dump -Fc via `docker exec`, verified, then pruned to budget.
#
#   backup.sh                      # dump + verify + prune (label "nightly": mkmovies-YYYYmmdd-HHMM.dump)
#   backup.sh --label predeploy    # mkmovies-YYYYmmdd-HHMM-predeploy.dump (deploy.sh, before a new web image)
#   backup.sh --prune-only         # only apply the retention policy (no dump)
#   backup.sh --list               # list dumps and the total size
#
# Installed on the box as /usr/local/lib/mkmovies/backup.sh (root) and run nightly by
# mkmovies-backup.timer. Retention, applied only AFTER the new dump verified with `pg_restore --list`:
#   1. delete dumps older than KEEP_DAYS (7), but always keep the newest MIN_KEEP (2);
#   2. then delete the oldest until all dumps together are <= MAX_TOTAL_MB (1024), keeping at least the newest.
# Before dumping it refuses to run unless the filesystem keeps RESERVE_MB free after a dump as large
# as the live database — the dumps share the 5 GiB filesystem with pgdata, and Postgres must never hit ENOSPC.
#
# Env (all optional): DB_CONTAINER=mkmovies-db BACKUP_DIR=/opt/mkmovies/backups KEEP_DAYS=7 MIN_KEEP=2
#                     MAX_TOTAL_MB=1024 RESERVE_MB=256 DOCKER=docker
set -euo pipefail

DB_CONTAINER="${DB_CONTAINER:-mkmovies-db}"
BACKUP_DIR="${BACKUP_DIR:-/opt/mkmovies/backups}"
KEEP_DAYS="${KEEP_DAYS:-7}"
MIN_KEEP="${MIN_KEEP:-2}"
MAX_TOTAL_MB="${MAX_TOTAL_MB:-1024}"
RESERVE_MB="${RESERVE_MB:-256}"
DOCKER="${DOCKER:-docker}"

LABEL=nightly
MODE=backup
while [[ $# -gt 0 ]]; do
  case "$1" in
    --label) LABEL="${2:-}"; shift 2 ;;
    --prune-only) MODE=prune; shift ;;
    --list) MODE=list; shift ;;
    -h|--help) sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

log() { printf '[backup] %s\n' "$*"; }
die() { printf '[backup] ERROR: %s\n' "$*" >&2; exit 1; }

[[ "$LABEL" =~ ^[a-z][a-z0-9-]{0,20}$ ]] || die "invalid --label '$LABEL'"
for n in KEEP_DAYS MIN_KEEP MAX_TOTAL_MB RESERVE_MB; do
  [[ "${!n}" =~ ^[0-9]+$ ]] || die "$n must be a non-negative integer (got '${!n}')"
done
(( MIN_KEEP >= 1 )) || die "MIN_KEEP must be >= 1"
umask 077
mkdir -p "$BACKUP_DIR"

# Dumps sorted oldest -> newest: "<mtime-epoch> <bytes> <path>" per line. Names never contain spaces.
list_dumps() {
  find "$BACKUP_DIR" -maxdepth 1 -type f -name 'mkmovies-*.dump' -printf '%T@ %s %p\n' | sort -n -k1,1 -k3,3
}
total_bytes() { list_dumps | awk '{s+=$2} END{print s+0}'; }
human() { awk -v b="$1" 'BEGIN{ if (b>=1048576) printf "%.1f MB", b/1048576; else printf "%.1f KB", b/1024 }'; }

# prune [protected-path] — retention policy; never deletes the protected (just-verified) dump.
prune() {
  local protect="${1:-}" now cutoff count total ts size path
  now="$(date +%s)"
  cutoff=$(( now - KEEP_DAYS * 86400 ))
  local -a rows=()
  mapfile -t rows < <(list_dumps)
  count=${#rows[@]}
  # 1. Age: older than KEEP_DAYS, as long as more than MIN_KEEP remain.
  for row in "${rows[@]}"; do
    read -r ts size path <<<"$row"
    (( count > MIN_KEEP )) || break
    [[ "$path" == "$protect" ]] && continue
    if (( ${ts%.*} < cutoff )); then
      rm -f -- "$path"; count=$((count - 1))
      log "pruned (older than ${KEEP_DAYS}d): $(basename "$path")"
    fi
  done
  # 2. Size: oldest first until the total fits MAX_TOTAL_MB; the newest dump always survives.
  local max_bytes=$(( MAX_TOTAL_MB * 1024 * 1024 ))
  mapfile -t rows < <(list_dumps)
  count=${#rows[@]}
  total="$(total_bytes)"
  for row in "${rows[@]}"; do
    (( total > max_bytes && count > 1 )) || break
    read -r ts size path <<<"$row"
    [[ "$path" == "$protect" ]] && continue
    rm -f -- "$path"; count=$((count - 1)); total=$(( total - size ))
    log "pruned (budget ${MAX_TOTAL_MB} MB): $(basename "$path")"
  done
  total="$(total_bytes)"
  log "retained $count dump(s), $(human "$total") of ${MAX_TOTAL_MB} MB budget"
  if (( total > max_bytes )); then
    log "WARNING: the newest dump alone exceeds the ${MAX_TOTAL_MB} MB budget — the database has outgrown it"
  fi
}

if [[ $MODE == list ]]; then
  list_dumps | while read -r _ size path; do printf '%10s  %s\n' "$(human "$size")" "$(basename "$path")"; done
  echo "total: $(human "$(total_bytes)") (budget ${MAX_TOTAL_MB} MB)"
  exit 0
fi
if [[ $MODE == prune ]]; then prune; exit 0; fi

# Serialize with other runs (nightly timer vs. deploy pre-deploy backup) when flock exists.
if command -v flock >/dev/null; then
  exec 9>"$BACKUP_DIR/.lock"
  flock -w 600 9 || die "another backup is still running"
fi

command -v "$DOCKER" >/dev/null || die "docker not found"
[[ "$("$DOCKER" inspect -f '{{.State.Running}}' "$DB_CONTAINER" 2>/dev/null || true)" == "true" ]] \
  || die "database container $DB_CONTAINER is not running"

# Clean up partial files from an interrupted earlier run.
find "$BACKUP_DIR" -maxdepth 1 -type f -name '.mkmovies-*.partial' -delete

# Free-space guard: need (live DB size) + RESERVE_MB free on the backup filesystem.
db_bytes="$("$DOCKER" exec "$DB_CONTAINER" sh -c 'psql -X -qtA -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select pg_database_size(current_database())"' | tr -d '[:space:]')"
[[ "$db_bytes" =~ ^[0-9]+$ ]] || die "could not read the database size (got '$db_bytes')"
avail_kib="$(df --output=avail -k "$BACKUP_DIR" | tail -1 | tr -d ' ')"
need_kib=$(( db_bytes / 1024 + RESERVE_MB * 1024 ))
if (( avail_kib < need_kib )); then
  log "only $(( avail_kib / 1024 )) MB free, need $(( need_kib / 1024 )) MB — pruning old dumps first (keeping the newest)"
  MIN_KEEP=1 MAX_TOTAL_MB=0 prune ""
  avail_kib="$(df --output=avail -k "$BACKUP_DIR" | tail -1 | tr -d ' ')"
  (( avail_kib >= need_kib )) || die "not enough free space for a safe dump ($(( avail_kib / 1024 )) MB free, need $(( need_kib / 1024 )) MB)"
fi

stamp="$(date +%Y%m%d-%H%M)"
suffix=""
[[ "$LABEL" == nightly ]] || suffix="-$LABEL"
final="$BACKUP_DIR/mkmovies-$stamp$suffix.dump"
[[ -e "$final" ]] && final="$BACKUP_DIR/mkmovies-$(date +%Y%m%d-%H%M%S)$suffix.dump"
partial="$BACKUP_DIR/.$(basename "$final").partial"
trap 'rm -f -- "$partial"' EXIT

log "dumping $DB_CONTAINER (db size $(human "$db_bytes")) -> $(basename "$final")"
"$DOCKER" exec "$DB_CONTAINER" sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -Z 6' > "$partial" \
  || die "pg_dump failed"

# Verify before it may replace anything: custom-format magic + a readable table of contents.
[[ -s "$partial" ]] || die "dump is empty"
[[ "$(head -c 5 "$partial")" == "PGDMP" ]] || die "dump has no PGDMP header"
"$DOCKER" exec -i "$DB_CONTAINER" pg_restore --list < "$partial" > /dev/null || die "pg_restore --list failed: dump is unreadable"
mv -f -- "$partial" "$final"
chmod 600 "$final"
log "verified $(basename "$final") ($(human "$(stat -c %s "$final")"))"

prune "$final"
