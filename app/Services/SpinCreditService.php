<?php

namespace App\Services;

use App\Models\SpinCreditTransaction;
use App\Models\SpinWallet;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

class SpinCreditService
{
    public function getOrCreateWallet(User $user): SpinWallet
    {
        try {
            return SpinWallet::query()->firstOrCreate(['user_id' => $user->id], ['balance' => 0]);
        } catch (UniqueConstraintViolationException) {
            return SpinWallet::query()->where('user_id', $user->id)->firstOrFail();
        }
    }

    public function credit(User $user, int $amount, string $type, array $attributes = []): SpinCreditTransaction
    {
        $wallet = $this->getOrCreateWallet($user);

        return DB::transaction(function () use ($wallet, $user, $amount, $type, $attributes) {
            $locked = SpinWallet::query()->whereKey($wallet->id)->lockForUpdate()->firstOrFail();
            $balanceAfter = $locked->balance + $amount;
            $locked->update(['balance' => $balanceAfter]);

            return SpinCreditTransaction::query()->create(array_merge([
                'spin_wallet_id' => $locked->id,
                'user_id' => $user->id,
                'type' => $type,
                'amount' => $amount,
                'balance_after' => $balanceAfter,
            ], $attributes));
        });
    }

    public function debit(User $user, int $amount, string $type, array $attributes = []): SpinCreditTransaction
    {
        $wallet = $this->getOrCreateWallet($user);

        return DB::transaction(function () use ($wallet, $user, $amount, $type, $attributes) {
            $locked = SpinWallet::query()->whereKey($wallet->id)->lockForUpdate()->firstOrFail();
            if ($locked->balance < $amount) {
                throw new \RuntimeException('Insufficient spins');
            }
            $balanceAfter = $locked->balance - $amount;
            $locked->update(['balance' => $balanceAfter]);

            return SpinCreditTransaction::query()->create(array_merge([
                'spin_wallet_id' => $locked->id,
                'user_id' => $user->id,
                'type' => $type,
                'amount' => -abs($amount),
                'balance_after' => $balanceAfter,
            ], $attributes));
        });
    }
}
