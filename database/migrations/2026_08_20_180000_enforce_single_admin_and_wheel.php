<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $primaryAdminId = DB::table('users')
            ->where('role', 'admin')
            ->orderByRaw("CASE WHEN email = 'admin@luckydraw.local' THEN 0 ELSE 1 END")
            ->orderBy('id')
            ->value('id');

        if ($primaryAdminId) {
            DB::table('users')
                ->where('role', 'admin')
                ->where('id', '!=', $primaryAdminId)
                ->update(['role' => 'user', 'updated_at' => now()]);
        }

        $wheelId = DB::table('spin_configurations')
            ->orderByDesc('is_active')
            ->orderBy('id')
            ->value('id');

        if ($wheelId) {
            DB::table('spin_configurations')->where('id', $wheelId)->update([
                'name' => 'Lucky Draw Wheel',
                'is_active' => true,
                'cooldown_seconds' => 0,
                'starts_at' => null,
                'ends_at' => null,
                'updated_at' => now(),
            ]);
            DB::table('spin_configurations')
                ->where('id', '!=', $wheelId)
                ->update(['is_active' => false, 'updated_at' => now()]);
        }
    }

    public function down(): void
    {
        // Consolidated administrator and wheel records cannot be safely reconstructed.
    }
};
