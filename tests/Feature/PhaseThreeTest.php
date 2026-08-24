<?php

namespace Tests\Feature;

use App\Models\PointsWallet;
use App\Models\RequestIdempotencyKey;
use App\Models\SpinConfiguration;
use App\Models\SpinEvent;
use App\Models\SpinSegment;
use App\Models\User;
use App\Services\IdempotencyService;
use App\Services\SpinEligibilityService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Tests\TestCase;

class PhaseThreeTest extends TestCase
{
    use RefreshDatabase;

    public function test_idempotent_spin_request_does_not_create_duplicates(): void
    {
        $user = $this->createBasicUser();
        $this->loginAs($user);
        $this->createSpinConfiguration([
            'name' => 'Idempotent Free Wheel',
            'cost_points' => 0,
            'cooldown_seconds' => 0,
            'segments' => [['label' => 'Reward', 'points_reward' => 5, 'weight' => 10]],
        ]);

        $headers = ['Idempotency-Key' => 'spin-free-key'];

        $first = $this->withHeaders($headers)->postJson('/api/spins/free');
        $first->assertOk();
        $firstEventId = $first->json('spin.event_id');
        $firstWallet = $first->json('wallet.balance');

        $second = $this->withHeaders($headers)->postJson('/api/spins/free');
        $second->assertOk();

        $secondEventId = $second->json('spin.event_id');
        $secondWallet = $second->json('wallet.balance');

        $this->assertSame($firstEventId, $secondEventId);
        $this->assertSame($firstWallet, $secondWallet);
        $this->assertDatabaseCount('spin_events', 1);
        $this->assertDatabaseCount('daily_free_spins', 1);
    }

    public function test_failed_idempotent_request_does_not_remain_stuck_processing(): void
    {
        $user = $this->createBasicUser();
        $request = Request::create('/api/spins', 'POST', [], [], [], [
            'HTTP_IDEMPOTENCY_KEY' => 'failing-spin-key',
        ]);
        $request->setUserResolver(fn () => $user);

        try {
            app(IdempotencyService::class)->handle($request, 'spin.paid', function (): void {
                throw new RuntimeException('Simulated spin failure');
            });
            $this->fail('The simulated failure should be rethrown.');
        } catch (RuntimeException $exception) {
            $this->assertSame('Simulated spin failure', $exception->getMessage());
        }

        $this->assertDatabaseMissing('request_idempotency_keys', [
            'user_id' => $user->id,
            'idempotency_key' => 'failing-spin-key',
        ]);
    }

    public function test_idempotent_callback_database_changes_roll_back_with_failed_response(): void
    {
        $user = $this->createBasicUser(['name' => 'Original Name']);
        $request = Request::create('/api/spins', 'POST', [], [], [], [
            'HTTP_IDEMPOTENCY_KEY' => 'atomic-failing-key',
        ]);
        $request->setUserResolver(fn () => $user);

        try {
            app(IdempotencyService::class)->handle($request, 'spin.paid', function () use ($user): void {
                $user->update(['name' => 'Must Roll Back']);
                throw new RuntimeException('Failure after database write');
            });
            $this->fail('The simulated failure should be rethrown.');
        } catch (RuntimeException $exception) {
            $this->assertSame('Failure after database write', $exception->getMessage());
        }

        $this->assertSame('Original Name', $user->fresh()->name);
        $this->assertDatabaseMissing('request_idempotency_keys', [
            'user_id' => $user->id,
            'idempotency_key' => 'atomic-failing-key',
        ]);
    }

