#!/usr/bin/env bash
# Disk guard for the 5 GiB mkmovies filesystem (run every 15 min by mkmovies-disk-guard.timer, as root).
#
#   disk-guard.sh              # check and act
#   disk-guard.sh --status     # print usage only, change nothing
#   disk-guard.sh --trim-cache # only enforce the Next.js cache cap (deploy.sh runs this)
#
#   always                  -> Next.js data cache ($CACHE_DIR) > CACHE_MAX_MB (512): delete its oldest files
#                              until it is <= 75% of the cap (it is a cache: every file is safe to delete)
#   usage >= WARN_PCT (80)  -> warning in the journal + writes $APP_DIR/DISK_WARNING (removed when back below)
#   usage >= CRIT_PCT (90)  -> also prunes database dumps down to the newest KEEP_ON_CRIT (2), deletes
#                              rotated (old) Caddy access-log files and empties the Next.js cache;
#                              the live access log is left alone.
# It NEVER touches pgdata, .env or the source tree — live data is only ever reported, not deleted.
# Messages carry sd-daemon priority prefixes (<4> warning, <3> error) so journald records their level.
#
# Env (optional): APP_DIR=/opt/mkmovies BACKUP_DIR=$APP_DIR/backups LOG_DIR=$APP_DIR/logs
#                 CACHE_DIR=$APP_DIR/cache/next CACHE_MAX_MB=512 WARN_PCT=80 CRIT_PCT=90 KEEP_ON_CRIT=2
#                 REQUIRE_MOUNT=1 (0 skips the "is it mounted" check — for tests only)
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/mkmovies}"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
LOG_DIR="${LOG_DIR:-$APP_DIR/logs}"
CACHE_DIR="${CACHE_DIR:-$APP_DIR/cache/next}"
CACHE_MAX_MB="${CACHE_MAX_MB:-512}"
WARN_PCT="${WARN_PCT:-80}"
CRIT_PCT="${CRIT_PCT:-90}"
KEEP_ON_CRIT="${KEEP_ON_CRIT:-2}"
STATUS_ONLY=0
TRIM_ONLY=0
case "${1:-}" in
  "") ;;
  --status) STATUS_ONLY=1 ;;
  --trim-cache) TRIM_ONLY=1 ;;
  -h|--help) sed -n '2,19p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
  *) echo "Unknown argument: $1" >&2; exit 2 ;;
esac
for n in WARN_PCT CRIT_PCT KEEP_ON_CRIT CACHE_MAX_MB; do
  [[ "${!n}" =~ ^[0-9]+$ ]] || { echo "<3>[disk-guard] $n must be an integer" >&2; exit 2; }
done
(( KEEP_ON_CRIT >= 1 )) || { echo "<3>[disk-guard] KEEP_ON_CRIT must be >= 1" >&2; exit 2; }

info() { printf '<6>[disk-guard] %s\n' "$*"; }
warn() { printf '<4>[disk-guard] %s\n' "$*"; }
err()  { printf '<3>[disk-guard] %s\n' "$*" >&2; }

[[ -d "$APP_DIR" ]] || { err "$APP_DIR does not exist"; exit 1; }
if [[ "${REQUIRE_MOUNT:-1}" == 1 ]] && command -v mountpoint >/dev/null && ! mountpoint -q "$APP_DIR"; then
  err "$APP_DIR is NOT mounted — the 5 GiB cap is not in effect (sudo mount $APP_DIR)"
  exit 1
fi

