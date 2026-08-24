<?php

namespace Tests\Feature;

use App\Models\ApplicationSetting;
use App\Models\DailyPointClaim;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApplicationSettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_read_default_application_settings(): void
    {
        $user = $this->user('user');

        $this->actingAs($user)
            ->getJson('/api/app-settings')
            ->assertOk()
            ->assertJsonPath('settings.play_bet_url', 'https://m.bet555mix.com')
            ->assertJsonPath('settings.play_bet_label', 'ဘောလုံးမောင်း ဘော်ဒီ၊ ဂိုးပေါင်း ကစားရန်')
            ->assertJsonPath('settings.home_board_text', ApplicationSetting::defaults()['home_board_text'])
            ->assertJsonMissingPath('settings.buy_points_instructions')
            ->assertJsonPath('settings.how_to_use_terms', ApplicationSetting::defaults()['how_to_use_terms'])
            ->assertJsonMissingPath('settings.how_to_use_terms_en')
            ->assertJsonMissingPath('settings.how_to_use_terms_my')
            ->assertJsonPath('settings.daily_bonus_points', ApplicationSetting::defaults()['daily_bonus_points'])
            ->assertJsonPath('settings.daily_bonus_schedule', ApplicationSetting::defaults()['daily_bonus_schedule'])
            ->assertJsonPath('settings.contact_phone_numbers', ApplicationSetting::defaults()['contact_phone_numbers']);
    }

    public function test_admin_can_update_application_settings_and_change_is_visible_to_users(): void
    {
        $admin = $this->user('admin');
        $payload = array_merge(ApplicationSetting::defaults(), [
            'play_bet_url' => 'https://m.bet555mix.com/sports',
            'telegram_contact_url' => 'https://t.me/example_support',
            'viber_contact_url' => 'viber://chat?number=%2B959111111111',
            'telegram_channel_url' => 'https://t.me/example_channel',
            'facebook_page_url' => 'https://facebook.com/example',
            'tiktok_channel_url' => 'https://www.tiktok.com/@example',
            'about_content' => 'Updated app information.',
            'how_to_use_terms' => 'Admin-written terms in any language.',
            'daily_bonus_points' => 35,
            'daily_bonus_schedule' => [10, 20, 30, 40, 50, 60, 70],
            'home_board_text' => "First notice\nSecond notice\nThird notice",
            'home_ticker_text' => 'Editable scrolling announcement',
            'contact_phone_numbers' => "09111111111\n09222222222\n09333333333\n09444444444",
        ]);

        $this->actingAs($admin)
            ->patchJson('/api/admin/app-settings', $payload)
            ->assertOk()
            ->assertJsonPath('settings.play_bet_url', $payload['play_bet_url'])
            ->assertJsonPath('settings.daily_bonus_schedule.6', 70);

        $this->assertDatabaseHas('application_settings', [
            'id' => 1,
            'telegram_channel_url' => $payload['telegram_channel_url'],
            'how_to_use_terms' => $payload['how_to_use_terms'],
            'daily_bonus_points' => $payload['daily_bonus_points'],
            'home_board_text' => $payload['home_board_text'],
            'contact_phone_numbers' => $payload['contact_phone_numbers'],
        ]);
        $this->assertDatabaseHas('admin_audit_logs', [
            'actor_user_id' => $admin->id,
            'action' => 'admin.application-settings.update',
        ]);
    }

    public function test_regular_user_cannot_update_application_settings(): void
    {
        $this->actingAs($this->user('user'))
            ->patchJson('/api/admin/app-settings', ApplicationSetting::defaults())
            ->assertForbidden();
    }

    public function test_admin_settings_reject_unsafe_or_invalid_links(): void
    {
        $payload = array_merge(ApplicationSetting::defaults(), [
            'play_bet_url' => 'javascript:alert(1)',
            'telegram_contact_url' => 'javascript:alert(1)',
        ]);

        $this->actingAs($this->user('admin'))
            ->patchJson('/api/admin/app-settings', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['play_bet_url', 'telegram_contact_url']);
    }

    public function test_daily_claim_uses_admin_configured_point_quantity(): void
    {
        ApplicationSetting::current()->update([
            'daily_bonus_points' => 45,
            'daily_bonus_schedule' => array_fill(0, 7, 45),
        ]);

        $this->actingAs($this->user('user'))
            ->postJson('/api/points/claim-daily')
            ->assertOk()
            ->assertJsonPath('wallet.balance', 45)
            ->assertJsonPath('transaction.amount', 45);
    }

    public function test_daily_bonus_week_starts_sunday_and_reports_claimed_missed_today_and_upcoming_days(): void
    {
        Carbon::setTestNow('2026-08-26 10:00:00'); // Wednesday

        try {
            $user = $this->user('user');
            ApplicationSetting::current()->update([
                'daily_bonus_points' => 10,
                'daily_bonus_schedule' => [10, 20, 30, 40, 50, 60, 70],
            ]);
            DailyPointClaim::query()->create([
                'user_id' => $user->id,
                'claim_date' => '2026-08-23',
                'points_awarded' => 10,
            ]);

            $status = $this->actingAs($user)->getJson('/api/spins/status')->assertOk();
            $status->assertJsonCount(7, 'status.daily_bonus_week')
                ->assertJsonPath('status.daily_bonus_week.0.day', 1)
                ->assertJsonPath('status.daily_bonus_week.0.weekday', 'Sunday')
                ->assertJsonPath('status.daily_bonus_week.0.status', 'claimed')
                ->assertJsonPath('status.daily_bonus_week.1.status', 'missed')
                ->assertJsonPath('status.daily_bonus_week.3.points', 40)
                ->assertJsonPath('status.daily_bonus_week.3.status', 'today')
                ->assertJsonPath('status.daily_bonus_week.4.status', 'upcoming');

            $this->postJson('/api/points/claim-daily')
                ->assertOk()
                ->assertJsonPath('transaction.amount', 40);

            $this->getJson('/api/spins/status')
                ->assertOk()
                ->assertJsonPath('status.daily_bonus_week.3.status', 'claimed')
                ->assertJsonPath('status.can_claim_daily_bonus', false);

            Carbon::setTestNow('2026-08-30 10:00:00'); // next Sunday
            $this->getJson('/api/spins/status')
                ->assertOk()
                ->assertJsonPath('status.daily_bonus_week.0.date', '2026-08-30')
                ->assertJsonPath('status.daily_bonus_week.0.status', 'today')
                ->assertJsonPath('status.can_claim_daily_bonus', true);
        } finally {
            Carbon::setTestNow();
        }
    }

    private function user(string $role): User
    {
        return User::query()->create([
            'name' => ucfirst($role).' Settings Test',
            'email' => $role.'-settings-'.random_int(1000, 9999).'@example.com',
            'password' => 'password123',
            'role' => $role,
            'status' => 'active',
        ]);
    }
}
