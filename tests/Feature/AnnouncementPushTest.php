<?php

namespace Tests\Feature;

use App\Jobs\DispatchAnnouncementPush;
use App\Jobs\SendAnnouncementPushBatch;
use App\Models\Announcement;
use App\Models\PushSubscription;
use App\Models\User;
use App\Services\WebPushService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Mockery;
use Tests\TestCase;

class AnnouncementPushTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_publish_replaces_single_post_and_users_become_unread_again(): void
    {
        Queue::fake();
        config()->set('services.webpush.public_key', 'public-test-key');
        config()->set('services.webpush.private_key', 'private-test-key');
        config()->set('services.webpush.subject', 'https://example.com');

        $admin = $this->user('admin');
        $user = $this->user('user');

        $this->actingAs($user)
            ->getJson('/api/announcement')
            ->assertOk()
            ->assertJsonPath('announcement', null);

        $this->actingAs($admin)
            ->putJson('/api/admin/announcement', [
                'title' => 'First header',
                'body' => 'First full post',
            ])
            ->assertOk()
            ->assertJsonPath('announcement.version', 1)
            ->assertJsonPath('push_configured', true);

        Queue::assertPushed(DispatchAnnouncementPush::class, fn ($job) => $job->announcementVersion === 1 && $job->queue === 'push');
        $this->assertDatabaseCount('announcements', 1);

        $this->actingAs($user)
            ->getJson('/api/announcement')
            ->assertOk()
            ->assertJsonPath('announcement.title', 'First header')
            ->assertJsonPath('announcement.body', 'First full post')
            ->assertJsonPath('announcement.unread', true);

        $this->postJson('/api/announcement/read')
            ->assertOk()
            ->assertJsonPath('announcement.unread', false);
        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'last_read_announcement_version' => 1,
        ]);

        $this->actingAs($admin)
            ->putJson('/api/admin/announcement', [
                'title' => 'Replacement header',
                'body' => 'Replacement full post',
            ])
            ->assertOk()
            ->assertJsonPath('announcement.version', 2);

        $this->assertDatabaseCount('announcements', 1);
        $this->assertDatabaseMissing('announcements', ['title' => 'First header']);
        $this->assertDatabaseHas('announcements', [
            'id' => 1,
            'title' => 'Replacement header',
            'body' => 'Replacement full post',
            'version' => 2,
        ]);
        $this->assertDatabaseHas('admin_audit_logs', [
            'actor_user_id' => $admin->id,
            'action' => 'admin.announcement.publish',
        ]);

        $this->actingAs($user)
            ->getJson('/api/announcement')
            ->assertOk()
            ->assertJsonPath('announcement.title', 'Replacement header')
            ->assertJsonPath('announcement.unread', true);
    }

    public function test_only_admin_can_publish_and_post_validation_is_strict(): void
    {
        Queue::fake();
        $user = $this->user('user');

        $this->actingAs($user)
            ->putJson('/api/admin/announcement', ['title' => 'No', 'body' => 'No'])
            ->assertForbidden();

        $this->actingAs($this->user('admin'))
            ->putJson('/api/admin/announcement', ['title' => '', 'body' => ''])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['title', 'body']);

        $this->assertDatabaseCount('announcements', 0);
        Queue::assertNothingPushed();
    }

    public function test_push_subscription_is_encrypted_deduplicated_reassigned_and_removable(): void
    {
        config()->set('services.webpush.public_key', 'public-test-key');
        config()->set('services.webpush.private_key', 'private-test-key');
        config()->set('services.webpush.subject', 'https://example.com');

        $firstUser = $this->user('user');
        $secondUser = $this->user('user');
        $payload = [
            'endpoint' => 'https://push.example.test/subscription-123',
            'keys' => [
                'p256dh' => 'public-browser-key',
                'auth' => 'browser-auth-token',
            ],
            'content_encoding' => 'aes128gcm',
        ];

        $this->actingAs($firstUser)
            ->getJson('/api/push/config')
            ->assertOk()
            ->assertJsonPath('configured', true)
            ->assertJsonPath('public_key', 'public-test-key')
            ->assertJsonMissingPath('private_key');

        $this->postJson('/api/push/subscriptions', $payload)->assertCreated();
        $raw = DB::table('push_subscriptions')->first();
        $this->assertSame(hash('sha256', $payload['endpoint']), $raw->endpoint_hash);
        $this->assertNotSame($payload['endpoint'], $raw->endpoint);
        $this->assertNotSame($payload['keys']['p256dh'], $raw->public_key);
        $this->assertNotSame($payload['keys']['auth'], $raw->auth_token);

        $this->postJson('/api/push/subscriptions', $payload)->assertOk();
        $this->assertDatabaseCount('push_subscriptions', 1);

        $this->actingAs($secondUser)
            ->postJson('/api/push/subscriptions', $payload)
            ->assertOk();
        $this->assertDatabaseHas('push_subscriptions', [
            'endpoint_hash' => hash('sha256', $payload['endpoint']),
            'user_id' => $secondUser->id,
        ]);

        $this->deleteJson('/api/push/subscriptions', ['endpoint' => $payload['endpoint']])
            ->assertOk();
        $this->assertDatabaseCount('push_subscriptions', 0);
    }

    public function test_push_subscription_requires_server_configuration_and_valid_https_endpoint(): void
    {
        $this->actingAs($this->user('user'));

        $this->postJson('/api/push/subscriptions', [
            'endpoint' => 'https://push.example.test/a',
            'keys' => ['p256dh' => 'key', 'auth' => 'auth'],
        ])->assertStatus(503);

        config()->set('services.webpush.public_key', 'public-test-key');
        config()->set('services.webpush.private_key', 'private-test-key');
        $this->postJson('/api/push/subscriptions', [
            'endpoint' => 'http://insecure.example.test/a',
            'keys' => ['p256dh' => 'key', 'auth' => 'auth'],
        ])->assertUnprocessable()->assertJsonValidationErrors(['endpoint']);
    }

    public function test_push_fanout_is_chunked_and_stale_versions_do_not_send(): void
    {
        $announcement = Announcement::query()->create([
            'id' => 1,
            'title' => 'Current',
            'body' => 'Current body',
            'version' => 2,
            'published_at' => now(),
        ]);
        $user = $this->user('user');
        foreach (range(1, 201) as $index) {
            PushSubscription::query()->create([
                'user_id' => $user->id,
                'endpoint_hash' => hash('sha256', "https://push.example.test/{$index}"),
                'endpoint' => "https://push.example.test/{$index}",
                'public_key' => 'key-'.$index,
                'auth_token' => 'auth-'.$index,
            ]);
        }
        $disabledUser = $this->user('user');
        $disabledUser->update(['status' => 'disabled']);
        $disabledSubscription = PushSubscription::query()->create([
            'user_id' => $disabledUser->id,
            'endpoint_hash' => hash('sha256', 'https://push.example.test/disabled'),
            'endpoint' => 'https://push.example.test/disabled',
            'public_key' => 'disabled-key',
            'auth_token' => 'disabled-auth',
        ]);

        Queue::fake([SendAnnouncementPushBatch::class]);
        (new DispatchAnnouncementPush(2))->handle();
        Queue::assertPushed(SendAnnouncementPushBatch::class, 2);
        Queue::assertPushed(SendAnnouncementPushBatch::class, fn ($job) => $job->announcementVersion === 2 && $job->queue === 'push');
        Queue::assertNotPushed(SendAnnouncementPushBatch::class, fn ($job) => in_array($disabledSubscription->id, $job->subscriptionIds, true));

        Queue::fake([SendAnnouncementPushBatch::class]);
        (new DispatchAnnouncementPush(1))->handle();
        Queue::assertNothingPushed();
        $this->assertSame(2, $announcement->fresh()->version);
    }

    public function test_push_batch_uses_delivery_service_only_for_current_version(): void
    {
        Announcement::query()->create([
            'id' => 1,
            'title' => 'Current',
            'body' => 'Current body',
            'version' => 4,
            'published_at' => now(),
        ]);
        $subscription = PushSubscription::query()->create([
            'user_id' => $this->user('user')->id,
            'endpoint_hash' => hash('sha256', 'https://push.example.test/current'),
            'endpoint' => 'https://push.example.test/current',
            'public_key' => 'key',
            'auth_token' => 'auth',
        ]);
        $service = Mockery::mock(WebPushService::class);
        $service->shouldReceive('sendAnnouncement')->once()->withArgs(
            fn ($announcement, $subscriptions) => $announcement->version === 4
                && $subscriptions->contains('id', $subscription->id),
        );

        (new SendAnnouncementPushBatch(4, [$subscription->id]))->handle($service);

        $service->shouldNotReceive('sendAnnouncement');
        (new SendAnnouncementPushBatch(3, [$subscription->id]))->handle($service);
    }

    public function test_service_worker_contains_push_replacement_and_click_navigation_handlers(): void
    {
        $serviceWorker = file_get_contents(public_path('sw.js'));

        $this->assertStringContainsString("addEventListener('push'", $serviceWorker);
        $this->assertStringContainsString('getNotifications({ tag })', $serviceWorker);
        $this->assertStringContainsString("addEventListener('notificationclick'", $serviceWorker);
        $this->assertStringContainsString("joinPath(payload.url || 'announcement')", $serviceWorker);
    }

    private function user(string $role): User
    {
        return User::query()->create([
            'name' => ucfirst($role).' Announcement Test',
            'username' => $role.'-announcement-'.fake()->unique()->numerify('#####'),
            'email' => $role.'-announcement-'.fake()->unique()->numerify('#####').'@example.com',
            'password' => 'password123',
            'role' => $role,
            'status' => 'active',
        ]);
    }
}
