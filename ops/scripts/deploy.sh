#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$(pwd)}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
RUN_MIGRATIONS="${RUN_MIGRATIONS:-1}"
RUN_BUILD="${RUN_BUILD:-1}"
KEEP_FILES="${KEEP_FILES:-0}" # set to 1 to clear stale cache artifacts before finalizing deploy
APP_URL="${APP_URL:-http://127.0.0.1}"

DRY_RUN="${DRY_RUN:-0}"

run() {
  echo "+ $*"
  if [[ "$DRY_RUN" != "1" ]]; then
    eval "$*"
  fi
}

if [[ ! -d "$APP_DIR/.git" ]]; then
  echo "[deploy] APP_DIR must be a git repository: $APP_DIR"
  exit 1
fi

run "cd \"$APP_DIR\" && git fetch --all"
run "cd \"$APP_DIR\" && git checkout \"$DEPLOY_BRANCH\""
run "cd \"$APP_DIR\" && git pull --ff-only origin \"$DEPLOY_BRANCH\""
run "cd \"$APP_DIR\" && composer install --no-dev --optimize-autoloader --no-interaction --prefer-dist --no-progress"

if [[ "$RUN_BUILD" == "1" ]]; then
  run "cd \"$APP_DIR\" && npm ci"
  run "cd \"$APP_DIR\" && npm run build"
fi

# Vite creates this marker only for its local development server. Leaving it on
# production makes Laravel request assets from a localhost development port.
run "rm -f \"$APP_DIR/public/hot\""

if [[ "$RUN_MIGRATIONS" == "1" ]]; then
  run "cd \"$APP_DIR\" && php artisan migrate --force"
fi
run "cd \"$APP_DIR\" && php artisan optimize"
run "cd \"$APP_DIR\" && php artisan config:cache"
run "cd \"$APP_DIR\" && php artisan route:cache"

if [[ "$KEEP_FILES" == "1" ]]; then
  run "cd \"$APP_DIR\" && rm -rf storage/framework/cache/data/*"
fi

run "cd \"$APP_DIR\" && php artisan view:cache"

if [[ -f "$APP_DIR/ops/scripts/smoke-check.sh" ]]; then
  run "APP_URL=\"$APP_URL\" bash \"$APP_DIR/ops/scripts/smoke-check.sh\""
fi

echo "[deploy] completed"
