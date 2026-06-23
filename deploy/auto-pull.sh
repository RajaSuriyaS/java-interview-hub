#!/usr/bin/env bash
# ============================================================
#  Auto-deploy poller — invoked by the systemd timer every minute.
#  Fetches origin/main; if there are new commits, runs redeploy.sh.
#  This is what makes "push to GitHub -> live on VPS" automatic
#  without needing any GitHub-side secrets.
# ============================================================
set -euo pipefail

REPO="${REPO:-/root/java-interview-hub}"
LOG="${REPO}/deploy/auto-pull.log"
cd "$REPO"

git fetch origin main --quiet
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
  exit 0   # already up to date
fi

{
  echo "======================================"
  echo "$(date '+%F %T') new commit detected: ${REMOTE:0:8} (was ${LOCAL:0:8}) — deploying"
} >> "$LOG"

# redeploy.sh resets to origin/main and rebuilds. STANDALONE is inherited from the unit.
./deploy/redeploy.sh >> "$LOG" 2>&1

echo "$(date '+%F %T') deploy finished" >> "$LOG"
