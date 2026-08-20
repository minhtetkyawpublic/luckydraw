<?php

namespace App\Services;

use App\Models\DailyPointClaim;
use App\Models\PointTransaction;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

class DailyBonusService
{
    public function __construct(
        private readonly WalletService $walletService,
    ) {}

    public function claim(User $user, int $points): PointTransaction
    {
        $today = Carbon::today()->toDateString();

        try {
            return DB::transaction(function () use ($user, $today, $points) {
                $exists = DailyPointClaim::query()
                    ->where('user_id', $user->id)
                    ->where('claim_date', $today)
                    ->lockForUpdate()
                    ->exists();

                if ($exists) {
                    throw new \RuntimeException('Daily bonus already claimed.');
                }

                $transaction = $this->walletService->credit(
                    $user,
                    $points,
                    PointTransaction::TYPE_DAILY_BONUS,
                    ['notes' => 'Daily bonus']
                );

                DailyPointClaim::query()->create([
                    'user_id' => $user->id,
                    'claim_date' => $today,
                    'points_awarded' => $points,
                    'wallet_transaction_id' => $transaction->id,
                ]);

                return $transaction;
            });
        } catch (UniqueConstraintViolationException) {
            throw new \RuntimeException('Daily bonus already claimed.');
        }
    }
}
