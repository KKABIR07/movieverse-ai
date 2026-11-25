#!/usr/bin/env bash
# Host integration for mkmovies on the OCI box (run ON the box as root; deploy.sh does this every deploy).
#
#   sudo APP_DIR=/opt/mkmovies SRC_DIR=/opt/mkmovies bash setup-host.sh [owner]
#
# Idempotent. Requires the 5 GiB filesystem from setup-storage.sh to be mounted at $APP_DIR. It:
#   1. checks Docker's cgroup driver / version (cgroup v2 is required for the shared memory cap);
#   2. installs + starts the systemd slice mkmovies.slice (MemoryMax=1G, MemorySwapMax=0, CPUQuota=150%,
#      TasksMax=512) that BOTH containers join via compose `cgroup_parent`;
#   3. creates the persistent dirs inside the cap: pgdata/ (70:70 0700, the postgres uid of
#      postgres:17-alpine), backups/ (root 0700), logs/ (caddy 0750, Caddy's mkmovies access log),
#      cache/next/ (1001:1001 0750, Next.js data cache, trimmed to <= 512 MB by disk-guard.sh);
#   4. installs backup.sh / restore.sh / disk-guard.sh into /usr/local/lib/mkmovies (root-owned, so the
#      root timers never execute files the deploy user can rewrite) and the backup + disk-guard timers.
# Touches only mkmovies-named units/paths: no global Docker, ufw or Caddy configuration is changed.
# Last stdout line is machine-readable for deploy.sh:  CGROUP_PARENT=<value for MKMOVIES_CGROUP_PARENT>
#
# Env overrides: APP_DIR, SRC_DIR (tree holding scripts/ and deploy/systemd/), LIB_DIR, UNIT_DIR.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/mkmovies}"
SRC_DIR="${SRC_DIR:-$APP_DIR}"
LIB_DIR="${LIB_DIR:-/usr/local/lib/mkmovies}"
UNIT_DIR="${UNIT_DIR:-/etc/systemd/system}"
OWNER="${1:-ubuntu}"
PG_UID=70   # postgres user/group inside postgres:17-alpine
WEB_UID=1001 # app user/group inside mkmovies-web (Dockerfile)
SLICE=mkmovies.slice
TIMERS="mkmovies-backup.timer mkmovies-disk-guard.timer"

log() { printf '[setup-host] %s\n' "$*" >&2; }
die() { printf '[setup-host] ERROR: %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "must run as root (sudo)"
[[ "$APP_DIR" =~ ^/[A-Za-z0-9/_.-]+$ && "$APP_DIR" != "/" ]] || die "APP_DIR invalid: $APP_DIR"
id "$OWNER" >/dev/null 2>&1 || die "owner '$OWNER' does not exist"
for bin in systemctl docker mountpoint install cmp; do command -v "$bin" >/dev/null || die "missing tool: $bin"; done
mountpoint -q "$APP_DIR" || die "$APP_DIR is not mounted — run setup-storage.sh first"
for f in scripts/backup.sh scripts/restore.sh scripts/disk-guard.sh deploy/systemd/$SLICE \
         deploy/systemd/mkmovies-backup.service deploy/systemd/mkmovies-backup.timer \
         deploy/systemd/mkmovies-disk-guard.service deploy/systemd/mkmovies-disk-guard.timer; do
  [[ -f "$SRC_DIR/$f" ]] || die "missing $SRC_DIR/$f"
done

# ---------------------------------------------------------------- 1. cgroup driver
driver="$(docker info --format '{{.CgroupDriver}}')"
cgver="$(docker info --format '{{.CgroupVersion}}')"
log "docker cgroup driver=$driver version=$cgver"
[[ "$cgver" == 2 ]] || die "cgroup v$cgver: the shared mkmovies.slice memory cap needs cgroup v2 (unified hierarchy)"
case "$driver" in
  systemd)  cgroup_parent="$SLICE" ;;          # docker creates docker-<id>.scope units inside the slice
  cgroupfs) cgroup_parent="/$SLICE" ;;         # docker creates /sys/fs/cgroup/mkmovies.slice/<id> under systemd's slice
  *) die "unsupported docker cgroup driver: $driver" ;;
esac

