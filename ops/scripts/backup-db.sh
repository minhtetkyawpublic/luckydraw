#!/usr/bin/env bash
set -euo pipefail

: "${APP_NAME:=Lucky_Draw_PWA}"
: "${BACKUP_DIR:="${OPS_BACKUP_DIR:-$(pwd)/ops/backups}"}"
: "${DB_HOST:=127.0.0.1}"
: "${DB_PORT:=3306}"
: "${DB_USERNAME:=root}"
: "${DB_PASSWORD:=}"
: "${PHASE4_BACKUP_RETENTION_DAYS:=30}"

DB_NAME="${DB_DATABASE:-}"
if [[ -z "$DB_NAME" ]]; then
  echo "[backup] DB_DATABASE env is required."
  exit 1
fi

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILE="$BACKUP_DIR/${APP_NAME// /_}_$TIMESTAMP.sql.gz"

mysqldump \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --user="$DB_USERNAME" \
  --password="$DB_PASSWORD" \
  "$DB_NAME" | gzip > "$FILE"

echo "[backup] created $FILE"
find "$BACKUP_DIR" -name "*.sql.gz" -type f -mtime +"$PHASE4_BACKUP_RETENTION_DAYS" -delete
