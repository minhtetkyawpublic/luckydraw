#!/usr/bin/env bash
set -euo pipefail

APP_URL="${APP_URL:-${APP_DOMAIN:-http://127.0.0.1}}"
API_BASE="$APP_URL/api"
RETRY_SECONDS=5
MAX_RETRIES=3
ADMIN_COOKIE_FILE="/tmp/phase4-admin-cookies-$$.txt"

check_endpoint() {
  local label="$1"
  local url="$2"
  local i=1

  while true; do
    status=$(curl -s -o /tmp/phase4-smoke-$$.txt -w "%{http_code}" "$url" || true)
    if [[ "$status" == "200" ]]; then
      echo "[smoke][$label] ok"
      rm -f /tmp/phase4-smoke-$$.txt
      return 0
    fi

    if (( i >= MAX_RETRIES )); then
      echo "[smoke][$label] failed with status=$status"
      if [[ -f /tmp/phase4-smoke-$$.txt ]]; then
        echo "--- response body ---"
        cat /tmp/phase4-smoke-$$.txt
      fi
      rm -f /tmp/phase4-smoke-$$.txt
      return 1
    fi

    echo "[smoke][$label] retrying ($i/$MAX_RETRIES)"
    sleep "$RETRY_SECONDS"
    i=$((i + 1))
  done
}

check_endpoint "health" "$API_BASE/health"
check_endpoint "route_cache_smoke" "$APP_URL"

if [[ -n "${RUN_PHASE4_SMOKE_ADMIN_EMAIL:-}" && -n "${RUN_PHASE4_SMOKE_ADMIN_PASSWORD:-}" ]]; then
  login_payload="{\"email_or_phone\":\"${RUN_PHASE4_SMOKE_ADMIN_EMAIL}\",\"password\":\"${RUN_PHASE4_SMOKE_ADMIN_PASSWORD}\"}"
  login_code=$(curl -s -o /tmp/phase4-admin-login-$$.txt -c "$ADMIN_COOKIE_FILE" -H "Content-Type: application/json" -d "$login_payload" -w "%{http_code}" "$API_BASE/auth/login" || true)

  if [[ "$login_code" != "200" ]]; then
    echo "[smoke][admin-login] failed with status=$login_code"
    cat /tmp/phase4-admin-login-$$.txt
    rm -f /tmp/phase4-admin-login-$$.txt "$ADMIN_COOKIE_FILE"
    exit 1
  fi
  rm -f /tmp/phase4-admin-login-$$.txt
elif [[ -n "${RUN_PHASE4_SMOKE_ADMIN_TOKEN:-}" ]]; then
  token="${RUN_PHASE4_SMOKE_ADMIN_TOKEN:-}"
  if [[ -z "$token" ]]; then
    echo "[smoke][admin-health] invalid token value"
    exit 1
  fi

  admin_code=$(curl -s -o /tmp/phase4-admin-smoke-$$.txt -H "Authorization: Bearer $token" -w "%{http_code}" "$API_BASE/admin/reports/health" || true)
  if [[ "$admin_code" != "200" ]]; then
    echo "[smoke][admin-health] failed with status=$admin_code"
    cat /tmp/phase4-admin-smoke-$$.txt
    rm -f /tmp/phase4-admin-smoke-$$.txt
    exit 1
  fi
  rm -f /tmp/phase4-admin-smoke-$$.txt
  echo "[smoke][admin-health] ok"
  echo "[smoke] all checks passed"
  exit 0
fi

if [[ -f "$ADMIN_COOKIE_FILE" ]]; then
  admin_code=$(curl -s -o /tmp/phase4-admin-smoke-$$.txt -b "$ADMIN_COOKIE_FILE" -w "%{http_code}" "$API_BASE/admin/reports/health" || true)
  rm -f "$ADMIN_COOKIE_FILE"

  if [[ "$admin_code" != "200" ]]; then
    echo "[smoke][admin-health] failed with status=$admin_code"
    cat /tmp/phase4-admin-smoke-$$.txt
    rm -f /tmp/phase4-admin-smoke-$$.txt
    exit 1
  fi
  rm -f /tmp/phase4-admin-smoke-$$.txt
  echo "[smoke][admin-health] ok"
fi

echo "[smoke] all checks passed"
