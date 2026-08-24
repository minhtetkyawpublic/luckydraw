# Lucky Draw PWA — End-to-End Development Roadmap

## Source of truth

This roadmap is based on:

- `software-spec.md` (product scope and baseline requirements)
- `GENERIC_HOSTINGER_LARAVEL_REACT_AI_PROMPT.md` (deployment/runtime guidance for Laravel + Vite on Hostinger-style hosting)
- Phase 1 and Phase 2 implementation decisions already finalized in this chat

## Product summary (from spec)

- Tech stack: **Laravel + React (Vite) + MySQL**
- PWA-first, mobile-first UX
- Admin-managed users (no public self-registration)
- Users can:
  - login (with remember-me),
  - claim **one daily bonus**,
  - do **one free spin/day**,
  - exchange points for spin credits and use one credit per non-free spin,
  - view wallet/history.
- Admin can:
  - create users,
  - reset password,
  - adjust points manually,
  - manage spin configuration and segments.
- No in-app payment flow (users buy points outside app; admin adds points manually).
- Rewards can be points or spin credits, configured per wheel slice.

## Roadmap execution rules

- We implement one phase at a time.
- No destructive DB actions unless the user explicitly requests a clean install (`migrate:fresh`, `db:wipe`).
- Existing code remains stable; tests must pass at each phase gate.
- API contracts must stay backward compatible within each phase.

---

## Phase 1 — Foundation + Auth + Core Data Baseline

### Status: ✓ Completed

### Outcomes

- Laravel app serves React SPA (`routes/web.php`) and API (`routes/api.php`) from the same project.
- Runtime-safe base/path behavior implemented for nested hosting.
- Auth with Sanctum/session-style flows and remember-me login.
- Admin-only user lifecycle (public registration not exposed).
- Core wallet, bonus and spin domain models and transactions.
- Baseline PWA installability and offline shell behavior.

### Backend tasks

- [x] Configure MySQL + Sanctum/session stack.
- [x] Auth endpoints:
  - `POST /api/auth/login` for users
  - `POST /api/auth/admin/login` for the administrator
  - `POST /api/auth/logout`
  - `GET /api/auth/me`
- [x] Player login payload supports `username`, `password`, `remember_me`; administrator login retains `email_or_phone`, `password`, `remember_me`.
- [x] Separate user `/login` and administrator `/admin/login` portals with role enforcement and separate dashboards.
- [x] Ensure status checks (active/disabled) and session invalidation on logout.
- [x] Add `users.role`, `users.status`, optional contact fields, and a unique player `username` separate from the normal display name.
- [x] Add core tables:
  - `points_wallets`
  - `point_transactions`
  - `daily_point_claims` (unique `(user_id, claim_date)`)
  - `daily_free_spins` (unique `(user_id, spin_date)`)
  - `spin_configurations`
  - `spin_segments`
  - `spin_events`
- [x] Add services:
  - `AuthService`
  - `WalletService`
  - `DailyBonusService`
  - `SpinEligibilityService`
  - `SpinService`
- [x] Add endpoints:
  - `GET /api/wallet`
  - `GET /api/wallet/transactions`
  - `POST /api/points/claim-daily`
  - `POST /api/spins/free`
  - `POST /api/spins`
  - `GET /api/spins/me`
- [x] Admin endpoints:
  - `POST /api/admin/users`
  - `POST /api/admin/users/{id}/reset-password`
  - `POST /api/admin/users/{id}/adjust-points`
  - `GET /api/admin/spin-configuration`
  - `PATCH /api/admin/spin-configuration`
- [x] Add middleware:
  - role-based admin guard
  - rate-limits on login/claim/spin endpoints

### Frontend tasks

- [x] Build SPA routes/screens:
  - Login (remember-me)
  - Dashboard
  - Daily Bonus
  - Spin
  - History
  - Sticky bottom navigation
