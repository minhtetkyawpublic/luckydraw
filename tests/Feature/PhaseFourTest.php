<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PhaseFourTest extends TestCase
{
    use RefreshDatabase;

    public function test_removed_system_health_endpoint_is_not_available(): void
    {
        $admin = $this->createAdmin();
        $this->loginAs($admin);

        $this->getJson('/api/admin/reports/health')->assertNotFound();
    }

    private function createAdmin(): User
    {
        return User::query()->create([
            'name' => 'Phase Four Admin',
            'email' => 'phase4-admin-'.random_int(1000, 9999).'@example.com',
            'password' => 'password123',
            'role' => 'admin',
            'status' => 'active',
        ]);
    }

    private function loginAs(User $user): void
    {
        $endpoint = $user->isAdmin() ? '/api/auth/admin/login' : '/api/auth/login';
        $response = $this->postJson($endpoint, [
            ($user->isAdmin() ? 'email_or_phone' : 'username') => $user->isAdmin() ? $user->email : $user->username,
            'password' => 'password123',
        ]);

        $response->assertOk();
    }
}
