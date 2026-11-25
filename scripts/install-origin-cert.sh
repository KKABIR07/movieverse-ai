#!/usr/bin/env bash
# Install the Cloudflare Origin Certificate for mkmovies.site (+ *.mkmovies.site) on the OCI box.
#
#   ./scripts/install-origin-cert.sh <origin-cert.pem> <origin-key.pem>
#
# Create the certificate in Cloudflare: SSL/TLS -> Origin Server -> Create Certificate
# (RSA 2048 or ECC, hostnames mkmovies.site + *.mkmovies.site, validity 15 years), save the
# certificate and the private key to two local files (keep them OUT of the repo), then run this.
#
# Both files travel only over ssh stdin (never as command-line arguments, never echoed). On the
# box they land in /etc/caddy/certs (dir 750 root:caddy, cert 644, key 640 root:caddy). The pair
# is verified (x509 parse, not expired, key matches cert) before it replaces anything, and Caddy
# is validated + reloaded afterwards; on failure the previous files are restored.
#
# Env overrides: DEPLOY_HOST, DEPLOY_USER, DEPLOY_KEY.
set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:-163.192.105.150}"
DEPLOY_USER="${DEPLOY_USER:-ubuntu}"
DEPLOY_KEY="${DEPLOY_KEY:-/d/DOWNLOAD/Rizuan-oci-vps/ssh-key-2026-11-11.key}"
CERT_DIR=/etc/caddy/certs
NAME=mkmovies.site

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
[[ "${1:-}" == "-h" || "${1:-}" == "--help" ]] && { sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'; exit 0; }
[[ $# -eq 2 ]] || die "usage: $0 <origin-cert.pem> <origin-key.pem>"
CERT_FILE="$1"
KEY_FILE="$2"
[[ -s "$CERT_FILE" ]] || die "certificate file not found or empty: $CERT_FILE"
[[ -s "$KEY_FILE" ]] || die "key file not found or empty: $KEY_FILE"
grep -q -- '-----BEGIN CERTIFICATE-----' "$CERT_FILE" || die "$CERT_FILE is not a PEM certificate"
grep -qE -- '-----BEGIN (RSA |EC )?PRIVATE KEY-----' "$KEY_FILE" || die "$KEY_FILE is not a PEM private key"
[[ -f "$DEPLOY_KEY" ]] || die "SSH key not found: $DEPLOY_KEY"
SSH=(ssh -i "$DEPLOY_KEY" -o BatchMode=yes -o ConnectTimeout=20 -o StrictHostKeyChecking=accept-new "$DEPLOY_USER@$DEPLOY_HOST")

echo "==> Upload to staging files in $CERT_DIR (stdin only)"
"${SSH[@]}" "sudo install -d -o root -g caddy -m 750 $CERT_DIR"
tr -d '\r' <"$CERT_FILE" | "${SSH[@]}" "sudo sh -c 'umask 022; cat > $CERT_DIR/.$NAME.pem.new'"
tr -d '\r' <"$KEY_FILE"  | "${SSH[@]}" "sudo sh -c 'umask 077; cat > $CERT_DIR/.$NAME.key.new'"

echo "==> Verify pair, install, validate + reload Caddy"
"${SSH[@]}" "CERT_DIR=$CERT_DIR NAME=$NAME bash -s" <<'EOF'
set -euo pipefail
C="$CERT_DIR/$NAME.pem"; K="$CERT_DIR/$NAME.key"
NC="$CERT_DIR/.$NAME.pem.new"; NK="$CERT_DIR/.$NAME.key.new"
cleanup() { sudo rm -f "$NC" "$NK"; }
trap cleanup EXIT

sudo openssl x509 -noout -subject -enddate -in "$NC"
sudo openssl x509 -noout -ext subjectAltName -in "$NC" 2>/dev/null | tail -n +2 | sed 's/^ */SAN: /' || true
sudo openssl x509 -noout -checkend 0 -in "$NC" >/dev/null || { echo "certificate is EXPIRED" >&2; exit 1; }
cert_pub="$(sudo openssl x509 -noout -pubkey -in "$NC" | sha256sum | cut -d' ' -f1)"
key_pub="$(sudo openssl pkey -pubout -in "$NK" 2>/dev/null | sha256sum | cut -d' ' -f1)"
[ "$cert_pub" = "$key_pub" ] || { echo "private key does NOT match the certificate" >&2; exit 1; }
echo "key matches certificate"

STAMP="$(date +%Y%m%d%H%M%S)"
had_old=0
if sudo test -f "$C"; then sudo cp -p "$C" "$C.bak-$STAMP"; sudo cp -p "$K" "$K.bak-$STAMP"; had_old=1; fi
sudo install -o root -g root  -m 644 "$NC" "$C"
sudo install -o root -g caddy -m 640 "$NK" "$K"

restore() {
  if [ "$had_old" = 1 ]; then sudo cp -p "$C.bak-$STAMP" "$C"; sudo cp -p "$K.bak-$STAMP" "$K"; fi
}
# As the caddy user (like the live server): a root validate can leave root-owned log files behind.
if ! sudo -u caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>/tmp/mkmovies-cert-validate.log; then
  echo "caddy validate FAILED with the new certificate — restoring previous files" >&2
  tail -5 /tmp/mkmovies-cert-validate.log >&2
  restore
  exit 1
fi
sudo systemctl reload caddy
echo "installed $C (644) and $K (640 root:caddy); Caddy reloaded"
EOF
echo "Done. Next: ./scripts/deploy.sh (installs/updates the mkmovies Caddy block)."
