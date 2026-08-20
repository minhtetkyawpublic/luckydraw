<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->index('role', 'users_role_idx');
            $table->index('status', 'users_status_idx');
            $table->index(['role', 'status'], 'users_role_status_idx');
        });

        Schema::table('spin_configurations', function (Blueprint $table): void {
            $table->index('is_active', 'spin_configurations_is_active_idx');
            $table->index(['is_active', 'starts_at', 'ends_at'], 'spin_configurations_active_window_idx');
        });

        // points_wallets already has a unique(user_id) index created by default migration.
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropIndex('users_role_idx');
            $table->dropIndex('users_status_idx');
            $table->dropIndex('users_role_status_idx');
        });

        Schema::table('spin_configurations', function (Blueprint $table): void {
            $table->dropIndex('spin_configurations_is_active_idx');
            $table->dropIndex('spin_configurations_active_window_idx');
        });

        // points_wallets already has a unique(user_id) index created by default migration.
    }
};
