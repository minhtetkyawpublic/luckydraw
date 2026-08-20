<?php

use App\Services\IdempotencyService;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('lucky-draw:cleanup-idempotency', function (IdempotencyService $idempotencyService) {
    $count = $idempotencyService->purgeExpiredEntries();
    $this->info("Purged {$count} expired idempotency keys.");
})->purpose('Clean up expired spin idempotency keys');
