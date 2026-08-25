<?php

namespace Tests\Feature;

use App\Models\BettingSite;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BettingSiteTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_sees_only_active_betting_sites_in_display_order(): void
    {
        BettingSite::query()->delete();
        BettingSite::query()->create($this->site(['name' => 'Second', 'sort_order' => 20]));
        BettingSite::query()->create($this->site(['name' => 'Hidden', 'is_active' => false, 'sort_order' => 1]));
        BettingSite::query()->create($this->site(['name' => 'First', 'sort_order' => 10]));

        $this->actingAs($this->user('user'))
            ->getJson('/api/betting-sites')
            ->assertOk()
            ->assertJsonCount(2, 'sites')
            ->assertJsonPath('sites.0.name', 'First')
            ->assertJsonPath('sites.1.name', 'Second')
            ->assertJsonMissing(['name' => 'Hidden']);
    }

    public function test_admin_can_create_update_and_delete_a_betting_site(): void
    {
        BettingSite::query()->delete();
        $admin = $this->user('admin');

        $created = $this->actingAs($admin)
            ->postJson('/api/admin/betting-sites', $this->site())
            ->assertCreated()
            ->assertJsonPath('site.name', 'Example Sports')
            ->json('site');

        $this->assertDatabaseHas('admin_audit_logs', [
            'actor_user_id' => $admin->id,
            'action' => 'admin.betting-site.create',
            'subject_id' => $created['id'],
        ]);

        $this->patchJson('/api/admin/betting-sites/'.$created['id'], $this->site([
            'name' => 'Updated Sports',
            'button_text' => 'Open',
            'is_active' => false,
        ]))
            ->assertOk()
            ->assertJsonPath('site.name', 'Updated Sports')
            ->assertJsonPath('site.is_active', false);

        $this->deleteJson('/api/admin/betting-sites/'.$created['id'])
            ->assertOk();

        $this->assertDatabaseMissing('betting_sites', ['id' => $created['id']]);
        $this->assertDatabaseHas('admin_audit_logs', [
            'actor_user_id' => $admin->id,
            'action' => 'admin.betting-site.delete',
            'subject_id' => $created['id'],
        ]);
    }

    public function test_regular_user_cannot_manage_betting_sites_and_unsafe_urls_are_rejected(): void
    {
        BettingSite::query()->delete();

        $this->actingAs($this->user('user'))
            ->postJson('/api/admin/betting-sites', $this->site())
            ->assertForbidden();

        $this->actingAs($this->user('admin'))
            ->postJson('/api/admin/betting-sites', $this->site(['url' => 'javascript:alert(1)']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('url');
    }

    private function user(string $role): User
    {
        return User::factory()->create([
            'role' => $role,
            'status' => 'active',
        ]);
    }

    private function site(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Example Sports',
            'display_text' => 'Football betting website',
            'url' => 'https://example.com/play',
            'button_text' => 'Play',
            'is_active' => true,
            'sort_order' => 10,
        ], $overrides);
    }
}
