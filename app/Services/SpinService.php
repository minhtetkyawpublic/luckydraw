<?php

namespace App\Services;

use App\Models\DailyFreeSpin;
use App\Models\DailyPointClaim;
use App\Models\PointsWallet;
use App\Models\PointTransaction;
use App\Models\SpinEvent;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SpinService
{
    public function __construct(
        private readonly WalletService $walletService,
        private readonly SpinEligibilityService $eligibility,
        private readonly SpinMonitoringService $monitoringService,
    ) {}

    public function freeSpin(User $user): SpinEvent
    {
        $today = Carbon::today()->toDateString();

        return DB::transaction(function () use ($user, $today) {
            $config = $this->eligibility->getActiveConfiguration();

            if (! $config) {
                throw new \RuntimeException('No active spin configuration.');
            }

            if (DailyFreeSpin::query()->where('user_id', $user->id)->where('spin_date', $today)->lockForUpdate()->exists()) {
                throw new \RuntimeException('Daily free spin already used.');
            }

            $segment = $this->eligibility->chooseRewardSegment($config, $user->id);

            $event = SpinEvent::create([
                'user_id' => $user->id,
                'spin_configuration_id' => $config->id,
                'spin_segment_id' => $segment->id,
                'points_spent' => 0,
                'points_awarded' => $segment->points_reward,
                'is_free_spin' => true,
                'random_seed' => Str::uuid()->toString(),
                'algorithm_version' => 'v1',
                'result_payload' => [
                    'segment_label' => $segment->label,
                    'segment_weight' => $segment->weight,
                ],
            ]);

            $transaction = $this->walletService->credit(
                $user,
                $segment->points_reward,
                PointTransaction::TYPE_FREE_SPIN_REWARD,
                [
                    'reference_type' => SpinEvent::class,
                    'reference_id' => $event->id,
                    'notes' => 'Free spin reward',
                ]
            );

            $event->update([
                'points_awarded' => $segment->points_reward,
                'result_payload' => array_merge($event->result_payload ?? [], [
                    'transaction_id' => $transaction->id,
                    'balance_after' => $transaction->balance_after,
                ]),
            ]);

            try {
                DailyFreeSpin::query()->create([
                    'user_id' => $user->id,
                    'spin_date' => $today,
                    'spin_event_id' => $event->id,
                ]);
            } catch (QueryException) {
                throw new \RuntimeException('Daily free spin already used.');
            }

            $this->monitoringService->inspectForAnomalies($user);

            return $event->fresh();
        });
    }

    public function paidSpin(User $user): SpinEvent
    {
        return DB::transaction(function () use ($user) {
            $config = $this->eligibility->getActiveConfiguration();

            if (! $config) {
                throw new \RuntimeException('No active spin configuration.');
            }

            $this->eligibility->assertPaidSpinAllowedAt($user, $config);

            try {
                $wallet = PointsWallet::query()
                    ->where('user_id', $user->id)
                    ->lockForUpdate()
                    ->first();

                if (! $wallet) {
                    $wallet = PointsWallet::query()->create([
                        'user_id' => $user->id,
                        'balance' => 0,
                    ]);
                }
            } catch (QueryException) {
                $wallet = PointsWallet::query()->where('user_id', $user->id)->lockForUpdate()->firstOrFail();
            }

            if (! $wallet || $wallet->balance < $config->cost_points) {
                throw new \RuntimeException('Insufficient balance');
            }

            $segment = $this->eligibility->chooseRewardSegment($config, $user->id);

            $event = SpinEvent::create([
                'user_id' => $user->id,
                'spin_configuration_id' => $config->id,
                'spin_segment_id' => $segment->id,
                'points_spent' => $config->cost_points,
                'points_awarded' => $segment->points_reward,
                'is_free_spin' => false,
                'random_seed' => Str::uuid()->toString(),
                'algorithm_version' => 'v1',
                'result_payload' => [
                    'segment_label' => $segment->label,
                    'segment_weight' => $segment->weight,
                ],
            ]);

            $spendBalanceAfter = $wallet->balance - $config->cost_points;

            PointTransaction::create([
                'wallet_id' => $wallet->id,
                'user_id' => $user->id,
                'type' => PointTransaction::TYPE_SPIN_SPEND,
                'amount' => -abs($config->cost_points),
                'balance_after' => $spendBalanceAfter,
                'reference_type' => SpinEvent::class,
                'reference_id' => $event->id,
                'notes' => 'Paid spin spend',
            ]);

            $wallet = PointsWallet::query()->where('id', $wallet->id)->lockForUpdate()->firstOrFail();
            $wallet->update([
                'balance' => $spendBalanceAfter,
            ]);

            $rewardBalanceAfter = $spendBalanceAfter + $segment->points_reward;
            $rewardTransaction = PointTransaction::create([
                'wallet_id' => $wallet->id,
                'user_id' => $user->id,
                'type' => PointTransaction::TYPE_PAID_SPIN_REWARD,
                'amount' => $segment->points_reward,
                'balance_after' => $rewardBalanceAfter,
                'reference_type' => SpinEvent::class,
                'reference_id' => $event->id,
                'notes' => 'Paid spin reward',
            ]);

            $wallet->update(['balance' => $rewardBalanceAfter]);

            $event->update([
                'result_payload' => array_merge($event->result_payload ?? [], [
                    'reward_transaction_id' => $rewardTransaction->id,
                    'balance_after' => $rewardTransaction->balance_after,
                ]),
            ]);

            $this->monitoringService->inspectForAnomalies($user);

            return $event->fresh();
        });
    }

    public function getStatusForUser(User $user): array
    {
        $config = $this->eligibility->getActiveConfiguration();
        $canFreeSpin = true;
        $hasWallet = null;

        try {
            $hasWallet = $this->walletService->getOrCreateWallet($user);
        } catch (\Throwable) {
            $hasWallet = null;
        }

        if ($this->eligibility->hasUsedFreeSpinToday($user->id)) {
            $canFreeSpin = false;
        }

        $cooldown = $this->eligibility->getPaidSpinCooldownInfo($user->id, $config);

        return [
            'config' => $config ? [
                'id' => $config->id,
                'name' => $config->name,
                'center_label' => $config->center_label,
                'cost_points' => $config->cost_points,
                'cooldown_seconds' => $config->cooldown_seconds,
                'is_active' => $config->is_active,
            ] : null,
            'segments' => $config?->segments?->map(function ($segment) {
                return [
                    'id' => $segment->id,
                    'label' => $segment->label,
                    'color' => $segment->color,
                    'text_color' => $segment->text_color,
                    'points_reward' => (int) $segment->points_reward,
                    'weight' => (int) $segment->weight,
                ];
            })->values() ?? [],
            'can_free_spin_today' => $canFreeSpin,
            'can_claim_daily_bonus' => ! DailyPointClaim::query()
                ->where('user_id', $user->id)
                ->where('claim_date', Carbon::today()->toDateString())
                ->exists(),
            'wallet_balance' => $hasWallet ? $hasWallet->balance : 0,
            'next_paid_spin_at' => $cooldown['next_paid_spin_at'],
            'paid_spin_cooldown_remaining_seconds' => $cooldown['paid_spin_cooldown_remaining_seconds'],
        ];
    }
}
