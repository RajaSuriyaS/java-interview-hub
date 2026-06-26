#!/usr/bin/env bash
# ============================================================
#  Set Google sign-in secrets in deploy/.env and redeploy.
#  Run on the VPS:   ./deploy/set-google-auth.sh
#
#  Prompts for the two Google values (the secret is read hidden,
#  so it never lands in your shell history), keeps or generates a
#  stable SESSION_SECRET, upserts them into deploy/.env, and
#  redeploys. Other variables in deploy/.env are left untouched.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."
ENV_FILE="deploy/.env"

[ -f "$ENV_FILE" ] || cp deploy/.env.example "$ENV_FILE"

read -rp  "GOOGLE_CLIENT_ID (…apps.googleusercontent.com): " GID
read -rsp "GOOGLE_CLIENT_SECRET (hidden): " GSEC; echo
[ -n "$GID" ] && [ -n "$GSEC" ] || { echo "Both values are required. Aborting."; exit 1; }

# Reuse an existing SESSION_SECRET if one is already set (keeps users logged in),
# otherwise generate a stable one.
if grep -q '^SESSION_SECRET=.' "$ENV_FILE"; then
  SS="$(grep '^SESSION_SECRET=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
else
  SS="$(openssl rand -hex 32)"
fi

upsert() {
  key="$1"; val="$2"
  grep -v "^${key}=" "$ENV_FILE" > "${ENV_FILE}.tmp" 2>/dev/null || true
  printf '%s=%s\n' "$key" "$val" >> "${ENV_FILE}.tmp"
  mv "${ENV_FILE}.tmp" "$ENV_FILE"
}
upsert GOOGLE_CLIENT_ID     "$GID"
upsert GOOGLE_CLIENT_SECRET "$GSEC"
upsert SESSION_SECRET       "$SS"
chmod 600 "$ENV_FILE"

echo "Updated $ENV_FILE. Redeploying…"
./deploy/redeploy.sh

echo
echo "Done. Verifying:"
curl -s http://127.0.0.1:3030/health || true
echo
echo "Expect \"googleAuth\":true above. Then add this EXACT redirect URI to your"
echo "Google OAuth client (Authorised redirect URIs):"
echo "   https://javazerotoall.duckdns.org/auth/google/callback"
