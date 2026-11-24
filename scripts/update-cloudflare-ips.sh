#!/usr/bin/env bash
# Refresh deploy/cloudflare-ips.caddy from Cloudflare's published edge ranges.
#
#   ./scripts/update-cloudflare-ips.sh            # rewrite the snippet (commit it, then deploy)
#   ./scripts/update-cloudflare-ips.sh --check    # exit 1 if the committed snippet is out of date
#
# The snippet is imported inside each mkmovies Caddy site block and aborts every connection that
# does not come from a Cloudflare edge IP (site scope only — other tenants on the box are untouched).
# Runs locally (Git Bash / Linux / macOS); needs curl. Refuses to write a suspiciously short list.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/deploy/cloudflare-ips.caddy"
CHECK=0
case "${1:-}" in
  "") ;;
  --check) CHECK=1 ;;
  -h|--help) sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
  *) echo "Unknown argument: $1" >&2; exit 2 ;;
esac
command -v curl >/dev/null || { echo "curl is required" >&2; exit 1; }

fetch() { curl -fsS --retry 3 --retry-delay 2 --max-time 20 "$1" | tr -d '\r'; }
v4="$(fetch https://www.cloudflare.com/ips-v4)"
v6="$(fetch https://www.cloudflare.com/ips-v6)"

ranges=()
while IFS= read -r r; do
  [[ -z "$r" ]] && continue
  [[ "$r" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}/[0-9]{1,2}$ ]] || { echo "Unexpected IPv4 entry: $r" >&2; exit 1; }
  ranges+=("$r")
done <<<"$v4"
n4=${#ranges[@]}
while IFS= read -r r; do
  [[ -z "$r" ]] && continue
  [[ "$r" =~ ^[0-9a-fA-F:]+/[0-9]{1,3}$ ]] || { echo "Unexpected IPv6 entry: $r" >&2; exit 1; }
  ranges+=("$r")
done <<<"$v6"
n6=$(( ${#ranges[@]} - n4 ))
(( n4 >= 10 && n6 >= 5 )) || { echo "Refusing: only $n4 IPv4 / $n6 IPv6 ranges fetched" >&2; exit 1; }

body="@notcf not remote_ip ${ranges[*]}"
new="# Managed by scripts/update-cloudflare-ips.sh — do not edit by hand.
# Cloudflare edge ranges ($n4 IPv4 + $n6 IPv6) from https://www.cloudflare.com/ips-v4 and /ips-v6.
# Imported inside each mkmovies site block; defines @notcf, which every block aborts first.
$body"

if [[ $CHECK -eq 1 ]]; then
  current="$(grep -v '^#' "$OUT" 2>/dev/null || true)"
  if [[ "$current" == "$body" ]]; then echo "cloudflare-ips.caddy is up to date ($n4 v4 / $n6 v6)."; exit 0; fi
  echo "cloudflare-ips.caddy is OUT OF DATE — run scripts/update-cloudflare-ips.sh" >&2
  exit 1
fi

printf '%s\n' "$new" > "$OUT"
echo "Wrote $OUT ($n4 IPv4 + $n6 IPv6 ranges). Commit it and re-run scripts/deploy.sh."
