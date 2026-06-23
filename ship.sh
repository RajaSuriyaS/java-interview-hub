#!/usr/bin/env bash
# ============================================================
#  Java Interview Hub — commit · push (CI auto-deploys)
#
#    ./ship.sh "your commit message"            # commit + push -> CI -> auto-deploy
#    ./ship.sh "msg" --deploy                   # also trigger an immediate SSH deploy
#    ./ship.sh --deploy-only                    # SSH deploy current main, no commit
#
#  VPS overrides: VPS_USER (root)  VPS_HOST (178.105.239.120)  VPS_PORT (22)
# ============================================================
set -euo pipefail
GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; RESET='\033[0m'
ok(){ echo -e "${GREEN}✓${RESET} $*"; }; info(){ echo -e "${CYAN}▸${RESET} $*"; }
warn(){ echo -e "${YELLOW}⚠${RESET}  $*"; }; die(){ echo -e "${RED}✗${RESET} $*">&2; exit 1; }

MSG=""; DEPLOY=false; DEPLOY_ONLY=false
for a in "$@"; do case "$a" in
  --deploy) DEPLOY=true;; --deploy-only) DEPLOY_ONLY=true;; *) MSG="$a";; esac; done

VPS_USER="${VPS_USER:-root}"; VPS_HOST="${VPS_HOST:-178.105.239.120}"; VPS_PORT="${VPS_PORT:-22}"
REPO_DIR="/root/java-interview-hub"

deploy() {
  info "SSH deploy to ${VPS_USER}@${VPS_HOST}:${VPS_PORT}"
  ssh -p "$VPS_PORT" "${VPS_USER}@${VPS_HOST}" \
    "cd ${REPO_DIR} && git fetch origin main && git reset --hard origin/main && chmod +x deploy/*.sh && STANDALONE=\${STANDALONE:-0} ./deploy/redeploy.sh"
  ok "Deploy complete"
}

if $DEPLOY_ONLY; then deploy; exit 0; fi
[ -n "$MSG" ] || die "Provide a commit message:  ./ship.sh \"message\""

info "Validating before push…"
node --check server.js && node --check public/js/curriculum.js && node --check public/js/app.js
ok "JS syntax OK"

git add -A
if git diff --cached --quiet; then warn "Nothing to commit"; else
  git commit -m "$MSG"$'\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>'
  ok "Committed"
fi
info "Pushing to origin/main…"; git push origin main; ok "Pushed (CI will auto-deploy)"
$DEPLOY && deploy || true