# ---------------------------------------------------------------- helpers
changed=0
# put_file SRC DEST MODE — install only when content differs; substitutes /opt/mkmovies -> $APP_DIR.
put_file() {
  local src="$1" dest="$2" mode="$3" tmp
  tmp="$(mktemp)"
  sed "s|/opt/mkmovies|$APP_DIR|g" "$src" > "$tmp"
  if [[ ! -f "$dest" ]] || ! cmp -s "$tmp" "$dest"; then
    install -o root -g root -m "$mode" "$tmp" "$dest"
    changed=1
    log "installed $dest"
  fi
  rm -f "$tmp"
}

# ---------------------------------------------------------------- 2. slice
put_file "$SRC_DIR/deploy/systemd/$SLICE" "$UNIT_DIR/$SLICE" 644
[[ $changed -eq 1 ]] && systemctl daemon-reload
systemctl start "$SLICE"
# Re-apply live values too: a daemon-reload alone may not push changed limits to an already-running slice.
systemctl set-property --runtime "$SLICE" MemoryMax=1G MemorySwapMax=0 CPUQuota=150% TasksMax=512
mem_max="$(systemctl show -P MemoryMax "$SLICE")"
[[ "$mem_max" == 1073741824 ]] || die "$SLICE MemoryMax is '$mem_max', expected 1073741824"
log "$SLICE active: MemoryMax=$mem_max SwapMax=$(systemctl show -P MemorySwapMax "$SLICE") TasksMax=$(systemctl show -P TasksMax "$SLICE")"

# ---------------------------------------------------------------- 3. persistent dirs inside the cap
chmod 751 "$APP_DIR"
install -d -o "$PG_UID" -g "$PG_UID" -m 700 "$APP_DIR/pgdata"
install -d -o root -g root -m 700 "$APP_DIR/backups"
# Next.js data/fetch cache (bind-mounted at /app/.next/cache; uid 1001 = the image's app user).
install -d -o root -g root -m 755 "$APP_DIR/cache"
install -d -o "$WEB_UID" -g "$WEB_UID" -m 750 "$APP_DIR/cache/next"
if id caddy >/dev/null 2>&1; then
  install -d -o caddy -g caddy -m 750 "$APP_DIR/logs"
  # Shadow copy of logs/ on the UNDERLYING mount point: if the loop fs ever fails to mount at boot
  # (fstab `nofail`), Caddy can still open its log file, so a mkmovies problem can never stop Caddy
  # (and with it every other tenant on this box). A non-recursive bind of the parent exposes it.
  shadow="$(mktemp -d /run/mkmovies-shadow.XXXXXX)"
  if mount --bind "$(dirname "$APP_DIR")" "$shadow" 2>/dev/null; then
    under="$shadow/$(basename "$APP_DIR")"
    if [[ -d "$under" ]]; then
      chmod 711 "$under"
      install -d -o caddy -g caddy -m 750 "$under/logs"
    fi
    umount "$shadow"
  else
    log "WARNING: could not bind-mount $(dirname "$APP_DIR") to prepare the shadow logs dir"
  fi
  rmdir "$shadow"
else
  log "WARNING: no 'caddy' user — logs/ owned by root"
  install -d -o root -g root -m 755 "$APP_DIR/logs"
fi

# ---------------------------------------------------------------- 4. maintenance scripts + timers
install -d -o root -g root -m 755 "$LIB_DIR"
changed=0
for s in backup restore disk-guard; do
  put_file "$SRC_DIR/scripts/$s.sh" "$LIB_DIR/$s.sh" 755
done
for u in mkmovies-backup.service mkmovies-backup.timer mkmovies-disk-guard.service mkmovies-disk-guard.timer; do
  put_file "$SRC_DIR/deploy/systemd/$u" "$UNIT_DIR/$u" 644
done
[[ $changed -eq 1 ]] && systemctl daemon-reload
# shellcheck disable=SC2086 # word splitting of the timer list is intended
systemctl enable --now $TIMERS >/dev/null 2>&1 || systemctl enable --now $TIMERS
for t in $TIMERS; do
  log "$t: $(systemctl is-active "$t"), next $(systemctl show -P NextElapseUSecRealtime "$t" 2>/dev/null || echo '?')"
done

echo "CGROUP_PARENT=$cgroup_parent"
