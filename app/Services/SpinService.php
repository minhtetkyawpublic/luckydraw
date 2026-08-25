<?php

namespace App\Services;

use App\Models\ApplicationSetting;
use App\Models\DailyFreeSpin;
use App\Models\DailyPointClaim;
use App\Models\PointTransaction;
use App\Models\SpinCreditTransaction;
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
        private readonly SpinCreditService $spinCreditService,
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
                'points_awarded' => $segment->reward_type === 'points' ? $segment->points_reward : 0,
                'spins_awarded' => $segment->reward_type === 'spins' ? $segment->spins_reward : 0,
                'is_free_spin' => true,
                'random_seed' => Str::uuid()->toString(),
                'algorithm_version' => 'v1',
                'result_payload' => [
                    'segment_label' => $segment->label,
                    'segment_weight' => $segment->weight,
                ],
            ]);

            $this->applyReward($user, $event, $segment, true);

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

            $segment = $this->eligibility->chooseRewardSegment($config, $user->id);

            $event = SpinEvent::create([
                'user_id' => $user->id,
                'spin_configuration_id' => $config->id,
                'spin_segment_id' => $segment->id,
                'points_spent' => 0,
                'spins_spent' => 1,
                'points_awarded' => $segment->reward_type === 'points' ? $segment->points_reward : 0,
                'spins_awarded' => $segment->reward_type === 'spins' ? $segment->spins_reward : 0,
                'is_free_spin' => false,
                'random_seed' => Str::uuid()->toString(),
                'algorithm_version' => 'v1',
                'result_payload' => [
                    'segment_label' => $segment->label,
                    'segment_weight' => $segment->weight,
                ],
            ]);

            $spinSpend = $this->spinCreditService->debit($user, 1, SpinCreditTransaction::TYPE_SPIN_SPEND, [
                'reference_type' => SpinEvent::class,
                'reference_id' => $event->id,
                'notes' => 'Spin credit used',
            ]);
            $event->update([
                'result_payload' => array_merge($event->result_payload ?? [], [
                    'spin_spend_transaction_id' => $spinSpend->id,
                    'spin_balance_after_spend' => $spinSpend->balance_after,
                ]),
            ]);
            $this->applyReward($user, $event->fresh(), $segment, false);

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
        $today = Carbon::today();
        $weekStart = $today->copy()->startOfWeek(Carbon::MONDAY);
        $weekEnd = $weekStart->copy()->addDays(6);
        $settings = ApplicationSetting::current();
        $bonusSchedule = $settings->daily_bonus_schedule;
        if (! is_array($bonusSchedule) || count($bonusSchedule) !== 7) {
            $bonusSchedule = array_fill(0, 7, (int) $settings->daily_bonus_points);
        }

        $claims = DailyPointClaim::query()
            ->where('user_id', $user->id)
            ->whereBetween('claim_date', [$weekStart->toDateString(), $weekEnd->toDateString()])
            ->get(['claim_date', 'points_awarded'])
            ->keyBy(fn (DailyPointClaim $claim) => $claim->claim_date->toDateString());

        $dailyBonusWeek = collect(range(0, 6))->map(function (int $dayOffset) use ($bonusSchedule, $claims, $today, $weekStart): array {
            $date = $weekStart->copy()->addDays($dayOffset);
            $claim = $claims->get($date->toDateString());

            $status = match (true) {
                $claim !== null => 'claimed',
                $date->isBefore($today) => 'missed',
                $date->isSameDay($today) => 'today',
                default => 'upcoming',
            };

            return [
                'day' => $dayOffset + 1,
                'weekday' => $date->format('l'),
                'date' => $date->toDateString(),
                'points' => $claim ? (int) $claim->points_awarded : (int) $bonusSchedule[$dayOffset],
                'status' => $status,
            ];
        })->all();

        $canClaimDailyBonus = ! $claims->has($today->toDateString());

        return [
            'config' => $config ? [
                'id' => $config->id,
                'name' => $config->name,
                'center_label' => $config->center_label,
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
                    'spins_reward' => (int) $segment->spins_reward,
                    'reward_type' => $segment->reward_type,
                    'reward_amount' => $segment->reward_type === 'spins' ? (int) $segment->spins_reward : (int) $segment->points_reward,
                    'weight' => (int) $segment->weight,
                ];
            })->values() ?? [],
            'can_free_spin_today' => $canFreeSpin,
            'can_claim_daily_bonus' => $canClaimDailyBonus,
            'daily_bonus_week' => $dailyBonusWeek,
            'wallet_balance' => $hasWallet ? $hasWallet->balance : 0,
            'spin_balance' => $this->spinCreditService->getOrCreateWallet($user)->balance,
            'next_paid_spin_at' => $cooldown['next_paid_spin_at'],
            'paid_spin_cooldown_remaining_seconds' => $cooldown['paid_spin_cooldown_remaining_seconds'],
        ];
    }

    private function applyReward(User $user, SpinEvent $event, $segment, bool $isFree): void
    {
        if ($segment->reward_type === 'spins') {
            $transaction = $this->spinCreditService->credit(
                $user,
                (int) $segment->spins_reward,
                SpinCreditTransaction::TYPE_WHEEL_REWARD,
                ['reference_type' => SpinEvent::class, 'reference_id' => $event->id, 'notes' => 'Wheel spin reward']
            );
            $event->update([
                'result_payload' => array_merge($event->result_payload ?? [], [
                    'reward_type' => 'spins',
                    'reward_amount' => (int) $segment->spins_reward,
                    'spin_reward_transaction_id' => $transaction->id,
                    'spin_balance_after' => $transaction->balance_after,
                    'balance_after' => $this->walletService->getOrCreateWallet($user)->balance,
                ]),
            ]);

            return;
        }

        $transaction = $this->walletService->credit(
            $user,
            (int) $segment->points_reward,
            $isFree ? PointTransaction::TYPE_FREE_SPIN_REWARD : PointTransaction::TYPE_PAID_SPIN_REWARD,
            ['reference_type' => SpinEvent::class, 'reference_id' => $event->id, 'notes' => $isFree ? 'Free spin reward' : 'Spin reward']
        );
        $event->update([
            'result_payload' => array_merge($event->result_payload ?? [], [
                'reward_type' => 'points',
                'reward_amount' => (int) $segment->points_reward,
                'reward_transaction_id' => $transaction->id,
                'balance_after' => $transaction->balance_after,
                'spin_balance_after' => $this->spinCreditService->getOrCreateWallet($user)->balance,
            ]),
        ]);
    }
}
