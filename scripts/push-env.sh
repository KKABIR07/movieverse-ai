#!/usr/bin/env bash
# Securely push selected secrets from a local env file to the remote /opt/mkmovies/.env.
#
#   ./scripts/push-env.sh                        # push the default key set from ./.env.production
#   ./scripts/push-env.sh GROQ_API_KEY YOUTUBE_API_KEY
#   ./scripts/push-env.sh --restart              # also recreate the web container so it picks them up
#   ./scripts/push-env.sh --dry-run              # list which keys would be pushed (never values)
#
# Env overrides: ENV_FILE (default .env.production, gitignored), DEPLOY_HOST, DEPLOY_USER,
# DEPLOY_KEY, APP_DIR.
#
# Values travel ONLY over ssh stdin — never as command-line arguments (which would be visible in
# `ps` on both machines) — and are never echoed. Keys are merged: listed keys are replaced,
# every other remote key is kept. Empty local values are skipped so they cannot blank a remote
# secret. The remote file stays chmod 600.
set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:-163.192.105.150}"
DEPLOY_USER="${DEPLOY_USER:-ubuntu}"
DEPLOY_KEY="${DEPLOY_KEY:-/d/DOWNLOAD/Rizuan-oci-vps/ssh-key-2026-11-11.key}"
APP_DIR="${APP_DIR:-/opt/mkmovies}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/.env.production}"
# POSTGRES_PASSWORD / DATABASE_URL are generated on the box by deploy.sh and are NOT pushed by default
# (changing POSTGRES_PASSWORD after initdb would lock the app out). Name them explicitly only to restore them.
DEFAULT_KEYS="TMDB_BEARER TMDB_API_KEY JWT_SECRET GROQ_API_KEY YOUTUBE_API_KEY SITE_URL NEXT_PUBLIC_SITE_URL"

RESTART=0
DRY_RUN=0
KEYS=()
for arg in "$@"; do
  case "$arg" in
    --restart) RESTART=1 ;;
    --dry-run) DRY_RUN=1 ;;
    -h|--help) sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*) echo "Unknown flag: $arg" >&2; exit 2 ;;
    *) [[ "$arg" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || { echo "Invalid key name: $arg" >&2; exit 2; }; KEYS+=("$arg") ;;
  esac
done
[[ ${#KEYS[@]} -gt 0 ]] || read -r -a KEYS <<<"$DEFAULT_KEYS"

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
[[ -f "$ENV_FILE" ]] || die "local env file not found: $ENV_FILE"
[[ "$APP_DIR" =~ ^/[A-Za-z0-9/_.-]+$ ]] || die "APP_DIR invalid: $APP_DIR"

# Build the payload in memory: KEY=VALUE lines for the selected, non-empty keys.
payload=""
pushed=()
skipped=()
for k in "${KEYS[@]}"; do
  line="$(grep -E "^(export[[:space:]]+)?$k=" "$ENV_FILE" | tail -1 | tr -d '\r' || true)"
  line="${line#export }"
  value="${line#*=}"
  if [[ -z "$line" || -z "$value" ]]; then skipped+=("$k"); continue; fi
  payload+="$k=$value"$'\n'
  pushed+=("$k")
done
unset line value

echo "Keys to push (${#pushed[@]}): ${pushed[*]:-none}"
[[ ${#skipped[@]} -eq 0 ]] || echo "Skipped (missing/empty locally): ${skipped[*]}"
[[ ${#pushed[@]} -gt 0 ]] || die "nothing to push"
if [[ $DRY_RUN -eq 1 ]]; then echo "Dry run: nothing sent."; exit 0; fi
[[ -f "$DEPLOY_KEY" ]] || die "SSH key not found: $DEPLOY_KEY"

# The remote script is a command-line argument (it contains no secrets); the secrets arrive on stdin.
REMOTE_SCRIPT='set -euo pipefail
umask 077
cd "'"$APP_DIR"'"
new="$(mktemp .env.push.XXXXXX)"
trap '"'"'rm -f "$new" .env.merge.tmp'"'"' EXIT
cat > "$new"
touch .env
# Keep every existing line whose key is not being pushed, then append the pushed lines.
awk -F= '"'"'NR==FNR { if ($1 != "") seen[$1]=1; next } !($1 in seen)'"'"' "$new" .env > .env.merge.tmp
cat "$new" >> .env.merge.tmp
cat .env.merge.tmp > .env
chmod 600 .env
echo "remote .env updated ($(grep -c "=" .env) keys, mode $(stat -c %a .env))"'
if [[ $RESTART -eq 1 ]]; then
  REMOTE_SCRIPT+=$'\n''docker compose -p mkmovies --env-file .env up -d --no-build --no-deps web && echo "web container recreated"'
fi

printf '%s' "$payload" | ssh -i "$DEPLOY_KEY" -o BatchMode=yes -o ConnectTimeout=20 -o StrictHostKeyChecking=accept-new \
  "$DEPLOY_USER@$DEPLOY_HOST" "bash -c $(printf '%q' "$REMOTE_SCRIPT")"
payload=""
[[ $RESTART -eq 1 ]] || echo "Run './scripts/deploy.sh' (or re-run with --restart) for the container to pick up the new values."
