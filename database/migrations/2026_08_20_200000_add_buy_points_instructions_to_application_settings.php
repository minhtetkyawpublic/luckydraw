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
            $table->text('buy_points_instructions')->nullable()->after('about_content');
        });

        DB::table('application_settings')->update([
            'buy_points_instructions' => "To buy points, contact the administrator outside this app.\nSend your username or phone number, complete payment with the admin, and your wallet points will be added manually.",
        ]);
    }

    public function down(): void
    {
        Schema::table('application_settings', function (Blueprint $table) {
            $table->dropColumn('buy_points_instructions');
        });
    }
};
