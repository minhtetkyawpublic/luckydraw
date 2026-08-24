<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('application_settings', function (Blueprint $table) {
            $table->json('daily_bonus_schedule')->nullable()->after('daily_bonus_points');
        });

        DB::table('application_settings')
            ->select(['id', 'daily_bonus_points'])
            ->orderBy('id')
            ->each(function ($setting): void {
                DB::table('application_settings')
                    ->where('id', $setting->id)
                    ->update([
                        'daily_bonus_schedule' => json_encode(array_fill(0, 7, (int) $setting->daily_bonus_points)),
                    ]);
            });
    }

    public function down(): void
    {
        Schema::table('application_settings', function (Blueprint $table) {
            $table->dropColumn('daily_bonus_schedule');
        });
    }
};
