#!/usr/bin/env bash
# Hard 5 GiB storage cap for mkmovies on the OCI box (run ON the box as root; deploy.sh does this).
#
#   sudo bash setup-storage.sh [owner]        # owner defaults to "ubuntu"
#
# Creates a fully-allocated 5 GiB ext4 image at $IMG and loop-mounts it at $MNT via /etc/fstab.
# Everything mkmovies keeps on disk (extracted source, .env, future data/backups) lives inside
# this filesystem, so it can never grow past 5 GiB. Idempotent: safe to run on every deploy.
#
# Env overrides: IMG, MNT, SIZE_GIB.
set -euo pipefail

IMG="${IMG:-/var/lib/mkmovies/disk.img}"
MNT="${MNT:-/opt/mkmovies}"
SIZE_GIB="${SIZE_GIB:-5}"
OWNER="${1:-ubuntu}"
FSTAB_LINE="$IMG $MNT ext4 loop,nodev,nosuid,noatime,nofail 0 2"

log() { printf '[setup-storage] %s\n' "$*"; }
die() { printf '[setup-storage] ERROR: %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "must run as root (sudo)"
[[ "$SIZE_GIB" =~ ^[0-9]+$ ]] || die "SIZE_GIB must be an integer"
id "$OWNER" >/dev/null 2>&1 || die "owner '$OWNER' does not exist"
for bin in fallocate mkfs.ext4 mountpoint findmnt; do
  command -v "$bin" >/dev/null || die "missing required tool: $bin"
done

# 1. Backing image (fully allocated with fallocate, so the 5 GiB is reserved on the host disk
#    up front and the app can never hit ENOSPC because a *neighbour* filled the root disk).
if [[ ! -f "$IMG" ]]; then
  mkdir -p "$(dirname "$IMG")"
  chmod 700 "$(dirname "$IMG")"
  need_kib=$(( (SIZE_GIB + 1) * 1024 * 1024 ))   # image + 1 GiB headroom for the host
  free_kib=$(df --output=avail -k "$(dirname "$IMG")" | tail -1 | tr -d ' ')
  (( free_kib > need_kib )) || die "not enough free space for a ${SIZE_GIB} GiB image (+1 GiB headroom)"
  log "creating ${SIZE_GIB} GiB image $IMG"
  fallocate -l "${SIZE_GIB}G" "$IMG"
  chmod 600 "$IMG"
  mkfs.ext4 -q -F -m 0 -L mkmovies "$IMG"
else
  log "image exists: $IMG"
fi

# 2. fstab entry (exactly one line for this mount point).
if ! grep -qxF "$FSTAB_LINE" /etc/fstab; then
  log "registering $MNT in /etc/fstab"
  cp /etc/fstab "/etc/fstab.bak-$(date +%Y%m%d%H%M%S)-mkmovies"
  # Drop any stale line for this mount point, then append ours.
  awk -v mnt="$MNT" '!($2 == mnt && $0 !~ /^[[:space:]]*#/)' /etc/fstab > /etc/fstab.mkmovies.tmp
  echo "$FSTAB_LINE" >> /etc/fstab.mkmovies.tmp
  cat /etc/fstab.mkmovies.tmp > /etc/fstab && rm -f /etc/fstab.mkmovies.tmp
  command -v systemctl >/dev/null && systemctl daemon-reload || true
fi

# 3. Mount. If $MNT already holds files from an earlier, uncapped deploy, migrate them in.
if mountpoint -q "$MNT"; then
  src="$(findmnt -n -o SOURCE --target "$MNT")"
  back="$(losetup -n -O BACK-FILE "$src" 2>/dev/null | tr -d ' ' || true)"
  if [[ "$back" != "$IMG" ]]; then
    die "$MNT is already a mount point backed by '$src' (not $IMG); refusing to touch it"
  fi
  log "$MNT already mounted from $IMG"
else
  mkdir -p "$MNT"
  stash=""
  if [[ -n "$(ls -A "$MNT" 2>/dev/null)" ]]; then
    stash="$(mktemp -d /var/lib/mkmovies/migrate.XXXXXX)"
    log "migrating existing contents of $MNT into the capped filesystem"
    cp -a "$MNT"/. "$stash"/
    find "$MNT" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  fi
  mount "$MNT"
  if [[ -n "$stash" ]]; then
    cp -a "$stash"/. "$MNT"/
    rm -rf "$stash"
  fi
  log "mounted $IMG at $MNT"
fi

# 4. Ownership: the deploy user owns the tree (the image root dir itself included).
chown "$OWNER:$OWNER" "$MNT"
chmod 750 "$MNT"

df -h "$MNT" | sed 's/^/[setup-storage] /'
