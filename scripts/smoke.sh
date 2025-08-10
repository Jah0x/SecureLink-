#!/usr/bin/env bash
set -euo pipefail

APP_IP_BASE="${APP_IP_BASE:-http://146.103.118.77:30082}"
APP_DOM_BASE="${APP_DOM_BASE:-http://dashboard.zerologsvpn.com}"
HANKO_IP_BASE="${HANKO_IP_BASE:-http://146.103.118.77:30083}"

ok() { echo -e "\033[32m✔ $*\033[0m"; }
fail() { echo -e "\033[31m✘ $*\033[0m"; exit 1; }

jq_has() { echo "$1" | jq -e "$2" >/dev/null 2>&1; }

echo "== Health =="
curl -sfI "$APP_IP_BASE/healthz" >/dev/null && ok "healthz via NodePort OK" || fail "healthz failed"

REDIR_ENC=$(python3 - <<'PY'
import urllib.parse as u; print(u.quote("https://dashboard.zerologsvpn.com/thirdparty/callback", safe=""))
PY
)

echo "== Redirect URL (NodePort) =="
RESP_IP=$(curl -sf "$APP_IP_BASE/thirdparty/google/redirect_url?redirect_url=$REDIR_ENC") || fail "alias (ip) req failed"
echo "$RESP_IP" | jq . >/dev/null || fail "alias (ip) not JSON"
jq_has "$RESP_IP" '.redirectUrl | startswith("https://accounts.google.com/")' || fail "alias (ip) wrong redirectUrl"
ok "alias (ip) redirectUrl OK"

echo "== Redirect URL (domain) =="
RESP_DOM=$(curl -sf "$APP_DOM_BASE/thirdparty/google/redirect_url?redirect_url=$REDIR_ENC") || fail "alias (domain) req failed"
echo "$RESP_DOM" | jq . >/dev/null || fail "alias (domain) not JSON"
jq_has "$RESP_DOM" '.redirectUrl | startswith("https://accounts.google.com/")' || fail "alias (domain) wrong redirectUrl"
ok "alias (domain) redirectUrl OK"

echo "== Hanko authorisation (direct) =="
RESP_H=$(curl -sf "$HANKO_IP_BASE/thirdparty/authorisationurl?thirdPartyId=google&redirectURIOnProviderDashboard=$REDIR_ENC") || fail "hanko authorisation req failed"
echo "$RESP_H" | jq . >/dev/null || fail "hanko response not JSON"
ok "hanko authorisation reachable"

echo "== Users/me before login =="
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$APP_DOM_BASE/api/users/me" || true)
[ "$CODE" = "401" ] && ok "users/me returns 401 before login" || echo "users/me http=$CODE (ok if 401)"

echo "== Sessions without code (negative) =="
CODE2=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H 'content-type: application/json' \
  -d '{}' "$APP_DOM_BASE/api/sessions" || true)
[ "$CODE2" = "400" ] && ok "sessions without code → 400 (expected)" || echo "sessions http=$CODE2"

echo "All checks completed."
