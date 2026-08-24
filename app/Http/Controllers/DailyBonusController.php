<?php

namespace App\Http\Controllers;

use App\Models\ApplicationSetting;
use App\Models\DailyPointClaim;
use App\Services\DailyBonusService;
use App\Services\WalletService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class DailyBonusController extends Controller
{
    public function __construct(
        private readonly DailyBonusService $dailyBonusService,
        private readonly WalletService $walletService,
    ) {}

    public function claim(Request $request): JsonResponse
    {
        $todayClaimed = DailyPointClaim::query()
            ->where('user_id', $request->user()->id)
            ->where('claim_date', now()->toDateString())
            ->exists();

        if ($todayClaimed) {
            return response()->json([
                'message' => 'Daily bonus already claimed',
                'already_claimed' => true,
            ], 409);
        }

        $settings = ApplicationSetting::current();
        $schedule = $settings->daily_bonus_schedule;
        $bonusPoints = (int) ($schedule[now()->dayOfWeek] ?? $settings->daily_bonus_points);

        try {
            $transaction = $this->dailyBonusService->claim($request->user(), $bonusPoints);
            $wallet = $this->walletService->getOrCreateWallet($request->user())->refresh();
        } catch (RuntimeException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'already_claimed' => str_contains(strtolower($e->getMessage()), 'already claimed'),
            ], 409);
        }

        return response()->json([
            'message' => 'Bonus claimed',
            'transaction' => $transaction->only(['id', 'type', 'amount', 'balance_after', 'created_at']),
            'wallet' => $wallet->only(['id', 'balance']),
        ]);
    }
}
