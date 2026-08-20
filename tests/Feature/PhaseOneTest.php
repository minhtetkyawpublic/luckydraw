<?php

namespace Tests\Feature;

use App\Models\SpinConfiguration;
use App\Models\SpinSegment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PhaseOneTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_and_invalid_credentials_behave_as_expected(): void
    {
        User::query()->create([
            'name' => 'Phase User',
            'email' => 'user@example.com',
            'password' => 'secret123',
            'role' => 'admin',
            'status' => 'active',
        ]);

        $this->postJson('/api/auth/admin/login', [
            'email_or_phone' => 'user@example.com',
            'password' => 'secret123',
            'remember_me' => true,
        ])->assertOk()
            ->assertJsonPath('user.email', 'user@example.com');

        $this->postJson('/api/auth/admin/login', [
            'email_or_phone' => 'user@example.com',
            'password' => 'wrong',
        ])->assertStatus(422)
            ->assertJsonPath('message', 'Invalid credentials');
    }

    public function test_sanctum_spa_cookie_login_and_authenticated_request_flow(): void
    {
        User::query()->create([
            'name' => 'Browser User',
            'email' => 'browser@example.com',
            'password' => 'secret123',
            'role' => 'user',
            'status' => 'active',
        ]);

        $this->get('/sanctum/csrf-cookie')->assertNoContent();

        $this->postJson('/api/auth/login', [
            'email_or_phone' => 'browser@example.com',
            'password' => 'secret123',
            'remember_me' => true,
        ])->assertOk();

        $this->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('user.email', 'browser@example.com');

        $this->get('/api/sanctum/csrf-cookie')->assertNotFound();
    }

    public function test_public_registration_route_is_not_available(): void
    {
        $this->postJson('/api/register')->assertStatus(404);
    }

    public function test_separate_user_and_admin_spa_login_routes_are_available(): void
    {
        $this->get('/login')->assertOk()->assertSee('id="app"', false);
        $this->get('/admin/login')->assertOk()->assertSee('id="app"', false);
    }

    public function test_admin_can_create_user_and_user_can_login(): void
    {
        User::query()->create([
            'name' => 'Admin',
            'email' => 'admin@example.com',
            'password' => 'admin123',
            'role' => 'admin',
            'status' => 'active',
        ]);

        $this->postJson('/api/auth/admin/login', [
            'email_or_phone' => 'admin@example.com',
            'password' => 'admin123',
        ])->assertOk();

        $response = $this->postJson('/api/admin/users', [
            'name' => 'Created User',
            'email' => 'created@example.com',
            'password' => 'User12345',
            'role' => 'user',
            'phone' => '0912345678',
        ]);

        $response->assertCreated()
            ->assertJsonPath('user.email', 'created@example.com')
            ->assertJsonPath('user.role', 'user');
        $this->assertSame(1, User::query()->where('role', 'admin')->count());

        $this->postJson('/api/auth/logout');

        $this->postJson('/api/auth/login', [
            'email_or_phone' => '0912345678',
            'password' => 'User12345',
        ])->assertOk()
            ->assertJsonPath('user.role', 'user')
            ->assertJsonPath('user.phone', '0912345678');
    }

    public function test_user_and_admin_login_portals_reject_the_wrong_account_role(): void
    {
        User::query()->create([
            'name' => 'Portal Admin',
            'email' => 'portal-admin@example.com',
            'password' => 'secret123',
            'role' => 'admin',
            'status' => 'active',
        ]);
        User::query()->create([
            'name' => 'Portal User',
            'email' => 'portal-user@example.com',
            'password' => 'secret123',
            'role' => 'user',
            'status' => 'active',
        ]);

        $this->postJson('/api/auth/login', [
            'email_or_phone' => 'portal-admin@example.com',
            'password' => 'secret123',
        ])->assertUnprocessable()->assertJsonPath('message', 'This account belongs to the administrator portal.');

        $this->postJson('/api/auth/admin/login', [
            'email_or_phone' => 'portal-user@example.com',
            'password' => 'secret123',
        ])->assertUnprocessable()->assertJsonPath('message', 'This account belongs to the user app.');

        $this->postJson('/api/auth/admin/login', [
            'email_or_phone' => 'portal-admin@example.com',
            'password' => 'secret123',
        ])->assertOk()->assertJsonPath('user.role', 'admin');
    }

    public function test_daily_bonus_can_only_be_claimed_once_per_day(): void
    {
        $this->seedUserAndLogin();

        $first = $this->postJson('/api/points/claim-daily');
        $first->assertOk()->assertJsonPath('wallet.balance', 20);

        $this->postJson('/api/points/claim-daily')
            ->assertStatus(409)
            ->assertJsonPath('already_claimed', true);

        $this->assertDatabaseCount('daily_point_claims', 1);
    }

    public function test_free_spin_is_only_once_per_day_and_updates_wallet(): void
    {
        $this->seedUserAndLogin();
        $this->createActiveSpinConfiguration();

        $first = $this->postJson('/api/spins/free');
        $first->assertOk()->assertJsonPath('spin.is_free_spin', true);

        $this->postJson('/api/spins/free')
            ->assertStatus(409)
            ->assertJsonPath('message', 'Daily free spin already used.');

        $this->assertDatabaseCount('daily_free_spins', 1);
    }

    public function test_paid_spin_is_blocked_when_insufficient_balance(): void
    {
        $this->seedUserAndLogin();
        $this->createActiveSpinConfiguration();

        $this->postJson('/api/spins')
            ->assertStatus(422)
            ->assertJsonPath('message', 'Insufficient balance');
    }

    protected function seedUserAndLogin(): User
    {
        $user = User::query()->create([
            'name' => 'Reward User',
            'email' => 'reward@example.com',
            'password' => 'reward123',
            'role' => 'user',
            'status' => 'active',
        ]);

        $this->postJson('/api/auth/login', [
            'email_or_phone' => 'reward@example.com',
            'password' => 'reward123',
        ])->assertOk();

        return $user;
    }

    protected function createActiveSpinConfiguration(): void
    {
        $config = SpinConfiguration::query()->create([
            'name' => 'Phase One Wheel',
            'cost_points' => 10,
            'is_active' => true,
        ]);

        SpinSegment::query()->create([
            'spin_configuration_id' => $config->id,
            'label' => 'Small',
            'points_reward' => 5,
            'weight' => 100,
        ]);
    }
}
