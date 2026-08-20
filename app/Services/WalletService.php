<?php

namespace App\Services;

use App\Models\PointsWallet;
use App\Models\PointTransaction;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

class WalletService
{
    public function withWalletForUpdate(User $user, callable $callback): mixed
    {
        return DB::transaction(function () use ($user, $callback) {
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

            return $callback($wallet);
        });
    }

    public function getOrCreateWallet(User $user): PointsWallet
    {
        if ($user->isAdmin()) {
            throw new \LogicException('Administrator accounts do not have point wallets.');
        }

        try {
            return PointsWallet::query()->firstOrCreate(
                ['user_id' => $user->id],
                ['balance' => 0]
            );
        } catch (UniqueConstraintViolationException) {
            return PointsWallet::query()->where('user_id', $user->id)->firstOrFail();
        }
    }

    public function credit(User $user, int $amount, string $type, array $attributes = []): PointTransaction
    {
        $wallet = $this->getOrCreateWallet($user);

        return DB::transaction(function () use ($wallet, $amount, $type, $attributes, $user) {
            $wallet = PointsWallet::query()->where('id', $wallet->id)->lockForUpdate()->firstOrFail();
            $balanceAfter = $wallet->balance + $amount;
            $wallet->update(['balance' => $balanceAfter]);

            return PointTransaction::create(array_merge([
                'wallet_id' => $wallet->id,
                'user_id' => $user->id,
                'type' => $type,
                'amount' => $amount,
                'balance_after' => $balanceAfter,
            ], $attributes));
        });
    }

    public function debit(User $user, int $amount, string $type, array $attributes = []): PointTransaction
    {
        $wallet = $this->getOrCreateWallet($user);

        return DB::transaction(function () use ($wallet, $amount, $type, $attributes, $user) {
            $wallet = PointsWallet::query()->where('id', $wallet->id)->lockForUpdate()->firstOrFail();
            $balanceAfter = $wallet->balance - $amount;

            if ($balanceAfter < 0) {
                throw new \RuntimeException('Insufficient balance.');
            }

            $wallet->update(['balance' => $balanceAfter]);

            return PointTransaction::create(array_merge([
                'wallet_id' => $wallet->id,
                'user_id' => $user->id,
                'type' => $type,
                'amount' => -abs($amount),
                'balance_after' => $balanceAfter,
            ], $attributes));
        });
    }

    public function canDebit(User $user, int $amount): bool
    {
        return $this->getOrCreateWallet($user)->balance >= $amount;
    }
}
