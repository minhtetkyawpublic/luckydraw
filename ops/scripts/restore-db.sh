#!/usr/bin/env bash
set -euo pipefail

: "${DB_HOST:=127.0.0.1}"
: "${DB_PORT:=3306}"
: "${DB_USERNAME:=root}"
: "${DB_PASSWORD:=}"

DB_NAME="${DB_DATABASE:-}"
BACKUP_FILE="${1:-}"
DROP_FIRST="${2:-0}"

if [[ -z "$DB_NAME" ]]; then
  echo "[restore] DB_DATABASE env is required."
  exit 1
fi

if [[ -z "$BACKUP_FILE" ]]; then
  echo "[restore] usage: restore-db.sh /path/to/backup.sql.gz [drop_first=0|1]"
  exit 1
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "[restore] backup file not found: $BACKUP_FILE"
  exit 1
fi

if [[ "$DROP_FIRST" == "1" ]]; then
  echo "[restore] dropping existing database $DB_NAME..."
  mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USERNAME" --password="$DB_PASSWORD" -e "DROP DATABASE IF EXISTS \`"$DB_NAME\`"; CREATE DATABASE \`"$DB_NAME\`";"
else
  echo "[restore] ensuring database $DB_NAME exists..."
  mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USERNAME" --password="$DB_PASSWORD" -e "CREATE DATABASE IF NOT EXISTS \`"$DB_NAME\`";"
fi

if [[ "$BACKUP_FILE" == *.gz ]]; then
  gunzip -c "$BACKUP_FILE" | mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USERNAME" --password="$DB_PASSWORD" "$DB_NAME"
else
  mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USERNAME" --password="$DB_PASSWORD" "$DB_NAME" < "$BACKUP_FILE"
fi

echo "[restore] restored $BACKUP_FILE into $DB_NAME"