    public function test_stale_processing_key_recovers_and_expired_keys_clean_automatically(): void
    {
        Cache::forget('luckydraw:idempotency:last-cleanup');
        $user = $this->createBasicUser();
        $request = Request::create('/api/spins', 'POST', [], [], [], [
            'HTTP_IDEMPOTENCY_KEY' => 'stale-processing-key',
        ]);
        $request->setUserResolver(fn () => $user);
        $requestHash = hash('sha256', json_encode([
            'method' => 'POST',
            'path' => 'api/spins',
            'payload' => [],
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION));

        $staleEntry = RequestIdempotencyKey::query()->create([
            'user_id' => $user->id,
            'scope' => 'spin.paid',
            'idempotency_key' => 'stale-processing-key',
            'request_hash' => $requestHash,
        ]);
        DB::table('request_idempotency_keys')->where('id', $staleEntry->id)->update([
            'created_at' => now()->subMinutes(10),
            'updated_at' => now()->subMinutes(10),
        ]);

        $expiredEntry = RequestIdempotencyKey::query()->create([
            'user_id' => $user->id,
            'scope' => 'spin.free',
            'idempotency_key' => 'expired-key',
            'request_hash' => 'expired',
            'response_status' => 200,
            'response_payload' => ['ok' => true],
            'completed_at' => now()->subDays(2),
        ]);
        DB::table('request_idempotency_keys')->where('id', $expiredEntry->id)->update([
            'created_at' => now()->subDays(2),
            'updated_at' => now()->subDays(2),
        ]);

        $response = app(IdempotencyService::class)->handle($request, 'spin.paid', fn () => [
            'data' => ['message' => 'Recovered'],
            'status' => 200,
        ]);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('Recovered', $response->getData(true)['message']);
        $this->assertDatabaseCount('request_idempotency_keys', 1);
        $this->assertDatabaseHas('request_idempotency_keys', [
            'user_id' => $user->id,
            'idempotency_key' => 'stale-processing-key',
            'response_status' => 200,
        ]);
        $this->assertDatabaseMissing('request_idempotency_keys', [
            'idempotency_key' => 'expired-key',
        ]);
    }

    public function test_paid_spin_cooldown_boundary_blocks_then_allows_after_period(): void
    {
        $user = $this->createBasicUser();
        $this->seedWallet($user, 50);
        $this->createSpinConfiguration([
            'name' => 'Cooldown Boundary Wheel',
            'cost_points' => 10,
            'cooldown_seconds' => 60,
            'segments' => [['label' => 'Reward', 'points_reward' => 3, 'weight' => 10]],
        ]);

        $this->loginAs($user);

        $this->postJson('/api/spins')->assertOk();

        Carbon::setTestNow(Carbon::now()->addSeconds(30));
        $blocked = $this->postJson('/api/spins');
        $blocked->assertStatus(429);
        $blocked->assertJsonPath('error_code', 'COOLDOWN_ACTIVE');
        $this->assertSame(true, ((int) $blocked->json('paid_spin_cooldown_remaining_seconds')) > 0);

        Carbon::setTestNow(Carbon::now()->addSeconds(90));
        $released = $this->postJson('/api/spins');
        $released->assertOk()->assertJsonPath('spin.is_free_spin', false);

        Carbon::setTestNow();
    }

    public function test_segment_max_win_per_day_enforced_in_available_pool(): void
    {
        $config = $this->createSpinConfiguration([
            'name' => 'Cap Wheel',
            'cost_points' => 10,
            'cooldown_seconds' => 0,
            'segments' => [
                ['label' => 'Limited', 'points_reward' => 5, 'weight' => 10, 'max_win_per_day' => 1],
                ['label' => 'Unlimited', 'points_reward' => 1, 'weight' => 5],
            ],
        ]);

        $user = $this->createBasicUser();

        SpinEvent::query()->create([
            'user_id' => $user->id,
            'spin_configuration_id' => $config->id,
            'spin_segment_id' => $config->segments->first()->id,
            'points_spent' => 0,
            'points_awarded' => 5,
            'is_free_spin' => true,
            'random_seed' => 'test-cap',
            'algorithm_version' => 'v1',
        ]);

        $service = app(SpinEligibilityService::class);
        $available = $service->getAvailableRewardSegments($config, $user->id);
        $labels = $available->pluck('label')->all();

        $this->assertNotContains('Limited', $labels);
        $this->assertContains('Unlimited', $labels);
        $this->assertSame(1, count($labels));
    }

    public function test_admin_actions_are_recorded_in_audit_logs(): void
    {
        $admin = $this->createAdmin();
        $user = $this->createBasicUser([
            'name' => 'Log Target',
            'email' => 'logtarget@example.com',
        ]);
        $this->loginAs($admin);

        $this->postJson("/api/admin/users/{$user->id}/adjust-points", [
            'amount' => 25,
            'notes' => 'QA bonus',
        ])->assertOk();

        $this->patchJson("/api/admin/users/{$user->id}", [
            'status' => 'disabled',
        ])->assertOk();

        $this->assertDatabaseHas('admin_audit_logs', [
            'subject_user_id' => $user->id,
            'action' => 'admin.user.adjust-points',
        ]);
        $this->assertDatabaseHas('admin_audit_logs', [
            'subject_user_id' => $user->id,
            'action' => 'admin.user.update',
        ]);
    }

    public function test_removed_admin_operational_tools_are_not_available(): void
    {
        $admin = $this->createAdmin();
        $this->loginAs($admin);

        $this->getJson('/api/admin/audit-logs')->assertNotFound();
        $this->getJson('/api/admin/reports/summary')->assertNotFound();
        $this->getJson('/api/admin/reports/health')->assertNotFound();
        $this->getJson('/api/admin/monitoring/suspicious-spins')->assertNotFound();
    }

    protected function createBasicUser(array $overrides = []): User
    {
        return User::query()->create(array_merge([
            'name' => 'Phase Three User',
            'email' => 'phase3-user-'.random_int(1000, 9999).'@example.com',
            'password' => 'password123',
            'role' => 'user',
            'status' => 'active',
        ], $overrides));
    }

    protected function createAdmin(): User
    {
        return User::query()->create([
            'name' => 'Phase Three Admin',
            'email' => 'phase3-admin-'.random_int(1000, 9999).'@example.com',
            'password' => 'password123',
            'role' => 'admin',
            'status' => 'active',
        ]);
    }

    protected function loginAs(User $user): void
    {
        $endpoint = $user->isAdmin() ? '/api/auth/admin/login' : '/api/auth/login';
        $response = $this->postJson($endpoint, [
            'email_or_phone' => $user->email,
            'password' => 'password123',
        ]);

        $response->assertOk();
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
                'weight' => $segment['weight'],
                'max_win_per_day' => $segment['max_win_per_day'] ?? null,
            ]);
        }

        return $config->fresh()->load('segments');
    }

    protected function seedWallet(User $user, int $balance): void
    {
        PointsWallet::query()->updateOrCreate(
            ['user_id' => $user->id],
            ['balance' => $balance],
        );
    }
}
