# Moung Ba Yin PWA — Software Specification (Phase 1 Ready)

## 1) Product overview

We are building a **mobile-first Laravel + React PWA** that lets users earn points, exchange points for spin credits, and use those credits on a reward wheel.

Key decisions:

- Frontend: React (Vite) served by Laravel.
- Backend: Laravel API + session auth.
- Database: MySQL.
- User accounts: **admin creates users**; self-registration is disabled.
- Point buying: users contact admin and buy points outside the app. Admin credits points manually via admin interface.
  (No top-up request/approval workflow is included in Phase 1.)
- Wheel rewards: admin-configurable points or spin credits.
- Points cannot be spent directly on a wheel spin; users exchange points for spin-credit packages first.

## 2) Scope (Phase 1)

### In scope

- Admin account bootstrap + admin-only user creation endpoint.
- User authentication with remember me.
- Daily bonus claim: one claim per calendar day per user.
- Daily free spin: one free spin per calendar day per user.
- Paid spin: user spends points to play.
- Wallet with immutable transaction ledger.
- PWA baseline (manifest, service worker, installable shell, nested-path-safe asset/API base).

### Out of scope (Phase 1)

- In-app payment flow.
- Public user registration.
- External reward catalog (non-point rewards).
- Top-up request/approval module.

## 3) Roles

- **User**: login, claim bonus, use the daily free spin, exchange points for spin credits, use spin credits, and view history.
- **Sole Admin**: manage the single administrator profile, create player accounts, reset player passwords, manually adjust player points, and configure the one Lucky Draw wheel.

## 4) Authentication rules

- Endpoints:
  - `POST /api/auth/login` (user accounts only)
  - `POST /api/auth/admin/login` (administrator account only)
  - `POST /api/auth/logout`
  - `GET /api/auth/me`
- User login payload: `username`, `password`, `remember_me: boolean`.
- Administrator login payload: `email_or_phone`, `password`, `remember_me: boolean`.
- Player accounts have a normal display `name` plus a unique, case-insensitive `username`; email and phone are optional contact fields and are not accepted as player login identifiers.
- User UI login: `/login`; administrator UI login: `/admin/login`. Each portal rejects accounts with the wrong role.
- No registration API endpoint exposed.
- Route guard: `auth:sanctum`.
- Admin routes require `role:admin`; exactly one administrator account is maintained and the app cannot create another administrator.
- Administrator accounts do not have point wallets and cannot use player bonus/spin APIs.

## 5) Data model

Core tables:

- `users`
  - `name`, unique nullable `username`, nullable unique `email`, nullable unique `phone`, `role` (`user|admin`), `status` (`active|disabled`).
  - `username` is required for player accounts and remains nullable for the sole administrator, whose separate portal continues to use email or phone.
- `points_wallets`
  - `user_id` unique FK, `balance`.
- `point_transactions`
  - `wallet_id`, `user_id`, `type`, `amount`, `balance_after`, `reference_type`, `reference_id`, `status`, `notes`.
  - immutable ledger entries for every balance mutation.
- `daily_point_claims`
  - unique `(user_id, claim_date)` for idempotent daily bonus.
- `daily_free_spins`
  - unique `(user_id, spin_date)` for one free spin/day.
- `spin_configurations`
  - one operational wheel; paid play consumes one spin credit rather than points.
- `spin_segments`
  - FK to configuration, reward type (`points` or `spins`), reward amount, weight, and optional daily cap.
- `spin_events`
  - FK to user/config/segment, points/spins spent and awarded, `is_free_spin`, seed/version/payload.
- `spin_wallets` + `spin_credit_transactions`
  - one spin-credit balance per user with an immutable exchange/reward/spend ledger.
- `spin_exchange_packages`
  - admin-configurable point cost, spin quantity, order, and active status.
- `announcements`
  - singleton current post with title, full body, monotonically increasing version, publisher, and publish time.
- `users.last_read_announcement_version`
  - compact per-user read marker; every publish becomes unread without creating one notification row per user.
- `push_subscriptions`
  - encrypted Web Push endpoint and browser keys per user/device, deduplicated by an indexed SHA-256 endpoint hash.
- `betting_sites`
  - admin-managed website name, user-facing display text, destination URL, button text, active status, and display order.

## 6) Domain logic

- Wallet is initialized lazily (`getOrCreateWallet`) at first login or first write.
- Daily bonus:
  - admin configures seven point amounts in Monday-to-Sunday order; Monday is Day 1.
  - the displayed week rolls over automatically every Monday without a scheduled task.
  - each day reports `claimed`, `missed`, `today`, or `upcoming`; claimed days keep their actual awarded amount.
  - backend checks today’s claim before inserting.
  - creates immutable `daily_bonus` ledger row and updates wallet in transaction.
