<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $adminIds = DB::table('users')->where('role', 'admin')->pluck('id');
        DB::table('points_wallets')->whereIn('user_id', $adminIds)->delete();
    }

    public function down(): void
    {
        // Administrator wallets are intentionally not recreated.
    }
};
