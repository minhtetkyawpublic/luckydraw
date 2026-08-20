<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('users', 'spin_cooldown_bypass_until')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex('users_spin_cooldown_bypass_until_idx');
            $table->dropColumn('spin_cooldown_bypass_until');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('users', 'spin_cooldown_bypass_until')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('spin_cooldown_bypass_until')->nullable()->after('status');
            $table->index('spin_cooldown_bypass_until', 'users_spin_cooldown_bypass_until_idx');
        });
    }
};
