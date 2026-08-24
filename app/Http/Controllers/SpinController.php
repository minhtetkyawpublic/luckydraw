<?php

namespace App\Http\Controllers;

use App\Models\SpinEvent;
use App\Services\IdempotencyService;
use App\Services\SpinCreditService;
use App\Services\SpinEligibilityService;
use App\Services\SpinService;
use App\Services\WalletService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class SpinController extends Controller
{
    public function __construct(
        private readonly SpinService $spinService,
        private readonly SpinEligibilityService $spinEligibilityService,
        private readonly WalletService $walletService,
        private readonly SpinCreditService $spinCreditService,
        private readonly IdempotencyService $idempotencyService,
    ) {}

    public function free(Request $request): JsonResponse
    {
        return $this->idempotencyService->handle($request, 'spin.free', function () use ($request) {
            try {
                $event = $this->spinService->freeSpin($request->user())->load('segment');
            } catch (RuntimeException $e) {
                if ($e->getMessage() === 'No active spin configuration.') {
                    return [
                        'data' => [
                            'message' => $e->getMessage(),
                            'error_code' => 'NO_ACTIVE_CONFIGURATION',
                        ],
                        'status' => 422,
                    ];
                }

                if ($e->getMessage() === 'Daily free spin already used.') {
                    return [
                        'data' => [
                            'message' => $e->getMessage(),
                            'error_code' => 'FREE_SPIN_ALREADY_USED',
                            'can_free_spin_today' => false,
                        ],
                        'status' => 409,
                    ];
                }

                if (str_starts_with($e->getMessage(), 'Spin has no active reward segments.')) {
                    return [
                        'data' => [
                            'message' => $e->getMessage(),
                            'error_code' => 'NO_ACTIVE_SEGMENTS',
                        ],
                        'status' => 409,
                    ];
                }

                return [
                    'data' => ['message' => $e->getMessage()],
                    'status' => 409,
                ];
            }

            return [
                'data' => [
                    'message' => 'Free spin completed',
                    'spin' => [
                        'event_id' => $event->id,
                        'points_spent' => $event->points_spent,
                        'points_awarded' => $event->points_awarded,
                        'spins_spent' => $event->spins_spent,
                        'spins_awarded' => $event->spins_awarded,
                        'reward_type' => $event->result_payload['reward_type'] ?? 'points',
                        'reward_amount' => $event->result_payload['reward_amount'] ?? $event->points_awarded,
                        'is_free_spin' => $event->is_free_spin,
                        'segment' => $event->segment?->label,
                        'segment_id' => $event->spin_segment_id,
                        'segment_order' => $this->resolveSegmentOrder($event),
                        'seed' => $event->random_seed,
                        'balance_after' => $event->result_payload['balance_after'] ?? null,
                        'spin_balance_after' => $event->result_payload['spin_balance_after'] ?? null,
                    ],
                    'wallet' => $request->user()->wallet?->refresh()?->only(['balance']),
                ],
                'status' => 200,
            ];
        });
    }

    public function paid(Request $request): JsonResponse
    {
        return $this->idempotencyService->handle($request, 'spin.paid', function () use ($request) {
            $config = $this->spinEligibilityService->getActiveConfiguration();

            if (! $config) {
                return [
                    'data' => ['message' => 'No active spin configuration'],
                    'status' => 422,
                ];
            }

            $spinWallet = $this->spinCreditService->getOrCreateWallet($request->user());
            if ($spinWallet->balance < 1) {
                return [
                    'data' => [
                        'message' => 'Insufficient spins',
                        'error_code' => 'INSUFFICIENT_SPINS',
                        'required_spins' => 1,
                        'spin_balance' => $spinWallet->balance,
                    ],
                    'status' => 422,
                ];
            }

            try {
                $event = $this->spinService->paidSpin($request->user())->load('segment');
            } catch (RuntimeException $e) {
                if (str_starts_with($e->getMessage(), 'Spin cooldown active')) {
                    return [
                        'data' => [
                            'message' => 'Cooldown active',
                            'error_code' => 'COOLDOWN_ACTIVE',
                            'paid_spin_cooldown_remaining_seconds' => $this->spinEligibilityService
                                ->getPaidSpinCooldownInfo($request->user()->id, $config)['paid_spin_cooldown_remaining_seconds'],
                        ],
                        'status' => 429,
                    ];
                }

                if ($e->getMessage() === 'Insufficient spins') {
                    return [
                        'data' => [
                            'message' => $e->getMessage(),
                            'error_code' => 'INSUFFICIENT_SPINS',
                            'required_spins' => 1,
                            'spin_balance' => $this->spinCreditService->getOrCreateWallet($request->user())->balance,
                        ],
                        'status' => 422,
                    ];
                }

                return [
                    'data' => ['message' => $e->getMessage()],
                    'status' => 409,
                ];
            }

            return [
                'data' => [
                    'message' => 'Paid spin completed',
                    'spin' => [
                        'event_id' => $event->id,
                        'points_spent' => $event->points_spent,
                        'points_awarded' => $event->points_awarded,
                        'spins_spent' => $event->spins_spent,
                        'spins_awarded' => $event->spins_awarded,
                        'reward_type' => $event->result_payload['reward_type'] ?? 'points',
                        'reward_amount' => $event->result_payload['reward_amount'] ?? $event->points_awarded,
                        'is_free_spin' => $event->is_free_spin,
                        'segment' => $event->segment?->label,
                        'segment_id' => $event->spin_segment_id,
                        'segment_order' => $this->resolveSegmentOrder($event),
                        'seed' => $event->random_seed,
                        'balance_after' => $event->result_payload['balance_after'] ?? null,
                        'spin_balance_after' => $event->result_payload['spin_balance_after'] ?? null,
                    ],
                    'wallet' => $request->user()->wallet?->refresh()?->only(['balance']),
                ],
                'status' => 200,
            ];
        });
    }

    public function me(Request $request): JsonResponse
    {
        $type = $request->query('type');
        $userId = (int) $request->query('user_id', 0);
        $page = max(1, (int) $request->query('page', 1));
        $perPage = min(100, max(5, (int) $request->query('per_page', 20)));

        $query = $request->user()->spinEvents()->latest();

        if ($type === 'free') {
            $query->where('is_free_spin', true);
        } elseif ($type === 'paid') {
            $query->where('is_free_spin', false);
        } elseif ($type !== null) {
            return response()->json([
                'message' => 'Invalid type filter',
            ], 422);
        }

        if ($userId > 0) {
            if (! $request->user()->isAdmin()) {
                return response()->json([
                    'message' => 'Forbidden',
                ], 403);
            }

            $query->where('user_id', $userId);
        }

        $events = $query->paginate($perPage, ['*'], 'page', $page);

        return response()->json([
            'spins' => $events->items(),
            'meta' => [
                'current_page' => $events->currentPage(),
                'per_page' => $events->perPage(),
                'total' => $events->total(),
                'last_page' => $events->lastPage(),
            ],
        ]);
    }

    public function status(Request $request): JsonResponse
    {
        $user = $request->user();
        $status = $this->spinService->getStatusForUser($user);

        return response()->json(['status' => $status]);
    }

    private function resolveSegmentOrder(SpinEvent $event): int
    {
        $configuration = $event->configuration()->with('segments')->first();
        if (! $configuration) {
            return 0;
        }

        $segmentIds = $configuration->segments()
            ->where('is_active', true)
            ->orderBy('id')
            ->pluck('id')
            ->values();
        $position = $segmentIds->search($event->spin_segment_id);

        return $position === false ? 0 : ((int) $position);
    }
}
