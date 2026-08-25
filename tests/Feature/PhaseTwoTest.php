<?php

namespace Tests\Feature;

use App\Models\PointsWallet;
use App\Models\PointTransaction;
use App\Models\SpinConfiguration;
use App\Models\SpinCreditTransaction;
use App\Models\SpinExchangePackage;
use App\Models\SpinSegment;
use App\Models\SpinWallet;
use App\Models\User;
use App\Services\WalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class PhaseTwoTest extends TestCase
{
    use RefreshDatabase;

    public function test_spin_status_shows_free_spin_and_bonus_state(): void
    {
        $user = $this->createBasicUser();
        $this->loginAs($user);
        $this->createSpinConfiguration([
            'name' => 'Phase Two Wheel',
            'cost_points' => 12,
            'cooldown_seconds' => 60,
            'segments' => [
                ['label' => 'Small', 'points_reward' => 5, 'weight' => 10],
            ],
        ]);

        $initial = $this->getJson('/api/spins/status')->assertOk();
        $initial->assertJsonPath('status.can_free_spin_today', true);
        $initial->assertJsonPath('status.can_claim_daily_bonus', true);
        $initial->assertJsonPath('status.wallet_balance', 0);
        $initial->assertJsonStructure([
            'status' => [
                'config' => ['id', 'name', 'cooldown_seconds', 'is_active'],
                'segments' => [['id', 'label', 'points_reward', 'weight']],
                'can_free_spin_today',
                'can_claim_daily_bonus',
                'daily_bonus_week' => [[
                    'day',
                    'weekday',
                    'date',
                    'points',
                    'status',
                ]],
                'next_paid_spin_at',
                'paid_spin_cooldown_remaining_seconds',
            ],
        ]);

        $this->postJson('/api/spins/free')->assertOk();

        $afterSpin = $this->getJson('/api/spins/status')->assertOk();
        $afterSpin->assertJsonPath('status.can_free_spin_today', false);
        $afterSpin->assertJsonPath('status.can_claim_daily_bonus', true);
    }

    public function test_paid_spin_blocked_during_cooldown_with_remaining_seconds_payload(): void
    {
        $user = $this->createBasicUser();
        $this->createSpinConfiguration([
            'name' => 'Cooldown Wheel',
            'cost_points' => 8,
            'cooldown_seconds' => 120,
            'segments' => [
                ['label' => 'Small', 'points_reward' => 3, 'weight' => 10],
            ],
        ]);
        $this->seedWallet($user, 40);
        $this->seedSpins($user, 2);
        $this->loginAs($user);

        $this->postJson('/api/spins')->assertOk();
        $blocked = $this->postJson('/api/spins')->assertStatus(429);
        $blocked->assertJsonPath('error_code', 'COOLDOWN_ACTIVE');
        $remaining = (int) $blocked->json('paid_spin_cooldown_remaining_seconds');
        $this->assertGreaterThan(0, $remaining);
    }

    public function test_admin_can_update_the_single_operational_wheel(): void
    {
        $admin = $this->createAdmin();
        $this->loginAs($admin);

        $firstConfig = $this->createSpinConfiguration([
            'name' => 'Old Wheel',
            'cost_points' => 7,
            'segments' => [['label' => 'One', 'points_reward' => 1, 'weight' => 1]],
        ]);
        $secondConfig = $this->createSpinConfiguration([
            'name' => 'Active Wheel',
            'cost_points' => 5,
            'is_active' => false,
            'segments' => [['label' => 'Two', 'points_reward' => 2, 'weight' => 1]],
        ]);

        $this->assertTrue((bool) $firstConfig->is_active);

        $response = $this->patchJson('/api/admin/spin-configuration', [
            'cost_points' => 15,
            'segments' => [
                ['points_reward' => 3, 'weight' => 5],
                ['points_reward' => 1, 'weight' => 5],
            ],
        ]);

        $response->assertOk()
            ->assertJsonPath('configuration.name', 'Lucky Draw Wheel')
            ->assertJsonPath('configuration.cost_points', 0)
            ->assertJsonPath('configuration.is_active', true)
            ->assertJsonPath('configuration.cooldown_seconds', 0)
            ->assertJsonCount(2, 'configuration.segments');

        $this->assertDatabaseCount('spin_configurations', 2);
        $this->assertDatabaseHas('spin_configurations', ['id' => $firstConfig->id, 'is_active' => true, 'cost_points' => 0]);
        $this->assertDatabaseHas('spin_configurations', ['id' => $secondConfig->id, 'is_active' => false]);
        $this->postJson('/api/admin/spin-configurations')->assertNotFound();

        $invalid = $this->patchJson('/api/admin/spin-configuration', [
            'cost_points' => 10,
            'segments' => [
                ['points_reward' => 2, 'weight' => 0],
                ['points_reward' => 1, 'weight' => 1],
            ],
        ]);

        $invalid->assertStatus(422)->assertJsonValidationErrors(['segments.0.weight']);
    }

    public function test_admin_can_list_users_and_toggle_user_status(): void
    {
        $admin = $this->createAdmin();
        $user = User::query()->create([
            'name' => 'Target User',
            'email' => 'target@example.com',
            'password' => 'user12345',
            'role' => 'user',
            'status' => 'active',
        ]);
        $this->seedWallet($user, 5);
        $user->forceFill(['remember_token' => 'remember-me-before-disable'])->save();
        DB::table('sessions')->insert([
            'id' => 'disabled-user-session',
            'user_id' => $user->id,
            'payload' => '',
            'last_activity' => now()->timestamp,
        ]);
        $this->loginAs($admin);

        $this->getJson('/api/admin/users?q=Target&per_page=10')
            ->assertOk()
            ->assertJsonPath('users.0.email', 'target@example.com');

        $toggle = $this->patchJson("/api/admin/users/{$user->id}", ['status' => 'disabled']);
        $toggle->assertOk()->assertJsonPath('user.status', 'disabled');
        $this->assertDatabaseHas('users', ['id' => $user->id, 'status' => 'disabled']);
        $this->assertDatabaseMissing('sessions', ['id' => 'disabled-user-session']);
        $this->assertNotSame('remember-me-before-disable', $user->fresh()->remember_token);

        $this->patchJson("/api/admin/users/{$user->id}", [
            'name' => 'Updated Target User',
            'username' => 'updatedtarget',
            'email' => 'updated-target@example.com',
            'phone' => '09999999999',
        ])->assertOk()
            ->assertJsonPath('user.name', 'Updated Target User')
            ->assertJsonPath('user.username', 'updatedtarget')
            ->assertJsonPath('user.email', 'updated-target@example.com')
            ->assertJsonPath('user.phone', '09999999999');

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'username' => 'updatedtarget',
            'email' => 'updated-target@example.com',
            'phone' => '09999999999',
        ]);

        $disabledList = $this->getJson('/api/admin/users?status=disabled');
        $disabledList->assertOk()->assertJsonFragment(['email' => 'updated-target@example.com']);

        $this->getJson('/api/admin/users?q=updatedtarget')
            ->assertOk()
            ->assertJsonPath('users.0.username', 'updatedtarget');
    }

    public function test_admin_overview_returns_all_user_and_wallet_totals(): void
    {
        $admin = $this->createAdmin();
        $first = User::query()->create([
            'name' => 'First Overview User',
            'username' => 'overviewfirst',
            'password' => 'user12345',
            'role' => 'user',
            'status' => 'active',
        ]);
        $second = User::query()->create([
            'name' => 'Second Overview User',
            'username' => 'overviewsecond',
            'password' => 'user12345',
            'role' => 'user',
            'status' => 'disabled',
        ]);
        $this->seedWallet($first, 1250);
        $this->seedWallet($second, 2750);

        $this->loginAs($admin);

        $this->getJson('/api/admin/overview')
            ->assertOk()
            ->assertJsonPath('statistics.total_users', 2)
            ->assertJsonPath('statistics.total_coins', 4000);
    }

    public function test_admin_can_open_user_records_with_paginated_transactions(): void
    {
        $admin = $this->createAdmin();
        $user = User::query()->create([
            'name' => 'Record User',
            'email' => 'records@example.com',
            'password' => 'user12345',
            'role' => 'user',
            'status' => 'active',
        ]);
        $wallet = $this->seedWallet($user, 100);
        PointTransaction::query()->create([
            'user_id' => $user->id,
            'wallet_id' => $wallet->id,
            'type' => PointTransaction::TYPE_ADMIN_ADJUSTMENT,
            'amount' => 25,
            'balance_after' => 125,
            'notes' => 'Admin record test',
        ]);

        $this->loginAs($admin);

        $this->getJson("/api/admin/users/{$user->id}?type=".PointTransaction::TYPE_ADMIN_ADJUSTMENT.'&per_page=5')
            ->assertOk()
            ->assertJsonPath('user.email', 'records@example.com')
            ->assertJsonPath('user.wallet_balance', 100)
            ->assertJsonPath('transactions.0.amount', 25)
            ->assertJsonPath('meta.per_page', 5);
    }

    public function test_single_admin_profile_has_no_wallet_access(): void
    {
        $admin = $this->createAdmin();
        $this->loginAs($admin);

        $this->getJson('/api/admin/profile')
            ->assertOk()
            ->assertJsonPath('admin.email', $admin->email);

        $this->patchJson('/api/admin/profile', [
            'name' => 'Primary Administrator',
            'email' => $admin->email,
            'phone' => '09999999999',
        ])->assertOk()->assertJsonPath('admin.name', 'Primary Administrator');

        $this->getJson('/api/wallet')->assertForbidden();
        $this->assertDatabaseMissing('points_wallets', ['user_id' => $admin->id]);
    }

    public function test_admin_can_change_password_after_confirming_current_password(): void
    {
        $admin = $this->createAdmin();
        $this->loginAs($admin);
        $admin->forceFill(['remember_token' => 'admin-remember-before-change'])->save();
        DB::table('sessions')->insert([
            'id' => 'other-admin-session',
            'user_id' => $admin->id,
            'payload' => '',
            'last_activity' => now()->timestamp,
        ]);

        $this->patchJson('/api/admin/profile/password', [
            'current_password' => 'incorrect-password',
            'password' => 'new-password-123',
            'password_confirmation' => 'new-password-123',
        ])->assertUnprocessable()->assertJsonValidationErrors(['current_password']);

        $this->patchJson('/api/admin/profile/password', [
            'current_password' => 'password123',
            'password' => 'new-password-123',
            'password_confirmation' => 'new-password-123',
        ])->assertOk()->assertJsonPath('message', 'Admin password changed');

        $admin->refresh();
        $this->assertFalse(Hash::check('password123', $admin->password));
        $this->assertTrue(Hash::check('new-password-123', $admin->password));
        $this->assertNotSame('admin-remember-before-change', $admin->remember_token);
        $this->assertDatabaseMissing('sessions', ['id' => 'other-admin-session']);
    }

    public function test_admin_password_reset_revokes_user_sessions_and_remember_token(): void
    {
        $admin = $this->createAdmin();
        $user = $this->createBasicUser();
        $user->forceFill(['remember_token' => 'user-remember-before-reset'])->save();
        DB::table('sessions')->insert([
            'id' => 'user-session-before-reset',
            'user_id' => $user->id,
            'payload' => '',
            'last_activity' => now()->timestamp,
        ]);
        $this->loginAs($admin);

        $this->postJson("/api/admin/users/{$user->id}/reset-password", [
            'password' => 'replacement-password-123',
        ])->assertOk();

        $user->refresh();
        $this->assertTrue(Hash::check('replacement-password-123', $user->password));
        $this->assertNotSame('user-remember-before-reset', $user->remember_token);
        $this->assertDatabaseMissing('sessions', ['id' => 'user-session-before-reset']);
    }

    public function test_user_transactions_endpoint_supports_type_and_pagination(): void
    {
        $user = $this->createBasicUser();
        $wallet = $this->seedWallet($user, 0);
        $this->loginAs($user);

        $walletService = app(WalletService::class);
        for ($i = 1; $i <= 6; $i++) {
            $walletService->credit($user, $i, PointTransaction::TYPE_ADMIN_ADJUSTMENT, ['notes' => "Seed {$i}"]);
        }

        $first = $this->getJson('/api/wallet/transactions?per_page=1')
            ->assertOk()
            ->assertJsonStructure([
                'transactions' => [['id', 'type', 'amount', 'balance_after']],
                'meta' => ['current_page', 'per_page', 'total', 'last_page'],
            ]);
        $this->assertSame(5, count($first->json('transactions')));

        $second = $this->getJson('/api/wallet/transactions?type='.PointTransaction::TYPE_ADMIN_ADJUSTMENT.'&page=2&per_page=5');
        $second->assertOk();
        $this->assertSame(2, $second->json('meta.current_page'));

        $this->assertNotNull($wallet->fresh()?->id);

        $this->getJson('/api/wallet/transactions?from=not-a-date')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['from']);
    }

    public function test_point_ledger_supports_balances_above_32_bit_integer_limit(): void
    {
        $user = $this->createBasicUser();
        $walletService = app(WalletService::class);

        $walletService->credit($user, 1_500_000_000, PointTransaction::TYPE_ADMIN_ADJUSTMENT);
        $transaction = $walletService->credit($user, 1_500_000_000, PointTransaction::TYPE_ADMIN_ADJUSTMENT);

        $this->assertSame(3_000_000_000, (int) $user->wallet()->firstOrFail()->balance);
        $this->assertSame(3_000_000_000, (int) $transaction->balance_after);
    }

    public function test_non_admin_cannot_access_admin_endpoints(): void
    {
        $user = $this->createBasicUser();
        $this->loginAs($user);

        $this->getJson('/api/admin/overview')->assertStatus(403);
        $this->getJson('/api/admin/users')->assertStatus(403);
        $this->patchJson("/api/admin/users/{$user->id}", ['status' => 'disabled'])->assertStatus(403);
    }

    public function test_free_and_paid_spins_apply_exact_wallet_arithmetic(): void
    {
        $user = $this->createBasicUser();
        $this->seedWallet($user, 100);
        $this->seedSpins($user, 1);
        $this->createSpinConfiguration([
            'name' => 'Arithmetic Wheel',
            'cost_points' => 30,
            'cooldown_seconds' => 0,
            'segments' => [
                ['label' => 'Certain Reward', 'points_reward' => 12, 'weight' => 100],
            ],
        ]);
        $this->loginAs($user);

        $this->postJson('/api/spins/free')
            ->assertOk()
            ->assertJsonPath('spin.points_spent', 0)
            ->assertJsonPath('spin.points_awarded', 12)
            ->assertJsonPath('spin.balance_after', 112)
            ->assertJsonPath('wallet.balance', 112);

        $this->postJson('/api/spins')
            ->assertOk()
            ->assertJsonPath('spin.points_spent', 0)
            ->assertJsonPath('spin.spins_spent', 1)
            ->assertJsonPath('spin.points_awarded', 12)
            ->assertJsonPath('spin.balance_after', 124)
            ->assertJsonPath('spin.spin_balance_after', 0)
            ->assertJsonPath('wallet.balance', 124);

        $this->assertSame(124, $user->wallet()->firstOrFail()->balance);
        $this->assertDatabaseHas('spin_credit_transactions', [
            'user_id' => $user->id,
            'type' => SpinCreditTransaction::TYPE_SPIN_SPEND,
            'amount' => -1,
            'balance_after' => 0,
        ]);
        $this->assertDatabaseHas('point_transactions', [
            'user_id' => $user->id,
            'type' => PointTransaction::TYPE_PAID_SPIN_REWARD,
            'amount' => 12,
            'balance_after' => 124,
        ]);
    }

    public function test_admin_segment_removal_preserves_historical_spin_events(): void
    {
        $user = $this->createBasicUser();
        $this->seedWallet($user, 100);
        $this->seedSpins($user, 1);
        $configuration = $this->createSpinConfiguration([
            'name' => 'History Safe Wheel',
            'cost_points' => 10,
            'segments' => [
                ['label' => 'Original Reward', 'points_reward' => 4, 'weight' => 100],
            ],
        ]);
        $originalSegment = $configuration->segments()->firstOrFail();
        $this->loginAs($user);
        $this->postJson('/api/spins')->assertOk();
        $this->assertDatabaseCount('spin_events', 1);

        $admin = $this->createAdmin();
        $this->actingAs($admin);
        $this->patchJson('/api/admin/spin-configuration', [
            'cost_points' => 10,
            'segments' => [
                [
                    'points_reward' => 8,
                    'weight' => 100,
                ],
                ['points_reward' => 2, 'weight' => 1],
            ],
        ])->assertOk()->assertJsonPath('configuration.segments.0.label', 'Slice 1');

        $this->assertDatabaseCount('spin_events', 1);
        $this->assertDatabaseHas('spin_segments', [
            'id' => $originalSegment->id,
            'is_active' => false,
        ]);
        $this->assertDatabaseHas('spin_events', [
            'spin_segment_id' => $originalSegment->id,
            'points_awarded' => 4,
        ]);
    }

    public function test_user_exchanges_points_for_spin_credits_atomically(): void
    {
        $user = $this->createBasicUser();
        $this->seedWallet($user, 500);
        $this->loginAs($user);
        $package = SpinExchangePackage::query()->where('points_cost', 100)->firstOrFail();

        $response = $this->postJson("/api/spin-exchange-packages/{$package->id}/exchange", [], [
            'Idempotency-Key' => 'exchange-test-key',
        ])->assertOk()
            ->assertJsonPath('wallet_balance', 400)
            ->assertJsonPath('spin_balance', 3);

        $this->postJson("/api/spin-exchange-packages/{$package->id}/exchange", [], [
            'Idempotency-Key' => 'exchange-test-key',
        ])->assertOk()->assertExactJson($response->json());

        $this->assertSame(400, $user->wallet()->firstOrFail()->balance);
        $this->assertSame(3, $user->spinWallet()->firstOrFail()->balance);
        $this->assertDatabaseCount('spin_credit_transactions', 1);
        $this->assertDatabaseHas('point_transactions', [
            'user_id' => $user->id,
            'type' => PointTransaction::TYPE_SPIN_EXCHANGE,
            'amount' => -100,
        ]);
    }

    public function test_wheel_can_reward_spin_credits(): void
    {
        $user = $this->createBasicUser();
        $this->seedWallet($user, 50);
        $this->createSpinConfiguration([
            'name' => 'Spin Reward Wheel',
            'segments' => [[
                'label' => 'Spin Reward',
                'reward_type' => 'spins',
                'spins_reward' => 4,
                'points_reward' => 0,
                'weight' => 100,
            ]],
        ]);
        $this->loginAs($user);

        $this->postJson('/api/spins/free')
            ->assertOk()
            ->assertJsonPath('spin.reward_type', 'spins')
            ->assertJsonPath('spin.reward_amount', 4)
            ->assertJsonPath('spin.spins_awarded', 4)
            ->assertJsonPath('spin.spin_balance_after', 4)
            ->assertJsonPath('wallet.balance', 50);

        $this->assertSame(4, $user->spinWallet()->firstOrFail()->balance);
    }

    public function test_admin_configures_spin_packages_and_mixed_wheel_rewards(): void
    {
        $admin = $this->createAdmin();
        $this->actingAs($admin);

        $this->putJson('/api/admin/spin-exchange-packages', [
            'packages' => [
                ['points_cost' => 100, 'spins_amount' => 3, 'is_active' => true],
                ['points_cost' => 300, 'spins_amount' => 10, 'is_active' => true],
            ],
        ])->assertOk()->assertJsonCount(2, 'packages');

        $this->patchJson('/api/admin/spin-configuration', [
            'cost_points' => 0,
            'segments' => [
                ['reward_type' => 'points', 'reward_amount' => 25, 'weight' => 80],
                ['reward_type' => 'spins', 'reward_amount' => 2, 'weight' => 20],
            ],
        ])->assertOk()
            ->assertJsonPath('configuration.segments.0.reward_type', 'points')
            ->assertJsonPath('configuration.segments.0.points_reward', 25)
            ->assertJsonPath('configuration.segments.1.reward_type', 'spins')
            ->assertJsonPath('configuration.segments.1.spins_reward', 2);

        $this->assertDatabaseHas('spin_exchange_packages', ['points_cost' => 300, 'spins_amount' => 10]);
    }

    protected function createBasicUser(array $overrides = []): User
    {
        $suffix = random_int(1000, 9999);

        return User::query()->create(array_merge([
            'name' => 'Phase Two User',
            'username' => 'phase2user'.$suffix,
            'email' => 'phase2-user-'.$suffix.'@example.com',
            'password' => 'password123',
            'role' => 'user',
            'status' => 'active',
        ], $overrides));
    }

    protected function createAdmin(): User
    {
        return User::query()->create([
            'name' => 'Phase Two Admin',
            'email' => 'phase2-admin-'.random_int(1000, 9999).'@example.com',
            'password' => 'password123',
            'role' => 'admin',
            'status' => 'active',
        ]);
    }

    protected function loginAs(User $user): void
    {
        $endpoint = $user->isAdmin() ? '/api/auth/admin/login' : '/api/auth/login';
        $response = $this->postJson($endpoint, [
            ($user->isAdmin() ? 'email_or_phone' : 'username') => $user->isAdmin() ? $user->email : $user->username,
            'password' => 'password123',
        ]);

        $response->assertOk();
    }

    protected function seedWallet(User $user, int $balance): PointsWallet
    {
        return PointsWallet::query()->updateOrCreate(
            ['user_id' => $user->id],
            ['balance' => $balance],
        );
    }

    protected function seedSpins(User $user, int $balance): SpinWallet
    {
        return SpinWallet::query()->updateOrCreate(
            ['user_id' => $user->id],
            ['balance' => $balance],
        );
    }

    protected function createSpinConfiguration(array $attributes): SpinConfiguration
    {
        $segments = $attributes['segments'];
        $config = SpinConfiguration::query()->create([
            'name' => $attributes['name'] ?? 'Wheel',
            'cost_points' => $attributes['cost_points'] ?? 0,
            'cooldown_seconds' => $attributes['cooldown_seconds'] ?? 0,
            'is_active' => $attributes['is_active'] ?? true,
            'starts_at' => null,
            'ends_at' => null,
        ]);

        if ($config->is_active) {
            SpinConfiguration::query()->where('id', '!=', $config->id)->update(['is_active' => false]);
        }

        foreach ($segments as $segment) {
            SpinSegment::query()->create([
                'spin_configuration_id' => $config->id,
                'label' => $segment['label'],
                'points_reward' => $segment['points_reward'],
                'reward_type' => $segment['reward_type'] ?? 'points',
                'spins_reward' => $segment['spins_reward'] ?? 0,
                'weight' => $segment['weight'],
                'max_win_per_day' => $segment['max_win_per_day'] ?? null,
            ]);
        }

        return $config->fresh();
    }
}
