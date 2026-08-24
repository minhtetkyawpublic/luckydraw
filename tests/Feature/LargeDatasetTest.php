<?php

namespace Tests\Feature;

use App\Models\PointsWallet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class LargeDatasetTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_user_list_stays_paginated_without_n_plus_one_queries(): void
    {
        $admin = User::query()->create([
            'name' => 'Performance Admin',
            'email' => 'performance-admin@example.com',
            'password' => 'password123',
            'role' => 'admin',
            'status' => 'active',
        ]);

        $password = Hash::make('password123');
        $now = now();
        $rows = [];
        for ($index = 1; $index <= 1200; $index++) {
            $rows[] = [
                'name' => "Player {$index}",
                'username' => "player{$index}",
                'email' => "player-{$index}@example.com",
                'phone' => '09'.str_pad((string) $index, 9, '0', STR_PAD_LEFT),
                'password' => $password,
                'role' => 'user',
                'status' => 'active',
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }
        foreach (array_chunk($rows, 200) as $chunk) {
            User::query()->insert($chunk);
        }

        $walletRows = User::query()
            ->where('role', 'user')
            ->pluck('id')
            ->map(fn (int $id) => [
                'user_id' => $id,
                'balance' => $id,
                'created_at' => $now,
                'updated_at' => $now,
            ])
            ->all();
        foreach (array_chunk($walletRows, 200) as $chunk) {
            PointsWallet::query()->insert($chunk);
        }

        $this->actingAs($admin);
        DB::flushQueryLog();
        DB::enableQueryLog();

        $response = $this->getJson('/api/admin/users?per_page=100&page=6')
            ->assertOk()
            ->assertJsonCount(100, 'users')
            ->assertJsonPath('meta.total', 1200)
            ->assertJsonPath('meta.current_page', 6);

        $this->assertLessThanOrEqual(8, count(DB::getQueryLog()));
        $this->assertLessThan(200_000, strlen($response->getContent()));
    }

    public function test_large_transaction_history_returns_only_the_requested_page(): void
    {
        $user = User::query()->create([
            'name' => 'History Player',
            'email' => 'history-player@example.com',
            'password' => 'password123',
            'role' => 'user',
            'status' => 'active',
        ]);
        $wallet = PointsWallet::query()->create(['user_id' => $user->id, 'balance' => 3000]);
        $now = now();
        $rows = [];
        for ($index = 1; $index <= 3000; $index++) {
            $rows[] = [
                'wallet_id' => $wallet->id,
                'user_id' => $user->id,
                'type' => 'admin_adjustment',
                'amount' => 1,
                'balance_after' => $index,
                'status' => 'completed',
                'created_at' => $now->copy()->addSecond(),
                'updated_at' => $now,
            ];
        }
        foreach (array_chunk($rows, 200) as $chunk) {
            DB::table('point_transactions')->insert($chunk);
        }

        $this->actingAs($user);
        DB::flushQueryLog();
        DB::enableQueryLog();

        $response = $this->getJson('/api/wallet/transactions?per_page=20&page=100')
            ->assertOk()
            ->assertJsonCount(20, 'transactions')
            ->assertJsonPath('meta.total', 3000)
            ->assertJsonPath('meta.current_page', 100);

        $this->assertLessThanOrEqual(6, count(DB::getQueryLog()));
        $this->assertLessThan(100_000, strlen($response->getContent()));
    }
}
