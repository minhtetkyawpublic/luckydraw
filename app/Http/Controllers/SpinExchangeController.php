<?php

namespace App\Http\Controllers;

use App\Models\PointTransaction;
use App\Models\SpinCreditTransaction;
use App\Models\SpinExchangePackage;
use App\Services\AdminAuditService;
use App\Services\IdempotencyService;
use App\Services\SpinCreditService;
use App\Services\WalletService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SpinExchangeController extends Controller
{
    public function __construct(
        private readonly WalletService $walletService,
        private readonly SpinCreditService $spinCreditService,
        private readonly IdempotencyService $idempotencyService,
        private readonly AdminAuditService $auditService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'packages' => SpinExchangePackage::query()->where('is_active', true)->orderBy('sort_order')->orderBy('id')->get(),
            'wallet_balance' => $this->walletService->getOrCreateWallet($request->user())->balance,
            'spin_balance' => $this->spinCreditService->getOrCreateWallet($request->user())->balance,
        ]);
    }

    public function exchange(Request $request, SpinExchangePackage $package): JsonResponse
    {
        return $this->idempotencyService->handle($request, 'spins.exchange', function () use ($request, $package) {
            if (! $package->is_active) {
                return ['data' => ['message' => 'Package is not available', 'error_code' => 'PACKAGE_INACTIVE'], 'status' => 422];
            }

            try {
                $result = DB::transaction(function () use ($request, $package) {
                    $pointTransaction = $this->walletService->debit(
                        $request->user(),
                        $package->points_cost,
                        PointTransaction::TYPE_SPIN_EXCHANGE,
                        ['reference_type' => SpinExchangePackage::class, 'reference_id' => $package->id, 'notes' => 'Points exchanged for spins']
                    );
                    $spinTransaction = $this->spinCreditService->credit(
                        $request->user(),
                        $package->spins_amount,
                        SpinCreditTransaction::TYPE_EXCHANGE,
                        ['reference_type' => SpinExchangePackage::class, 'reference_id' => $package->id, 'notes' => 'Spins received from point exchange']
                    );

                    return [$pointTransaction, $spinTransaction];
                });
            } catch (\RuntimeException $e) {
                return [
                    'data' => [
                        'message' => 'Not enough points for this package',
                        'error_code' => 'INSUFFICIENT_POINTS',
                        'required_points' => $package->points_cost,
                        'wallet_balance' => $this->walletService->getOrCreateWallet($request->user())->balance,
                    ],
                    'status' => 422,
                ];
            }

            return [
                'data' => [
                    'message' => 'Points exchanged for spins',
                    'package' => $package,
                    'wallet_balance' => $result[0]->balance_after,
                    'spin_balance' => $result[1]->balance_after,
                ],
                'status' => 200,
            ];
        });
    }

    public function adminIndex(): JsonResponse
    {
        return response()->json(['packages' => SpinExchangePackage::query()->orderBy('sort_order')->orderBy('id')->get()]);
    }

    public function adminUpdate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'packages' => ['required', 'array', 'min:1', 'max:30'],
            'packages.*.id' => ['nullable', 'integer'],
            'packages.*.points_cost' => ['required', 'integer', 'min:1', 'max:1000000000'],
            'packages.*.spins_amount' => ['required', 'integer', 'min:1', 'max:1000000'],
            'packages.*.is_active' => ['required', 'boolean'],
        ]);

        DB::transaction(function () use ($data) {
            $keptIds = [];
            foreach ($data['packages'] as $index => $item) {
                $package = ! empty($item['id']) ? SpinExchangePackage::query()->find($item['id']) : null;
                $values = [
                    'points_cost' => $item['points_cost'],
                    'spins_amount' => $item['spins_amount'],
                    'is_active' => $item['is_active'],
                    'sort_order' => $index + 1,
                ];
                $package ? $package->update($values) : $package = SpinExchangePackage::query()->create($values);
                $keptIds[] = $package->id;
            }
            SpinExchangePackage::query()->whereNotIn('id', $keptIds)->delete();
        });

        $this->auditService->log([
            'actor' => $request->user(),
            'action' => 'admin.spin-exchange-packages.update',
            'subject_type' => SpinExchangePackage::class,
            'metadata' => ['packages' => $data['packages']],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return $this->adminIndex();
    }
}
