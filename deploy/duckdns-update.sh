#!/usr/bin/env bash
# ============================================================
#  Bare-metal DuckDNS updater (alternative to the duckdns container).
#  Use this if you are NOT running the dockerised duckdns service.
#
#  Setup:
#    1. export DUCKDNS_SUBDOMAINS=javahub  DUCKDNS_TOKEN=xxxx
#       (or hard-code below)
#    2. Add to crontab to run every 5 minutes:
#         */5 * * * * DUCKDNS_SUBDOMAINS=javahub DUCKDNS_TOKEN=xxxx \
#                     /root/java-interview-hub/deploy/duckdns-update.sh >> /var/log/duckdns.log 2>&1
# ============================================================
set -euo pipefail

SUBDOMAINS="${DUCKDNS_SUBDOMAINS:?set DUCKDNS_SUBDOMAINS (e.g. javahub)}"
TOKEN="${DUCKDNS_TOKEN:?set DUCKDNS_TOKEN}"

RESPONSE=$(curl -s "https://www.duckdns.org/update?domains=${SUBDOMAINS}&token=${TOKEN}&ip=")
echo "$(date '+%Y-%m-%d %H:%M:%S') duckdns[${SUBDOMAINS}] -> ${RESPONSE}"
[ "$RESPONSE" = "OK" ] || { echo "DuckDNS update failed: $RESPONSE"; exit 1; }
