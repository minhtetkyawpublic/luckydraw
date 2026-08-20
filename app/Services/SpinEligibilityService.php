<?php

namespace App\Services;

use App\Models\DailyFreeSpin;
use App\Models\SpinConfiguration;
use App\Models\SpinEvent;
use App\Models\SpinSegment;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class SpinEligibilityService
{
    public function getActiveConfiguration(): ?SpinConfiguration
    {
        $now = now();

        return SpinConfiguration::query()
            ->with(['segments' => fn ($query) => $query->where('is_active', true)->orderBy('id')])
            ->where('is_active', true)
            ->where(function ($query) use ($now) {
                $query->whereNull('starts_at')->orWhere('starts_at', '<=', $now);
            })
            ->where(function ($query) use ($now) {
                $query->whereNull('ends_at')->orWhere('ends_at', '>=', $now);
            })
            ->orderByDesc('id')
            ->first();
    }

    public function hasUsedFreeSpinToday(int $userId): bool
    {
        $today = Carbon::today()->toDateString();

        return DailyFreeSpin::query()
            ->where('user_id', $userId)
            ->where('spin_date', $today)
            ->exists();
    }

    public function chooseRewardSegment(SpinConfiguration $configuration, int $userId): SpinSegment
    {
        $segments = $this->getAvailableRewardSegments($configuration, $userId);
        if ($segments->isEmpty()) {
            throw new \RuntimeException('Spin has no active reward segments.');
        }

        $totalWeight = $segments->sum('weight');
        $pointer = random_int(1, max(1, $totalWeight));
        $running = 0;

        foreach ($segments as $segment) {
            $running += $segment->weight;
            if ($pointer <= $running) {
                return $segment;
            }
        }

        return $segments->first();
    }

    public function getAvailableRewardSegments(SpinConfiguration $configuration, int $userId): Collection
    {
        $segments = $configuration->segments()->where('is_active', true)->where('weight', '>', 0)->get();
        $limitedSegmentIds = $segments
            ->filter(fn (SpinSegment $segment) => (int) ($segment->max_win_per_day ?? 0) > 0)
            ->pluck('id');

        $winsBySegment = collect();
        if ($limitedSegmentIds->isNotEmpty()) {
            $today = Carbon::today();
            $winsBySegment = SpinEvent::query()
                ->selectRaw('spin_segment_id, COUNT(*) as win_count')
                ->where('user_id', $userId)
                ->whereIn('spin_segment_id', $limitedSegmentIds)
                ->whereBetween('created_at', [$today->copy()->startOfDay(), $today->copy()->endOfDay()])
                ->groupBy('spin_segment_id')
                ->pluck('win_count', 'spin_segment_id');
        }

        return $segments->filter(function (SpinSegment $segment) use ($winsBySegment) {
            $max = (int) ($segment->max_win_per_day ?? 0);
            if ($max <= 0) {
                return true;
            }

            $wins = (int) ($winsBySegment[$segment->id] ?? 0);

            return $wins < $max;
        })->values();
    }

    public function getSpinDailyCap(SpinEvent $event): int
    {
        return $event->segment?->max_win_per_day ?? 0;
    }

    public function getLatestPaidSpin(int $userId): ?SpinEvent
    {
        return SpinEvent::query()
            ->where('user_id', $userId)
            ->where('is_free_spin', false)
            ->latest()
            ->first();
    }

    public function getPaidSpinCooldownInfo(int $userId, ?SpinConfiguration $config = null): array
    {
        $config = $config ?? $this->getActiveConfiguration();
        if (! $config || $config->cooldown_seconds <= 0) {
            return [
                'next_paid_spin_at' => null,
                'paid_spin_cooldown_remaining_seconds' => 0,
            ];
        }

        $latestSpin = $this->getLatestPaidSpin($userId);
        if (! $latestSpin) {
            return [
                'next_paid_spin_at' => null,
                'paid_spin_cooldown_remaining_seconds' => 0,
            ];
        }

        $unblockAt = Carbon::parse($latestSpin->created_at)->addSeconds($config->cooldown_seconds);
        $remaining = (int) ceil(max(
            0,
            ($unblockAt->getPreciseTimestamp(6) - now()->getPreciseTimestamp(6)) / 1_000_000
        ));

        return [
            'next_paid_spin_at' => $remaining > 0 ? $unblockAt->toDateTimeString() : null,
            'paid_spin_cooldown_remaining_seconds' => max(0, (int) $remaining),
        ];
    }

    public function assertPaidSpinAllowed(User $user): void
    {
        $config = $this->getActiveConfiguration();
        if (! $config) {
            throw new \RuntimeException('No active spin configuration.');
        }

        $cooldown = $this->getPaidSpinCooldownInfo($user->id, $config);
        if (($cooldown['paid_spin_cooldown_remaining_seconds'] ?? 0) > 0) {
            throw new \RuntimeException(
                'Spin cooldown active. Please wait '.$cooldown['paid_spin_cooldown_remaining_seconds'].' seconds.'
            );
        }
    }

    public function assertPaidSpinAllowedAt(User $user, ?SpinConfiguration $config = null): void
    {
        $config = $config ?? $this->getActiveConfiguration();
        if (! $config) {
            throw new \RuntimeException('No active spin configuration.');
        }

        $cooldown = $this->getPaidSpinCooldownInfo($user->id, $config);
        if (($cooldown['paid_spin_cooldown_remaining_seconds'] ?? 0) > 0) {
            throw new \RuntimeException(
                'Spin cooldown active. Please wait '.$cooldown['paid_spin_cooldown_remaining_seconds'].' seconds.'
            );
        }
    }

    public function getActiveConfigurationWithSegments(): ?SpinConfiguration
    {
        return $this->getActiveConfiguration()?->loadMissing('segments');
    }

    public function assertValidConfigurationSegments(int $configurationId): void
    {
        $configuration = SpinConfiguration::query()
            ->with(['segments' => fn ($query) => $query->where('is_active', true)])
            ->find($configurationId);
        if (! $configuration) {
            throw new \RuntimeException('Spin configuration not found.');
        }

        $segments = $configuration->segments;
        if ($segments->isEmpty()) {
            throw new \RuntimeException('Spin configuration has no reward segments.');
        }

        $totalWeight = $segments->sum('weight');
        if ($totalWeight <= 0) {
            throw new \RuntimeException('Spin configuration segments must have total weight greater than zero.');
        }
    }
}
