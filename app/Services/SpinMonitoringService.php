<?php

namespace App\Services;

use App\Models\SpinEvent;
use App\Models\User;
use Carbon\Carbon;

class SpinMonitoringService
{
    private const BURST_WINDOW_SECONDS = 60;

    private const BURST_THRESHOLD = 12;

    private const HOUR_THRESHOLD = 80;

    public function __construct(
        private readonly AdminAuditService $auditService,
    ) {}

    public function inspectForAnomalies(User $user): void
    {
        $recentBurst = $this->countEventsInWindow($user->id, self::BURST_WINDOW_SECONDS);
        if ($recentBurst >= self::BURST_THRESHOLD) {
            $this->auditService->log([
                'actor' => null,
                'action' => 'system.spin.suspicious_burst',
                'subject_user_id' => $user->id,
                'subject_type' => User::class,
                'subject_id' => $user->id,
                'metadata' => [
                    'window_seconds' => self::BURST_WINDOW_SECONDS,
                    'events' => $recentBurst,
                    'reason' => 'Paid/free spin burst threshold reached',
                ],
                'ip_address' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ]);
        }

        $recentHour = $this->countEventsInWindow($user->id, 60 * 60);
        if ($recentHour >= self::HOUR_THRESHOLD) {
            $this->auditService->log([
                'actor' => null,
                'action' => 'system.spin.suspicious_hour',
                'subject_user_id' => $user->id,
                'subject_type' => User::class,
                'subject_id' => $user->id,
                'metadata' => [
                    'window_seconds' => 3600,
                    'events' => $recentHour,
                    'reason' => 'Hourly spin activity threshold reached',
                ],
                'ip_address' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ]);
        }
    }

    public function getSuspiciousSummary(int $withinMinutes, int $minEvents): array
    {
        $windowStart = now()->subMinutes(max(1, $withinMinutes));

        return SpinEvent::query()
            ->with('user:id,name,email')
            ->select('user_id')
            ->selectRaw('COUNT(*) as events_in_window')
            ->selectRaw('MAX(created_at) as latest_spin_at')
            ->where('created_at', '>=', $windowStart)
            ->groupBy('user_id')
            ->having('events_in_window', '>=', max(1, $minEvents))
            ->orderByDesc('events_in_window')
            ->get()
            ->map(function (SpinEvent $record) {
                return [
                    'user_id' => (int) $record->user_id,
                    'name' => $record->user?->name,
                    'email' => $record->user?->email,
                    'events_in_window' => (int) $record->events_in_window,
                    'latest_spin_at' => (string) $record->latest_spin_at,
                ];
            })->all();
    }

    private function countEventsInWindow(int $userId, int $seconds): int
    {
        return SpinEvent::query()
            ->where('user_id', $userId)
            ->where('created_at', '>=', Carbon::now()->subSeconds($seconds))
            ->count();
    }
}
