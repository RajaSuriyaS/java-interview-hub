#!/usr/bin/env bash
# ============================================================
#  Server-side redeploy for Java Interview Hub.
#  Run on the VPS (or invoked by the GitHub Actions deploy job).
#
#    cd /root/java-interview-hub && ./deploy/redeploy.sh
#
#  Honours STANDALONE=1 to also (re)start the bundled Caddy.
# ============================================================
set -euo pipefail

REPO="${REPO:-/root/java-interview-hub}"
COMPOSE="$REPO/deploy/docker-compose.yml"
ENV_FILE="$REPO/deploy/.env"
LOG="$REPO/deploy/redeploy.log"

cd "$REPO"

[ -f "$ENV_FILE" ] || { echo "ERROR: $ENV_FILE missing. Copy deploy/.env.example -> deploy/.env and fill it in."; exit 1; }

{
  echo "======================================"
  echo "REDEPLOY at $(date '+%Y-%m-%d %H:%M:%S')"
} >> "$LOG"

# Pull latest (the workflow already does this; safe to repeat for manual runs)
for i in 1 2 3; do
  git fetch origin main && break
  echo "git fetch attempt $i failed, retrying in 10s…"; sleep 10
done
git reset --hard origin/main

export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

PROFILE_ARGS=()
if [ "${STANDALONE:-0}" = "1" ]; then
  PROFILE_ARGS=(--profile standalone)
  echo "Mode: STANDALONE (app + caddy + duckdns)"
else
  echo "Mode: SHARED (app + duckdns; external Caddy serves TLS)"
fi

docker compose -f "$COMPOSE" --env-file "$ENV_FILE" "${PROFILE_ARGS[@]}" up -d --build

# Recreate Caddy in standalone mode so a changed Caddyfile (new inode after git) is picked up
if [ "${STANDALONE:-0}" = "1" ]; then
  docker compose -f "$COMPOSE" --env-file "$ENV_FILE" --profile standalone up -d --force-recreate --no-deps caddy
fi

docker image prune -f 2>/dev/null || true

echo "Redeploy finished at $(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG"
docker compose -f "$COMPOSE" --env-file "$ENV_FILE" ps
