# Lucky Draw PWA — Operations (Phase 4)

This folder contains scripts and runbooks to support releases, backups, restore, and smoke checks.

## Scripts

- `ops/scripts/backup-db.sh`
  - Creates compressed MySQL dump into `ops/backups/`
  - Automatically prunes `.sql.gz` files older than `PHASE4_BACKUP_RETENTION_DAYS`

- `ops/scripts/restore-db.sh`
  - Restores a backup into the database configured by env vars
  - Supports `.sql` and `.sql.gz` input
  - Optional second arg `1` to drop/recreate DB before restore

- `ops/scripts/deploy.sh`
  - Pulls code from git branch, installs dependencies, builds frontend, runs migrations and cache warmup
  - Optional variables: `APP_DIR`, `DEPLOY_BRANCH`, `RUN_MIGRATIONS`, `RUN_BUILD`, `DRY_RUN`

- `ops/scripts/smoke-check.sh`
  - Basic HTTP/API smoke checks for a running app instance
  - Can be used both locally and in CI/deploy pipelines

## Environment variables used

Set these in deployment target shell or CI.

- `DB_HOST` (default: `127.0.0.1`)
- `DB_PORT` (default: `3306`)
- `DB_DATABASE` **(required)**
- `DB_USERNAME` (default: `root`)
- `DB_PASSWORD`
- `PHASE4_BACKUP_RETENTION_DAYS` (default: `30`)
- `APP_DIR` (default: repository root)
- `DEPLOY_BRANCH` (default: `main`)
- `APP_NAME` (used for backup file naming)
- `APP_URL` (smoke checks)
- `RUN_PHASE4_SMOKE_ADMIN` (optional bearer token for optional admin endpoint smoke check)

## Daily operations checklist

1. Run backup before any release:
   - `bash ops/scripts/backup-db.sh`
2. Run restore test in staging when needed:
   - `bash ops/scripts/restore-db.sh ops/backups/<filename>.sql.gz 1`
3. Promote release:
   - `APP_DIR=/path/to/app APP_URL=https://your-app.com bash ops/scripts/deploy.sh`
4. Run smoke checks:
   - `APP_URL=https://your-app.com bash ops/scripts/smoke-check.sh`
5. Run CI-equivalent quality gates before merge:
   - `composer install`
   - `php -l app bootstrap config database routes`
   - `php artisan test`
   - `npm ci && npm run build`

## Required scheduled tasks

Configure the hosting control panel to run Laravel's scheduler every minute:

```text
* * * * * cd /absolute/path/to/luckydraw && php artisan schedule:run >/dev/null 2>&1
```

This is required for automatic cleanup of expired idempotency records. Also schedule
`ops/scripts/backup-db.sh` daily and periodically test a restore on a separate database.

## Incident response checklist

1. Confirm API reachability:
   - `curl -I $APP_URL/api/health`
2. Confirm build/runtime cache:
   - `php artisan route:list --name=api.health`
   - `php artisan config:cache && php artisan route:cache`
3. Check suspicious activity for recent abuse:
   - use `php artisan tinker` and inspect server-side spin and `admin_audit_logs` records (there is no operational-tools screen in the app)
4. Re-run smoke checks after mitigation.

---

Phase 4 aligns with release hardening tasks for:
- observability
- backup/restore
- deploy checks
- operational readiness
