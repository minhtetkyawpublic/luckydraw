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
            $table->unsignedInteger('daily_bonus_points')->default(20)->after('buy_points_instructions');
        });

        DB::table('application_settings')->update([
            'daily_bonus_points' => 20,
        ]);
    }

    public function down(): void
    {
        Schema::table('application_settings', function (Blueprint $table) {
            $table->dropColumn('daily_bonus_points');
        });
    }
};
