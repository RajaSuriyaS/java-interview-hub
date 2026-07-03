#!/usr/bin/env bash
# ============================================================
#  Google Auth Doctor — diagnose & fix Google sign-in on the VPS.
#  Run on the VPS:   ./deploy/google-auth-doctor.sh
#
#  It pulls the latest code, makes sure GOOGLE_CLIENT_ID /
#  GOOGLE_CLIENT_SECRET / SESSION_SECRET / REQUIRE_AUTH are in
#  deploy/.env, redeploys with --force-recreate (so the env
#  actually applies), then shows what the running container sees
#  and whether sign-in is live. Paste its output if anything is red.
# ============================================================
set -uo pipefail
cd "$(dirname "$0")/.."
ENV_FILE="deploy/.env"
APP="jih-app"
BASE="http://127.0.0.1:3030"
say(){ printf '\n\033[1m== %s ==\033[0m\n' "$*"; }

say "1) Pull latest code"
git fetch origin main --quiet && git reset --hard origin/main --quiet
echo "   on $(git rev-parse --short HEAD) — $(git log -1 --format=%s | cut -c1-58)"

[ -f "$ENV_FILE" ] || cp deploy/.env.example "$ENV_FILE"

upsert(){ k="$1"; v="$2"; grep -v "^${k}=" "$ENV_FILE" > "${ENV_FILE}.tmp" 2>/dev/null || true; printf '%s=%s\n' "$k" "$v" >> "${ENV_FILE}.tmp"; mv "${ENV_FILE}.tmp" "$ENV_FILE"; }
has(){ grep -q "^$1=." "$ENV_FILE"; }

say "2) Credentials in $ENV_FILE"
# --reset forces re-entering both values (use when Google says the secret is invalid).
if [ "${1:-}" = "--reset" ]; then
  echo "   --reset: re-entering credentials (old values will be overwritten)."
  read -rp  "   GOOGLE_CLIENT_ID (…apps.googleusercontent.com): " GID
  read -rsp "   GOOGLE_CLIENT_SECRET (hidden — paste once, press Enter): " GSEC; echo
  if [ -z "${GID:-}" ] || [ -z "${GSEC:-}" ]; then echo "   Both are required. Aborting."; exit 1; fi
  # strip stray whitespace/CR that breaks the secret
  GID=$(printf '%s' "$GID" | tr -d '[:space:]')
  GSEC=$(printf '%s' "$GSEC" | tr -d '[:space:]')
  upsert GOOGLE_CLIENT_ID     "$GID"
  upsert GOOGLE_CLIENT_SECRET "$GSEC"
elif has GOOGLE_CLIENT_ID && has GOOGLE_CLIENT_SECRET; then
  echo "   GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are present."
  echo "   (Google rejecting the secret? Re-run with:  ./deploy/google-auth-doctor.sh --reset)"
else
  echo "   Missing — enter them now (the secret is typed hidden):"
  read -rp  "   GOOGLE_CLIENT_ID (…apps.googleusercontent.com): " GID
  read -rsp "   GOOGLE_CLIENT_SECRET: " GSEC; echo
  if [ -z "${GID:-}" ] || [ -z "${GSEC:-}" ]; then echo "   Both are required. Aborting."; exit 1; fi
  upsert GOOGLE_CLIENT_ID     "$GID"
  upsert GOOGLE_CLIENT_SECRET "$GSEC"
fi
has SESSION_SECRET || upsert SESSION_SECRET "$(openssl rand -hex 32)"
has REQUIRE_AUTH   || upsert REQUIRE_AUTH true
chmod 600 "$ENV_FILE"

say "2b) Validate the id+secret pair against Google (before deploying anything)"
# Trick: POST a bogus auth code to the token endpoint. If Google answers
# invalid_grant, the CLIENT ID + SECRET are CORRECT (only the code was bad).
# If it answers invalid_client, the secret does not match the client id.
GID_VAL=$(grep '^GOOGLE_CLIENT_ID='     "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '[:space:]')
GSEC_VAL=$(grep '^GOOGLE_CLIENT_SECRET=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '[:space:]')
RESP=$(curl -s --max-time 15 -X POST https://oauth2.googleapis.com/token \
  -d code=bogus-validation-probe -d grant_type=authorization_code \
  -d redirect_uri=https://localhost/validate \
  -d client_id="$GID_VAL" -d client_secret="$GSEC_VAL" || echo curl-failed)
if echo "$RESP" | grep -q 'invalid_client\|client secret is invalid\|Unauthorized'; then
  echo "   ❌ Google REJECTS this id+secret pair (invalid_client)."
  echo "      The secret in deploy/.env does not belong to this client id."
  echo "      In Google console: open the client, click 'Reset secret', copy the NEW value"
  echo "      (the old masked one cannot be copied), then re-run: $0 --reset"
  exit 1
elif echo "$RESP" | grep -q 'invalid_grant'; then
  echo "   ✅ Google ACCEPTS the client id + secret (test code rejected as expected)."
elif echo "$RESP" | grep -q 'curl-failed'; then
  echo "   ⚠ Could not reach Google to validate (network) — continuing anyway."
else
  echo "   ⚠ Unexpected validation response (continuing): $(echo "$RESP" | head -c 160)"
fi
echo "   deploy/.env now contains:"
grep -E '^(GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET|SESSION_SECRET|REQUIRE_AUTH)=' "$ENV_FILE" \
  | sed 's/=.*/=<set>/' | sed 's/^/      /'

say "3) Redeploy (force-recreate so the new env is applied)"
./deploy/redeploy.sh || echo "   redeploy.sh reported an error — see deploy/redeploy.log"

say "4) What the RUNNING CONTAINER actually sees"
if docker exec "$APP" sh -c 'true' 2>/dev/null; then
  got=$(docker exec "$APP" printenv 2>/dev/null | grep -E '^(GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET|REQUIRE_AUTH)=' | sed 's/=.*/=<set>/')
  if [ -n "$got" ]; then echo "$got" | sed 's/^/   /'; else echo "   ⚠ NONE of the Google vars are in the container — env not reaching it."; fi
else
  echo "   ⚠ Could not exec into '$APP'. Is it running?  docker ps"
fi

say "5) Live status"
sleep 2
echo "   /health  -> $(curl -s $BASE/health)"
echo "   /auth/me -> $(curl -s $BASE/auth/me)"

say "Verdict"
if curl -s $BASE/health | grep -q '"googleAuth":true'; then
  echo "   ✅ Google sign-in is ENABLED on the server."
  curl -s $BASE/auth/me | grep -q '"requireLogin":true' \
    && echo "   ✅ Login wall is ON (signed-out visitors get the sign-in page)." \
    || echo "   ⚠ Login wall is OFF — REQUIRE_AUTH not active; it was just set, re-run if needed."
  echo
  echo "   Final step (Google side): the OAuth client's Authorised redirect URIs must include EXACTLY:"
  echo "        https://javazerotoall.duckdns.org/auth/google/callback"
  echo "   (confirm with:  curl -s $BASE/auth/debug | grep derivedCallbackUrl )"
else
  echo "   ❌ Still not enabled. Use section 4 above:"
  echo "      • container shows the vars as <set> but /health says false  → restart: docker restart $APP"
  echo "      • container shows NONE set                                  → env didn't reach it; run:"
  echo "          docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.shared.yml \\"
  echo "            --env-file deploy/.env up -d --force-recreate --no-deps app"
  echo "      • paste sections 2, 4 and 5 here and I'll pinpoint it."
fi