# trim_cache MAX_BYTES TARGET_BYTES — when the cache exceeds MAX, delete oldest files until <= TARGET.
trim_cache() {
  local max="$1" target="$2" total _ts size path n=0
  [[ -d "$CACHE_DIR" ]] || return 0
  total="$(find "$CACHE_DIR" -type f -printf '%s\n' | awk '{s+=$1} END{print s+0}')"
  (( total > max )) || return 0
  while read -r _ts size path; do
    (( total > target )) || break
    rm -f -- "$path" && total=$(( total - size )) && n=$(( n + 1 ))
  done < <(find "$CACHE_DIR" -type f -printf '%T@ %s %p\n' | sort -n)
  find "$CACHE_DIR" -mindepth 1 -type d -empty -delete 2>/dev/null || true
  warn "Next.js cache was over $(( max / 1048576 )) MB: deleted $n oldest file(s), now $(( total / 1048576 )) MB"
}
cache_max=$(( CACHE_MAX_MB * 1024 * 1024 ))

usage_pct() { df --output=pcent "$APP_DIR" | tail -1 | tr -dc '0-9'; }
summary() { df -h --output=used,size,avail "$APP_DIR" | tail -1 | awk '{print $1" used of "$2", "$3" free"}'; }

if [[ $STATUS_ONLY -eq 1 ]]; then
  echo "$APP_DIR: $(usage_pct)% ($(summary))"
  du -sh "$APP_DIR"/pgdata "$BACKUP_DIR" "$LOG_DIR" "$CACHE_DIR" 2>/dev/null || true
  exit 0
fi

trim_cache "$cache_max" $(( cache_max * 3 / 4 ))
[[ $TRIM_ONLY -eq 1 ]] && exit 0

pct="$(usage_pct)"
line="$(summary)"
flag="$APP_DIR/DISK_WARNING"
if (( pct < WARN_PCT )); then
  if [[ -f "$flag" ]]; then rm -f "$flag"; info "usage back to ${pct}% — cleared DISK_WARNING"; fi
  info "ok: ${pct}% ($line)"
  exit 0
fi

warn "$APP_DIR at ${pct}% (>= ${WARN_PCT}%): $line"
breakdown="$(du -sh "$APP_DIR"/pgdata "$BACKUP_DIR" "$LOG_DIR" "$CACHE_DIR" 2>/dev/null | awk '{printf "%s=%s ", $2, $1}' || true)"
warn "breakdown: ${breakdown:-n/a}"
printf '%s %s%% used (%s). %s\n' "$(date -Is)" "$pct" "$line" "$breakdown" > "$flag" 2>/dev/null || true

if (( pct >= CRIT_PCT )); then
  warn "CRITICAL (>= ${CRIT_PCT}%): pruning dumps to the newest $KEEP_ON_CRIT, removing rotated access logs, emptying the Next.js cache"
  if [[ -d "$BACKUP_DIR" ]]; then
    mapfile -t dumps < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'mkmovies-*.dump' -printf '%T@ %p\n' | sort -rn | awk '{print $2}')
    for (( i = KEEP_ON_CRIT; i < ${#dumps[@]}; i++ )); do
      rm -f -- "${dumps[$i]}" && warn "deleted dump $(basename "${dumps[$i]}")"
    done
    find "$BACKUP_DIR" -maxdepth 1 -type f -name '.mkmovies-*.partial' -mmin +60 -delete 2>/dev/null || true
  fi
  if [[ -d "$LOG_DIR" ]]; then
    # Caddy rolls caddy-access.log into caddy-access-<timestamp>.log[.gz]; only those archives go.
    find "$LOG_DIR" -maxdepth 1 -type f -name 'caddy-access-*.log*' -print -delete 2>/dev/null \
      | while read -r f; do warn "deleted rotated log $(basename "$f")"; done
  fi
  if [[ -d "$CACHE_DIR" ]]; then
    find "$CACHE_DIR" -mindepth 1 -delete 2>/dev/null || true
    warn "emptied the Next.js cache $CACHE_DIR"
  fi
  pct="$(usage_pct)"
  if (( pct >= CRIT_PCT )); then
    err "still at ${pct}% after pruning — the live database is growing toward the 5 GiB cap; nothing else is deleted automatically"
    exit 1
  fi
  warn "after pruning: ${pct}%"
fi
exit 0