- Free spin:
  - verifies active wheel config exists.
  - verifies one free spin/day via `daily_free_spins`.
  - credits the configured point or spin reward and writes the matching immutable transaction.
- Paid spin:
  - verifies active config and sufficient spin-credit balance.
  - consumes one spin credit and credits either a point or spin reward in one database transaction.
- All writes use row locks/transactions around wallet changes.

## 7) Frontend behavior

- Mobile-first screens:
  - Login (with remember me checkbox)
  - Dashboard (balance and quick links)
  - Daily Bonus
  - Spin
  - History
- Sticky bottom navigation + large touch targets.
- Install prompt behavior from manifest; service worker caches shell and avoids caching API responses.
- Runtime-safe base resolution derived from loaded bundle path (no hardcoded domain).
- One current announcement header appears below the user header; opening it displays the full post and marks that version read.
- User Settings provides explicit Allow/Disable Web Push controls. Permission is requested only from the button action.
- Service-worker push notifications replace the prior post notification by tag and open the nested-path-safe announcement page.
- The dashboard Play button opens an internal betting-website directory. Only active entries are shown in admin-defined order; selecting one opens its validated HTTP(S) URL in a new tab.

## 8) API contract (Phase 1)

Public:

- `POST /api/auth/login` (user)
- `POST /api/auth/admin/login` (administrator)
- `POST /api/auth/logout`
- `GET /api/auth/me`

Authenticated user:

- `GET /api/wallet`
- `GET /api/wallet/transactions`
- `POST /api/points/claim-daily`
- `POST /api/spins/free`
- `POST /api/spins`
- `GET /api/spins/me`
- `GET /api/announcement`
- `POST /api/announcement/read`
- `GET /api/push/config`
- `POST|DELETE /api/push/subscriptions`
- `GET /api/betting-sites`

Admin:

- `POST /api/admin/users`
- `POST /api/admin/users/{id}/reset-password`
- `POST /api/admin/users/{id}/adjust-points`
- `GET /api/admin/spin-configuration`
- `PATCH /api/admin/spin-configuration`
- `GET|PATCH /api/admin/profile`
- `GET|PUT /api/admin/announcement`
- `GET|POST /api/admin/betting-sites`
- `PATCH|DELETE /api/admin/betting-sites/{bettingSite}`

## 9A) Single-post notification behavior

- Admin publishes through an explicit button; each publish overwrites the singleton post and increments its version.
- Only the newest queued version is eligible for delivery; stale jobs exit without sending.
- Push fan-out uses the database queue in 200-device batches and removes subscriptions rejected as expired (`404`/`410`).
- In-app notification state remains available even if a user declines or cannot use operating-system Web Push.
- VAPID keys are stable deployment secrets and must not be regenerated after devices subscribe.

## 9) Validation checkpoints

- `POST /api/register` does not exist.
- Admin can create user and user can sign in with assigned credentials.
- Daily bonus can be claimed once/day.
- Free spin can be used once/day.
- Paid spin is rejected on low balance.
- Every bonus/spin operation writes a point transaction with `balance_after`.
- PWA manifest and service worker are present and app is installable.

## 10) Phase 2 feature set (implemented)

- New API contracts:
  - `GET /api/spins/status`
  - `GET /api/wallet/transactions?type=...&from=...&to=...&page=...&per_page=...`
  - `GET /api/spins/me?type=free|paid&page=...&per_page=...`
  - `GET /api/admin/users` (search, pagination, wallet snapshot)
  - `PATCH /api/admin/users/{user}` (player status/name/email/phone updates; role cannot be changed)
  - `PATCH /api/admin/spin-configuration` (reward type, reward amount, slice count, and chance weight)
  - `GET|PUT /api/admin/spin-exchange-packages`
  - `GET /api/spin-exchange-packages`
  - `POST /api/spin-exchange-packages/{package}/exchange`
  - explicit paid-spin error payloads (`COOLDOWN_ACTIVE`, `INSUFFICIENT_BALANCE`)

- Behavior:
  - paid spin cooldown enforced server-side and surfaced in dashboard/spin UX.
  - wallet and cooldown gating states are refreshed from `/api/spins/status`.
  - animated wheel behavior uses server-authoritative segment result.

## 11) Phase 3 feature set (implemented)

- Anti-abuse safeguards remain internal:
  - idempotent spin endpoints using `Idempotency-Key`.
  - server-side throttling and immutable admin action records.
- The product does not expose system-health, monitoring, report/export, audit-log, or update-notification tools in the admin or user interface.