- [x] Use mobile-first styles, large touch targets.
- [x] Detect base path from bundle URL for nested deployment.

### PWA tasks

- [x] Add `manifest.webmanifest` and service worker registration.
- [x] Add installability metadata (theme color, display, apple mobile metadata).
- [x] Cache app shell (non-API) in SW.

### Validation

- [x] `POST /api/register` absent
- [x] admin create user + user login with assigned credentials
- [x] daily bonus one-time per day
- [x] seven-day admin-configurable bonus schedule, Sunday rollover, and claimed/missed/today/upcoming states
- [x] free spin one-time per day
- [x] spin-credit balance rejection and point-to-spin package exchange
- [x] immutable transaction entries with `balance_after`
- [x] manifest and SW exist; app loads installable

---

## Phase 2 — Gameplay Hardening + Admin UX + Better PWA Experience

### Status: ✓ Completed

### Outcomes

- Introduce spin availability/cooldown UX data from server.
- Enforce cooldown + explicit error payloads for paid spins.
- Expand admin operations and reporting APIs.
- Improve PWA shell/offline behavior and mobile UX polish.

### Backend tasks

- [x] Add `GET /api/spins/status` with:
  - config summary, spin-credit balance, cooldown, and free-spin availability
  - `can_free_spin_today`
  - `next_paid_spin_at`
  - `paid_spin_cooldown_remaining_seconds`
- [x] Enforce paid-spin cooldown via latest paid spin + active config.
- [x] Add explicit payload contract for:
  - insufficient balance
  - cooldown active (`error_code: COOLDOWN_ACTIVE`, remaining seconds)
- [x] Admin users listing and editing:
  - `GET /api/admin/users` (search + filters + pagination + `wallet.balance`)
  - `PATCH /api/admin/users/{user}` (name/email/phone/status; player accounts only)
- [x] Keep/create user, reset password, adjust points.
- [x] Spin config management:
  - `PATCH /api/admin/spin-configuration` for the single operational wheel
  - configure exchange packages plus point/spin reward type, amount, slice count, and chance weight
- [x] Validate config segments strictly:
  - `weight > 0`
  - at least one segment
  - total weight > 0
- [x] Expand pagination/filtering:
  - `GET /api/wallet/transactions?type=...&from=...&to=...&page=...&per_page=...`
  - `GET /api/spins/me?type=free|paid&page=...&per_page=...`
- [x] Add query indexes for query-performance:
  - spin/events by user/date/type
  - point_transactions by user/type/date

### Frontend tasks

- [x] Add role-based route split:
  - user routes: dashboard, daily bonus, spin, history
  - admin routes: users, config, spin/events
- [x] Replace spin placeholders with animated wheel interaction.
- [x] Add live chips/status on dashboard:
  - free spin status
  - bonus claim status
  - seven-day bonus amounts and claimed/missed status
  - paid spin cooldown
  - wallet balance
- [x] Add pull-to-refresh + pagination in history.
- [x] Add toast/snackbar and loading/empty/error states.

### PWA tasks

- [x] Improve SW strategy:
  - pre-cache manifest/shell/assets/icons
  - offline navigation fallback to shell
  - do not cache API responses
  - optional sync hook retained for read-only retry
- [x] Use app logos:
  - `logo.png`
  - `logotransparent.png`
  - updated manifest + head tags + SW pre-cache

### Validation

- [x] Cannot free-spin twice in one day (server + UI)
- [x] Paid-spin cooldown respected and countdown visible
- [x] Spin result aligns with server response
- [x] Admin user list/edit flows work and persist
- [x] History endpoints return paginated payloads
- [x] App installability preserved with offline shell

---

## Phase 3 — Production-Ready Feature Expansion

### Status: ✅ Implemented (updated 2026-08-20)

### Goal

Turn the currently stable app into a more production-ready release with stronger anti-abuse controls, admin auditability, and operational tooling while preserving existing mobile-first user flows.

### Scope and implementation steps

