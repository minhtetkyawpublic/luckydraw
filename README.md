<p align="center"><a href="https://laravel.com" target="_blank"><img src="https://raw.githubusercontent.com/laravel/art/master/logo-lockup/5%20SVG/2%20CMYK/1%20Full%20Color/laravel-logolockup-cmyk-red.svg" width="400" alt="Laravel Logo"></a></p>

<p align="center">
<a href="https://github.com/laravel/framework/actions"><img src="https://github.com/laravel/framework/workflows/tests/badge.svg" alt="Build Status"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/dt/laravel/framework" alt="Total Downloads"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/v/laravel/framework" alt="Latest Stable Version"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/l/laravel/framework" alt="License"></a>
</p>

## About Laravel

Laravel is a web application framework with expressive, elegant syntax. We believe development must be an enjoyable and creative experience to be truly fulfilling. Laravel takes the pain out of development by easing common tasks used in many web projects, such as:

- [Simple, fast routing engine](https://laravel.com/docs/routing).
- [Powerful dependency injection container](https://laravel.com/docs/container).
- Multiple back-ends for [session](https://laravel.com/docs/session) and [cache](https://laravel.com/docs/cache) storage.
- Expressive, intuitive [database ORM](https://laravel.com/docs/eloquent).
- Database agnostic [schema migrations](https://laravel.com/docs/migrations).
- [Robust background job processing](https://laravel.com/docs/queues).
- [Real-time event broadcasting](https://laravel.com/docs/broadcasting).

Laravel is accessible, powerful, and provides tools required for large, robust applications.

## Learning Laravel

Laravel has the most extensive and thorough [documentation](https://laravel.com/docs) and video tutorial library of all modern web application frameworks, making it a breeze to get started with the framework. You can also check out [Laravel Learn](https://laravel.com/learn), where you will be guided through building a modern Laravel application.

If you don't feel like reading, [Laracasts](https://laracasts.com) can help. Laracasts contains thousands of video tutorials on a range of topics including Laravel, modern PHP, unit testing, and JavaScript. Boost your skills by digging into our comprehensive video library.

## Laravel Sponsors

We would like to extend our thanks to the following sponsors for funding Laravel development. If you are interested in becoming a sponsor, please visit the [Laravel Partners program](https://partners.laravel.com).

### Premium Partners

- **[Vehikl](https://vehikl.com)**
- **[Tighten Co.](https://tighten.co)**
- **[Kirschbaum Development Group](https://kirschbaumdevelopment.com)**
- **[64 Robots](https://64robots.com)**
- **[Curotec](https://www.curotec.com/services/technologies/laravel)**
- **[DevSquad](https://devsquad.com/hire-laravel-developers)**
- **[Redberry](https://redberry.international/laravel-development)**
- **[Active Logic](https://activelogic.com)**

## Contributing

Thank you for considering contributing to the Laravel framework! The contribution guide can be found in the [Laravel documentation](https://laravel.com/docs/contributions).

## Code of Conduct

In order to ensure that the Laravel community is welcoming to all, please review and abide by the [Code of Conduct](https://laravel.com/docs/contributions#code-of-conduct).

## Security Vulnerabilities

If you discover a security vulnerability within Laravel, please send an e-mail to Taylor Otwell via [taylor@laravel.com](mailto:taylor@laravel.com). All security vulnerabilities will be promptly addressed.

## License

The Laravel framework is open-sourced software licensed under the [MIT license](https://opensource.org/licenses/MIT).

## Moung Ba Yin PWA API overview

### Auth

- `POST /api/auth/login` (user accounts only)
- `POST /api/auth/admin/login` (administrator only)
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Player actions

- `GET /api/wallet`
- `GET /api/wallet/transactions?type={...}&from=YYYY-MM-DD&to=YYYY-MM-DD&page=1&per_page=20`
- `POST /api/points/claim-daily`
- `POST /api/spins/free`
- `POST /api/spins`
- `GET /api/spins/status`
- `GET /api/spins/me?type=free|paid&page=1&per_page=20`

### Admin actions

- `GET /api/admin/users?q=...&status=active|disabled`
- `POST /api/admin/users`
- `PATCH /api/admin/users/{id}`
- `POST /api/admin/users/{id}/reset-password`
- `POST /api/admin/users/{id}/adjust-points`
- `GET /api/admin/profile`
- `PATCH /api/admin/profile`
- `PATCH /api/admin/profile/password`
- `GET /api/admin/spin-configuration`
- `PATCH /api/admin/spin-configuration`

### Payload examples

#### Login response

```json
{
  "message": "Authenticated",
  "user": {
    "id": 1,
    "name": "Admin User",
    "email": "admin@example.com",
    "role": "admin",
    "status": "active"
  }
}
```

#### Spin status response

```json
{
  "status": {
    "config": {
      "id": 1,
      "name": "Main Wheel",
      "cost_points": 10,
      "cooldown_seconds": 120,
      "is_active": true
    },
    "can_free_spin_today": true,
    "can_claim_daily_bonus": true,
    "wallet_balance": 350,
    "next_paid_spin_at": null,
    "paid_spin_cooldown_remaining_seconds": 0
  }
}
```

#### Spin success response

```json
{
  "spin": {
    "event_id": 21,
    "points_spent": 10,
    "points_awarded": 30,
    "is_free_spin": false,
    "segment": "Big Bonus",
    "segment_id": 3,
    "segment_order": 1,
    "seed": "f1b2c...",
    "balance_after": 270
  },
  "wallet": {
    "balance": 270
  }
}
```

#### Spin blocked example

```json
{
  "message": "Cooldown active",
  "error_code": "COOLDOWN_ACTIVE",
  "paid_spin_cooldown_remaining_seconds": 47
}
```

### Phase 3 notes

- All paid/free spin calls are idempotent when the client sends `Idempotency-Key`.
- Spin actions enforce anti-abuse controls:
  - free/paid spin throttle limits
  - paid-spin cooldown
  - max-per-day segment caps (`max_win_per_day`)
- Admin workflows include:
  - point adjustments
  - user account creation and status changes
  - wheel cost, reward, and weight editing
  - administrator profile and password changes
- Operational reports, monitoring, system-health, and audit-log screens are intentionally not part of the app.
