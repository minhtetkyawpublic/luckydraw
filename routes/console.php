<?php

use App\Services\IdempotencyService;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('lucky-draw:cleanup-idempotency', function (IdempotencyService $idempotencyService) {
    $count = $idempotencyService->purgeExpiredEntries();
    $this->info("Purged {$count} expired idempotency keys.");
})->purpose('Clean up expired spin idempotency keys');

// Hostinger only needs one schedule:run cron entry. This drains push jobs in
// short, non-overlapping batches without requiring a permanent queue daemon.
Schedule::command('queue:work database --queue=push --stop-when-empty --tries=3 --timeout=120')
    ->everyMinute()
    ->withoutOverlapping(10);
