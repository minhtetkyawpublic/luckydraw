<?php

namespace App\Http\Controllers;

use App\Services\WalletService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WalletController extends Controller
{
    public function __construct(
        private readonly WalletService $walletService,
    ) {}

    public function show(Request $request): JsonResponse
    {
        $wallet = $this->walletService->getOrCreateWallet($request->user());

        return response()->json([
            'wallet' => [
                'id' => $wallet->id,
                'balance' => $wallet->balance,
            ],
            'user' => [
                'id' => $request->user()->id,
                'name' => $request->user()->name,
                'role' => $request->user()->role,
            ],
        ]);
    }

    public function transactions(Request $request): JsonResponse
    {
        $request->validate([
            'type' => 'nullable|string|max:100',
            'from' => 'nullable|date_format:Y-m-d',
            'to' => 'nullable|date_format:Y-m-d|after_or_equal:from',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        $type = $request->query('type');
        $from = $request->query('from');
        $to = $request->query('to');
        $page = max(1, (int) $request->query('page', 1));
        $perPage = min(100, max(5, (int) $request->query('per_page', 20)));

        $query = $request->user()->pointTransactions();

        if ($type) {
            $query->where('type', $type);
        }

        if ($from) {
            $query->where('created_at', '>=', Carbon::createFromFormat('Y-m-d', $from)->startOfDay());
        }

        if ($to) {
            $query->where('created_at', '<=', Carbon::createFromFormat('Y-m-d', $to)->endOfDay());
        }

        $transactions = $query
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate($perPage, ['*'], 'page', $page);

        return response()->json([
            'transactions' => $transactions->items(),
            'meta' => [
                'current_page' => $transactions->currentPage(),
                'per_page' => $transactions->perPage(),
                'total' => $transactions->total(),
                'last_page' => $transactions->lastPage(),
            ],
        ]);
    }
}
