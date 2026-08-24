# Hostinger production deployment

This repository includes the compiled Vite bundle so Hostinger's PHP Git
deployment does not need Node.js at runtime.

## First deployment

1. In hPanel, select the website and open **Advanced → Git**.
2. Connect GitHub, choose `minhtetkyawpublic/luckydraw`, and deploy `main` to
   `public_html`.
3. Set PHP to 8.2 or newer and create the production `.env` in `public_html`.
4. Set at least these production values:

   ```dotenv
   APP_ENV=production
   APP_DEBUG=false
   APP_URL=https://your-domain.example
   ASSET_URL=https://your-domain.example
   APP_TIMEZONE=Asia/Yangon
   SESSION_DRIVER=database
   SESSION_SECURE_COOKIE=true
   SESSION_SAME_SITE=lax
   DB_CONNECTION=mysql
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_DATABASE=your_database
   DB_USERNAME=your_database_user
   DB_PASSWORD=your_database_password
   LUCKYDRAW_ADMIN_EMAIL=your-admin@example.com
   LUCKYDRAW_ADMIN_PASSWORD=use-a-long-unique-password
   LUCKYDRAW_ADMIN_NAME="Lucky Draw Admin"
   LUCKYDRAW_SEED_SAMPLE_USER=false
   QUEUE_CONNECTION=database
   WEBPUSH_VAPID_SUBJECT=mailto:admin@mbyfootball.com
   WEBPUSH_VAPID_PUBLIC_KEY=generate-once
   WEBPUSH_VAPID_PRIVATE_KEY=generate-once
   ```

   For a subfolder installation such as `public_html/luckydraw`, use:

   ```dotenv
   APP_URL=https://your-domain.example/luckydraw
   ASSET_URL=https://your-domain.example/luckydraw
   SESSION_PATH=/luckydraw
   ```

5. Through Hostinger SSH, run:

   ```bash
   cd /home/USER/domains/DOMAIN/public_html
   composer install --no-dev --optimize-autoloader --no-interaction
   php artisan key:generate
   php artisan webpush:vapid
   php artisan migrate --force
   php artisan db:seed --force
   php artisan optimize
   ```

   Run `php artisan webpush:vapid` only once. Copy its two values into `.env`,
   then run `php artisan config:clear`. Never regenerate VAPID keys after users
   subscribe or their existing device subscriptions will stop working.

6. Configure a cron job to run every minute:

   ```text
   /usr/bin/php /home/USER/domains/DOMAIN/public_html/artisan schedule:run
   ```

   This single scheduler cron also drains the database-backed `push` queue in
   short non-overlapping runs; no always-running queue worker is required on
   shared hosting.

## Automatic deployments

Enable **Auto Deployment** for the `main` branch in hPanel. Hostinger will then
deploy each push to `main`. GitHub Actions runs the complete test/build gate on
every push and pull request.

Before pushing frontend changes, run `npm run build` and commit the updated
`public/build` files. CI rejects a commit whose compiled bundle is stale.

When a release contains a new database migration, run this through Hostinger SSH
after deployment:

```bash
php artisan migrate --force
php artisan optimize
```

Full zero-touch migrations can be added later with an SSH deployment workflow
after the Hostinger SSH host, port, username, application path, and deployment
key are available as GitHub Actions secrets.
