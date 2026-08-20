<?php

namespace App\Http\Controllers;

use App\Models\PointTransaction;
use App\Models\SpinEvent;
use App\Models\User;
use App\Services\AdminAuditService;
use App\Services\SpinMonitoringService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpFoundation\Response;

class AdminReportController extends Controller
{
    public function __construct(
        private readonly AdminAuditService $auditService,
        private readonly SpinMonitoringService $monitoringService,
    ) {}

    public function spinsExport(Request $request): Response
    {
        $data = $request->validate([
            'user_id' => 'sometimes|integer|exists:users,id',
            'type' => 'sometimes|in:free,paid',
            'from' => 'sometimes|date',
            'to' => 'sometimes|date|after_or_equal:from',
        ]);

        $query = SpinEvent::query()
            ->with('user:id,name,email')
            ->orderByDesc('created_at');

        if (! empty($data['user_id'])) {
            $query->where('user_id', (int) $data['user_id']);
        }

        if (! empty($data['type'])) {
            $query->where('is_free_spin', $data['type'] === 'free');
        }

        if (! empty($data['from'])) {
            $query->whereDate('created_at', '>=', $data['from']);
        }

        if (! empty($data['to'])) {
            $query->whereDate('created_at', '<=', $data['to']);
        }

        $events = $query->get();

        $rows = [
            ['id', 'user_id', 'user_name', 'user_email', 'is_free_spin', 'points_spent', 'points_awarded', 'spin_configuration_id', 'spin_segment_id', 'created_at'],
        ];

        foreach ($events as $event) {
            $rows[] = [
                $event->id,
                $event->user_id,
                $event->user?->name,
                $event->user?->email,
                $event->is_free_spin ? 'free' : 'paid',
                $event->points_spent,
                $event->points_awarded,
                $event->spin_configuration_id,
                $event->spin_segment_id,
                optional($event->created_at)->toISOString(),
            ];
        }

        $this->auditService->log([
            'actor' => $request->user(),
            'action' => 'admin.reports.spins-export',
            'metadata' => [
                'filters' => $data,
                'count' => $events->count(),
            ],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response($this->buildCsvContent($rows), 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="spins-'.now()->format('Ymd_His').'.csv"',
        ]);
    }

    public function transactionsExport(Request $request): Response
    {
        $data = $request->validate([
            'user_id' => 'sometimes|integer|exists:users,id',
            'type' => 'sometimes|string',
            'from' => 'sometimes|date',
            'to' => 'sometimes|date|after_or_equal:from',
            'min_amount' => 'sometimes|integer',
            'max_amount' => 'sometimes|integer',
        ]);

        $query = PointTransaction::query()
            ->with('user:id,name,email,wallet_id')
            ->orderByDesc('created_at');

        if (! empty($data['user_id'])) {
            $query->where('user_id', (int) $data['user_id']);
        }

        if (! empty($data['type'])) {
            $query->where('type', $data['type']);
        }

        if (! empty($data['from'])) {
            $query->whereDate('created_at', '>=', $data['from']);
        }

        if (! empty($data['to'])) {
            $query->whereDate('created_at', '<=', $data['to']);
        }

        if (array_key_exists('min_amount', $data)) {
            $query->where('amount', '>=', (int) $data['min_amount']);
        }

        if (array_key_exists('max_amount', $data)) {
            $query->where('amount', '<=', (int) $data['max_amount']);
        }

        $transactions = $query->get();

        $rows = [
            ['id', 'user_id', 'user_name', 'user_email', 'wallet_id', 'type', 'amount', 'balance_after', 'status', 'notes', 'created_at'],
        ];
        foreach ($transactions as $transaction) {
            $rows[] = [
                $transaction->id,
                $transaction->user_id,
                $transaction->user?->name,
                $transaction->user?->email,
                $transaction->wallet_id,
                $transaction->type,
                $transaction->amount,
                $transaction->balance_after,
                $transaction->status,
                $transaction->notes,
                optional($transaction->created_at)->toISOString(),
            ];
        }

        $this->auditService->log([
            'actor' => $request->user(),
            'action' => 'admin.reports.transactions-export',
            'metadata' => [
                'filters' => $data,
                'count' => $transactions->count(),
            ],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response($this->buildCsvContent($rows), 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="transactions-'.now()->format('Ymd_His').'.csv"',
        ]);
    }

    public function summary(Request $request): JsonResponse
    {
        $data = $request->validate([
            'from' => 'sometimes|date',
            'to' => 'sometimes|date|after_or_equal:from',
        ]);

        $spinQuery = SpinEvent::query();
        if (! empty($data['from'])) {
            $spinQuery->whereDate('created_at', '>=', $data['from']);
        }
        if (! empty($data['to'])) {
            $spinQuery->whereDate('created_at', '<=', $data['to']);
        }

        $spinSummary = [
            'total_spins' => (int) (clone $spinQuery)->count(),
            'free_spins' => (int) (clone $spinQuery)->where('is_free_spin', true)->count(),
            'paid_spins' => (int) (clone $spinQuery)->where('is_free_spin', false)->count(),
            'total_awarded_points' => (int) (clone $spinQuery)->sum('points_awarded'),
            'total_spent_points' => (int) (clone $spinQuery)->sum('points_spent'),
            'active_users_spun' => (int) (clone $spinQuery)->distinct('user_id')->count('user_id'),
        ];

        $transactionQuery = PointTransaction::query();
        if (! empty($data['from'])) {
            $transactionQuery->whereDate('created_at', '>=', $data['from']);
        }
        if (! empty($data['to'])) {
            $transactionQuery->whereDate('created_at', '<=', $data['to']);
        }

        $transactionSummary = [
            'total_transactions' => (int) (clone $transactionQuery)->count(),
            'total_wallet_users' => (int) User::query()->where('role', 'user')->count(),
            'admin_adjustments' => (int) (clone $transactionQuery)->where('type', 'admin_adjustment')->count(),
            'unique_wallet_users' => (int) (clone $transactionQuery)->distinct('user_id')->count('user_id'),
        ];

        $this->auditService->log([
            'actor' => $request->user(),
            'action' => 'admin.reports.summary',
            'metadata' => ['filters' => $data],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response()->json([
            'summary' => [
                'period' => [
                    'from' => $data['from'] ?? null,
                    'to' => $data['to'] ?? null,
                ],
                'spin' => $spinSummary,
                'transactions' => $transactionSummary,
                'monitoring' => [
                    'suspicious_users_minute_window' => $this->monitoringService->getSuspiciousSummary(
                        1,
                        12,
                    ),
                    'suspicious_users_hour_window' => $this->monitoringService->getSuspiciousSummary(
                        60,
                        80,
                    ),
                ],
            ],
        ]);
    }

    public function suspiciousSpins(Request $request): JsonResponse
    {
        $data = $request->validate([
            'within_minutes' => 'sometimes|integer|min:1|max:10080',
            'min_events' => 'sometimes|integer|min:1|max:10000',
        ]);

        $withinMinutes = (int) ($data['within_minutes'] ?? 60);
        $minEvents = (int) ($data['min_events'] ?? 12);

        $this->auditService->log([
            'actor' => $request->user(),
            'action' => 'admin.monitoring.suspicious-spins',
            'metadata' => [
                'within_minutes' => $withinMinutes,
                'min_events' => $minEvents,
            ],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response()->json([
            'data' => $this->monitoringService->getSuspiciousSummary($withinMinutes, $minEvents),
        ]);
    }

    public function health(Request $request): JsonResponse
    {
        $alertLevel = [];
        $status = 'healthy';

        try {
            DB::selectOne('select 1 as connected');
            $database = [
                'connected' => true,
                'name' => config('database.connections.'.config('database.default').'.database'),
            ];
        } catch (\Throwable $e) {
            $database = [
                'connected' => false,
                'error' => $e->getMessage(),
            ];
            $status = 'degraded';
            $alertLevel[] = [
                'code' => 'DB_UNAVAILABLE',
                'message' => 'Database connection failed',
                'severity' => 'critical',
            ];
        }

        $activeUsers = User::query()->where('role', 'user')->where('status', 'active')->count();
        $recentWindowMinutes = max(1, (int) config('phase4.health_recent_spin_window_minutes', 15));
        $suspiciousWindowThreshold = max(1, (int) config('phase4.health_suspicious_minute_threshold', 12));

        $recentSpinQuery = SpinEvent::query()
            ->where('created_at', '>=', now()->subMinutes($recentWindowMinutes));
        $recentSpins = (int) $recentSpinQuery->count();
        $recentActiveSpinners = (int) $recentSpinQuery->distinct('user_id')->count('user_id');

        if ($recentSpins >= 2 * $suspiciousWindowThreshold && $status !== 'degraded') {
            $status = 'warning';
            $alertLevel[] = [
                'code' => 'SPIN_VOLUME_SPIKE',
                'message' => "High spin volume in the last {$recentWindowMinutes} minutes",
                'severity' => 'warning',
            ];
        }

        $recentSuspicious = $this->monitoringService->getSuspiciousSummary(1, $suspiciousWindowThreshold);
        if (count($recentSuspicious) > 0 && $status !== 'degraded') {
            $status = 'warning';
            $alertLevel[] = [
                'code' => 'SUSPICIOUS_ACTIVITY',
                'message' => count($recentSuspicious).' user(s) exceeded suspicious activity threshold in last 60 minutes',
                'severity' => 'warning',
            ];
        }

        if (config('phase4.health_require_job_table', true) && ! Schema::hasTable('jobs')) {
            $status = 'warning';
            $alertLevel[] = [
                'code' => 'JOBS_TABLE_MISSING',
                'message' => 'jobs table missing',
                'severity' => 'warning',
            ];
        }

        $this->auditService->log([
            'actor' => $request->user(),
            'action' => 'admin.reports.health',
            'metadata' => [
                'status' => $status,
                'alerts' => $alertLevel,
                'recent_window_minutes' => $recentWindowMinutes,
                'suspicious_threshold' => $suspiciousWindowThreshold,
                'recent_spins' => $recentSpins,
            ],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response()->json([
            'status' => $status,
            'time' => now()->toDateTimeString(),
            'database' => $database,
            'counts' => [
                'users' => [
                    'active_users' => $activeUsers,
                ],
                'spins' => [
                    'recent_spins' => $recentSpins,
                    'recent_active_spinners' => $recentActiveSpinners,
                ],
                'alerts' => [
                    'recent_suspicious_users' => count($recentSuspicious),
                ],
            ],
            'alerts' => $alertLevel,
            'app' => [
                'php_version' => PHP_VERSION,
                'framework' => app()->version(),
                'env' => app()->environment(),
            ],
            'checks' => [
                'health_window_minutes' => $recentWindowMinutes,
                'suspicious_minute_threshold' => $suspiciousWindowThreshold,
            ],
        ]);
    }

    private function buildCsvContent(array $rows): string
    {
        $escapedRows = [];
        foreach ($rows as $row) {
            $escapedRows[] = implode(',', array_map(function (mixed $value): string {
                return $this->escapeCsvValue((string) ($value ?? ''));
            }, $row));
        }

        return implode(PHP_EOL, $escapedRows).PHP_EOL;
    }

    private function escapeCsvValue(string $value): string
    {
        $containsSpecialChars = str_contains($value, '"')
            || str_contains($value, ',')
            || str_contains($value, "\n")
            || str_contains($value, "\r");

        if (! $containsSpecialChars) {
            return $value;
        }

        return '"'.str_replace('"', '""', $value).'"';
    }
}
