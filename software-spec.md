# Lucky Draw PWA — Software Specification (Phase 1 Ready)

## 1) Product overview

We are building a **mobile-first Laravel + React PWA** that lets users earn and spend points to spin a reward wheel on a per-day basis.

Key decisions:

- Frontend: React (Vite) served by Laravel.
- Backend: Laravel API + session auth.
- Database: MySQL.
- User accounts: **admin creates users**; self-registration is disabled.
- Point buying: users contact admin and buy points outside the app. Admin credits points manually via admin interface.
  (No top-up request/approval workflow is included in Phase 1.)
- Wheel rewards: points-only.

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

- **User**: login, claim bonus, free spin, paid spin, view wallet/history.
- **Sole Admin**: manage the single administrator profile, create player accounts, reset player passwords, manually adjust player points, and configure the one Lucky Draw wheel.

## 4) Authentication rules

- Endpoints:
  - `POST /api/auth/login` (user accounts only)
  - `POST /api/auth/admin/login` (administrator account only)
  - `POST /api/auth/logout`
  - `GET /api/auth/me`
- Login payload: `email_or_phone`, `password`, `remember_me: boolean`.
- User UI login: `/login`; administrator UI login: `/admin/login`. Each portal rejects accounts with the wrong role.
- No registration API endpoint exposed.
- Route guard: `auth:sanctum`.
- Admin routes require `role:admin`; exactly one administrator account is maintained and the app cannot create another administrator.
- Administrator accounts do not have point wallets and cannot use player bonus/spin APIs.

## 5) Data model

Core tables:

- `users`
  - `role` (`user|admin`), `status` (`active|disabled`), `phone` nullable unique.
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
  - one operational wheel with `cost_points`; lifecycle fields remain internal and are not exposed as multiple-wheel controls.
- `spin_segments`
  - FK to configuration, `label`, `points_reward`, `weight`, optional `max_win_per_day`.
- `spin_events`
  - FK to user/config/segment, points spent/awarded, `is_free_spin`, seed/version/payload.

## 6) Domain logic

- Wallet is initialized lazily (`getOrCreateWallet`) at first login or first write.
- Daily bonus:
  - backend checks today’s claim before inserting.
  - creates immutable `daily_bonus` ledger row and updates wallet in transaction.
- Free spin:
  - verifies active wheel config exists.
  - verifies one free spin/day via `daily_free_spins`.
  - credits reward and writes spin event + reward transaction.
- Paid spin:
  - verifies active config, checks sufficient wallet balance.
  - writes debit (`spin_spend`) + reward (`paid_spin_reward`) transaction and spin event in one transaction.
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

Admin:

- `POST /api/admin/users`
- `POST /api/admin/users/{id}/reset-password`
- `POST /api/admin/users/{id}/adjust-points`
- `GET /api/admin/spin-configuration`
- `PATCH /api/admin/spin-configuration`
- `GET|PATCH /api/admin/profile`

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
  - `PATCH /api/admin/spin-configuration` (paid-spin cost, slice count, points per slice, and chance weight per slice)
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
