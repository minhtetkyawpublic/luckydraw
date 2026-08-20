<?php

namespace Database\Seeders;

use App\Models\ApplicationSetting;
use App\Models\SpinConfiguration;
use App\Models\SpinSegment;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use RuntimeException;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $isProduction = app()->environment('production');
        $adminEmail = config('luckydraw.seed_admin_email') ?: ($isProduction ? null : 'admin@luckydraw.local');
        $adminPassword = config('luckydraw.seed_admin_password') ?: ($isProduction ? null : 'admin1234');

        if ($isProduction && (! $adminEmail || ! $adminPassword)) {
            throw new RuntimeException(
                'Set LUCKYDRAW_ADMIN_EMAIL and LUCKYDRAW_ADMIN_PASSWORD before seeding production.'
            );
        }

        ApplicationSetting::query()->firstOrCreate(
            ['id' => 1],
            ApplicationSetting::defaults(),
        );

        User::updateOrCreate(
            ['email' => $adminEmail],
            [
                'name' => config('luckydraw.seed_admin_name', 'Lucky Draw Admin'),
                'password' => $adminPassword,
                'role' => 'admin',
                'status' => 'active',
            ],
        );

        User::query()
            ->where('role', 'admin')
            ->where('email', '!=', $adminEmail)
            ->update(['role' => 'user']);

        if (! $isProduction || config('luckydraw.seed_sample_user', false)) {
            $sampleUser = User::updateOrCreate(
                ['email' => 'sample@luckydraw.local'],
                [
                    'name' => 'Sample Player',
                    'phone' => '09123456789',
                    'password' => 'sample1234',
                    'role' => 'user',
                    'status' => 'active',
                ],
            );
            $sampleUser->wallet()->firstOrCreate([], ['balance' => 1000]);
        }

        $configuration = SpinConfiguration::updateOrCreate(
            ['name' => 'Default Wheel'],
            [
                'is_active' => true,
                'center_label' => 'LUCKY',
                'cost_points' => 10,
                'cooldown_seconds' => 0,
            ],
        );

        if ($configuration->wasRecentlyCreated) {
            $segments = [
                ['label' => 'Small Win', 'color' => '#ffca28', 'text_color' => '#3b2500', 'points_reward' => 5, 'weight' => 45],
                ['label' => 'Lucky Win', 'color' => '#ff7a00', 'text_color' => '#ffffff', 'points_reward' => 10, 'weight' => 30],
                ['label' => 'Big Win', 'color' => '#7c3aed', 'text_color' => '#ffffff', 'points_reward' => 20, 'weight' => 20],
                ['label' => 'Mega', 'color' => '#22c55e', 'text_color' => '#ffffff', 'points_reward' => 50, 'weight' => 5],
            ];

            foreach ($segments as $segment) {
                SpinSegment::create([
                    'spin_configuration_id' => $configuration->id,
                    'label' => $segment['label'],
                    'color' => $segment['color'],
                    'text_color' => $segment['text_color'],
                    'points_reward' => $segment['points_reward'],
                    'weight' => $segment['weight'],
                ]);
            }
        }
    }
}
