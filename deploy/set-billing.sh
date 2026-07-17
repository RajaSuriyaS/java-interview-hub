#!/usr/bin/env bash
# ============================================================
#  Set Stripe / Razorpay billing secrets in deploy/.env and redeploy.
#  Run on the VPS:   ./deploy/set-billing.sh
#
#  Prompts for each provider's values (secrets are read hidden, so they
#  never land in your shell history), upserts them into deploy/.env, and
#  redeploys. Either provider can be skipped by leaving its first field
#  blank — so you can add Stripe now and Razorpay later (or just one).
#  Values you leave blank are NOT written, so existing settings survive.
#  Other variables in deploy/.env are left untouched.
#
#  A provider goes live only when ALL of its required fields are present:
#    Stripe   : STRIPE_SECRET_KEY + at least one STRIPE_PRICE_*
#    Razorpay : RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET + at least one RAZORPAY_PLAN_*
#  Use TEST-mode keys first, run a full test purchase, THEN swap to live keys.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."
ENV_FILE="deploy/.env"
DOMAIN="${PUBLIC_DOMAIN:-javazerotoall.duckdns.org}"

[ -f "$ENV_FILE" ] || cp deploy/.env.example "$ENV_FILE"

upsert() {  # upsert KEY VALUE  — only writes when VALUE is non-empty
  key="$1"; val="$2"
  [ -n "$val" ] || return 0
  grep -v "^${key}=" "$ENV_FILE" > "${ENV_FILE}.tmp" 2>/dev/null || true
  printf '%s=%s\n' "$key" "$val" >> "${ENV_FILE}.tmp"
  mv "${ENV_FILE}.tmp" "$ENV_FILE"
  echo "  set $key"
}

echo "=============================================="
echo " Billing setup — Stripe & Razorpay"
echo " Leave a provider's first field blank to skip it."
echo "=============================================="
echo
echo "--- Stripe (card payments, global) ------------"
read -rsp "STRIPE_SECRET_KEY (sk_test_… / sk_live_…, hidden, blank=skip): " S_KEY; echo
if [ -n "$S_KEY" ]; then
  read -rp  "STRIPE_PRICE_MONTHLY (price_…): " S_PM
  read -rp  "STRIPE_PRICE_YEARLY  (price_…): " S_PY
  read -rsp "STRIPE_WEBHOOK_SECRET (whsec_…, hidden): " S_WH; echo
  [ -n "$S_PM$S_PY" ] || { echo "  ! At least one Stripe price id is required — skipping Stripe."; S_KEY=""; }
  if [ -n "$S_KEY" ]; then
    upsert STRIPE_SECRET_KEY    "$S_KEY"
    upsert STRIPE_PRICE_MONTHLY "$S_PM"
    upsert STRIPE_PRICE_YEARLY  "$S_PY"
    upsert STRIPE_WEBHOOK_SECRET "$S_WH"
  fi
else
  echo "  (skipped Stripe)"
fi

echo
echo "--- Razorpay (UPI + cards, India) -------------"
read -rp  "RAZORPAY_KEY_ID (rzp_test_… / rzp_live_…, blank=skip): " R_ID
if [ -n "$R_ID" ]; then
  read -rsp "RAZORPAY_KEY_SECRET (hidden): " R_SEC; echo
  read -rp  "RAZORPAY_PLAN_MONTHLY (plan_…): " R_PM
  read -rp  "RAZORPAY_PLAN_YEARLY  (plan_…): " R_PY
  read -rsp "RAZORPAY_WEBHOOK_SECRET (you choose this string, hidden): " R_WH; echo
  if [ -z "$R_SEC" ] || [ -z "$R_PM$R_PY" ]; then
    echo "  ! Razorpay needs a secret and at least one plan id — skipping Razorpay."
  else
    upsert RAZORPAY_KEY_ID         "$R_ID"
    upsert RAZORPAY_KEY_SECRET     "$R_SEC"
    upsert RAZORPAY_PLAN_MONTHLY   "$R_PM"
    upsert RAZORPAY_PLAN_YEARLY    "$R_PY"
    upsert RAZORPAY_WEBHOOK_SECRET "$R_WH"
  fi
else
  echo "  (skipped Razorpay)"
fi

echo
echo "--- Optional display labels (cosmetic) --------"
read -rp "PRICE_MONTHLY_LABEL [\$9] (blank=keep): " L_M
read -rp "PRICE_YEARLY_LABEL  [\$75] (blank=keep): " L_Y
upsert PRICE_MONTHLY_LABEL "$L_M"
upsert PRICE_YEARLY_LABEL  "$L_Y"

chmod 600 "$ENV_FILE"
echo
echo "Updated $ENV_FILE. Redeploying…"
./deploy/redeploy.sh

echo
echo "Verifying provider status (expect stripe:true / razorpay:true for what you set):"
curl -s http://127.0.0.1:3030/api/billing/config || true
echo
echo
echo "Next — add these webhook endpoints in each dashboard (events matter):"
echo "  Stripe   -> https://${DOMAIN}/api/billing/webhook/stripe"
echo "     events: checkout.session.completed, customer.subscription.created,"
echo "             customer.subscription.updated, customer.subscription.deleted"
echo "  Razorpay -> https://${DOMAIN}/api/billing/webhook/razorpay"
echo "     events: subscription.activated, subscription.charged, subscription.resumed,"
echo "             subscription.cancelled, subscription.completed, subscription.halted,"
echo "             subscription.expired"
echo
echo "The Razorpay webhook secret must MATCH the RAZORPAY_WEBHOOK_SECRET you entered above."
echo "Then test a purchase (Stripe card 4242 4242 4242 4242) before switching to live keys."
