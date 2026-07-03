#!/usr/bin/env bash
# ============================================================
#  Enable SafeStrike-style automatic deploy on this VPS.
#  Run ONCE on the VPS (as root):   ./deploy/install-autodeploy.sh
#
#  Installs + enables the systemd timer that polls GitHub main
#  every minute and redeploys on new commits. Idempotent — safe
#  to re-run. After this, every `git push` to main is live on
#  the site within ~60 seconds, no manual steps.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."
REPO_DIR="$(pwd)"

[ "$(id -u)" = 0 ] || { echo "Run as root (sudo)."; exit 1; }
command -v docker >/dev/null || { echo "Docker not found — install Docker first."; exit 1; }

echo "== 1) Install systemd units (REPO=$REPO_DIR)"
chmod +x deploy/*.sh
# Rewrite the repo path in the unit in case the repo doesn't live at /root/java-interview-hub
sed "s|/root/java-interview-hub|$REPO_DIR|g" deploy/systemd/jih-autodeploy.service > /etc/systemd/system/jih-autodeploy.service
cp deploy/systemd/jih-autodeploy.timer /etc/systemd/system/jih-autodeploy.timer
systemctl daemon-reload

echo "== 2) Enable + start the timer"
systemctl enable --now jih-autodeploy.timer

echo "== 3) Run one deploy right now (so you don't wait for the first tick)"
./deploy/auto-pull.sh || ./deploy/redeploy.sh

echo
echo "== 4) Status"
systemctl status jih-autodeploy.timer --no-pager | head -6
systemctl list-timers jih-autodeploy.timer --no-pager | head -3
echo
curl -s http://127.0.0.1:3030/health || true
echo
echo "✅ Auto-deploy is ON. Every push to main goes live within ~60s."
echo "   Watch it:   tail -f $REPO_DIR/deploy/auto-pull.log"
echo "   Disable:    systemctl disable --now jih-autodeploy.timer"