1) Spin fairness and anti-abuse
- [x] Add idempotency key support for spin endpoints (`Idempotency-Key`) to prevent accidental duplicate submits.
- [x] Enforce paid-spin cooldown with explicit remaining-seconds reporting.
- [x] Add runtime segment cap checks by user/day for segment selection (`max_win_per_day`).
- [x] Add burst/rate-limit tuning for stress scenarios beyond baseline endpoint throttling.

2) Admin account and governance
- [x] Keep immutable internal audit records for sensitive admin actions without exposing an audit-log tool in the app.
- [x] Keep user management focused on create, edit, enable/disable, reset password, and point adjustment.
- [x] Add secure admin password change with current-password verification.

3) History
- [x] Keep paginated spin/event endpoints with filters.
- [x] Add server-logged audit trail for sensitive admin actions.
- [x] Keep system-health, reports, exports, monitoring, and audit-log screens outside product scope.

4) Gameplay experience
- [x] Keep spin result animation/state tied to server-authoritative event payload.
- [x] Improve winner snap polish and blocked-state explanation UX.
- [x] Add deeper history detail drill-down.
- [x] Fix front-end spin animation timing race: each spin now uses computed duration per segment and clears any stale timeout before scheduling the final result render.

5) PWA & reliability hardening
- [x] Keep shell cache + navigation fallback, without API response caching.
- [x] Use `logo.png` and `logotransparent.png` in manifest, meta tags, and SW pre-cache.
- [x] Do not show an app-version/update notification; updates apply through the normal service-worker lifecycle.
- [x] Add robust background-sync fallback strategy for safe read retries.
- [x] Add one replaceable admin announcement with version-based per-user unread state.
- [x] Add encrypted per-device Web Push subscriptions, explicit Settings permission controls, and notification-click routing.
- [x] Queue push fan-out in bounded batches and suppress delivery of stale announcement versions.

6) Security/compliance and quality
- [x] Add Phase 3 integration tests:
  - idempotent spin replay
  - paid cooldown boundary behavior
  - segment cap enforcement
  - admin audit logging
- [x] Keep the mobile admin navigation limited to Overview, Users, Wheel, and Settings.
- [x] Expand API response docs (example payloads) in `README`.

### Acceptance criteria (Phase 3 gate)

- All existing tests pass and new Phase 3 tests pass.
- Spin and wallet operations remain server-authoritative.
- Role-based restrictions on admin endpoints remain enforced.
- PWA installability and shell/offline behavior remain intact.
- `manifest.webmanifest`, `sw.js`, `logo.png`, and `logotransparent.png` are present and referenced.

### Delivery note

- Implemented with burst/throttle hardening:
  - free/paid spin limits now include per-minute + per-second windows
  - idempotent spin retries via `Idempotency-Key`
  - scheduled cleanup for expired idempotency keys (`lucky-draw:cleanup-idempotency`)

---

## Phase 4 — Scale, Operations, and Release Readiness (Optional)

### Status: ✅ Implemented

### Scope

- Performance tuning under load (DB query + caching strategy).
- Observability dashboard and alerting.
- CI/CD pipeline with automated test/build/lint deploy checks.
- Backup/restore and incident runbooks.
- Staging → production deploy script and smoke-test checklist.

### Phase 4 completion evidence

- CI now includes deterministic quality gates:
  - PHP syntax lint (`php -l`)
  - test suite
  - frontend build
  - route/config cache smoke assertions
- Phase 4 ops scripts and runbook added:
  - `backup-db.sh`
  - `restore-db.sh`
  - `deploy.sh`
  - `smoke-check.sh`
- Additional release hardening:
  - scheduled maintenance task for idempotency cleanup
  - burst-aware spin throttles
  - phase4 performance indexes

---

## Immediate next step

Move to Phase 4 (scale + operations) when you want release hardening:

- observability, CI checks, backup strategy, and staging/production rollout controls.
