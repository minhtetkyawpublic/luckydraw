<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('spin_events', function (Blueprint $table) {
            $table->index(['user_id', 'is_free_spin', 'created_at'], 'spin_events_user_free_created_idx');
            $table->index(['user_id', 'created_at'], 'spin_events_user_created_desc_idx');
        });

        Schema::table('point_transactions', function (Blueprint $table) {
            $table->index(['user_id', 'type', 'created_at'], 'point_transactions_user_type_created_idx');
            $table->index(['type', 'created_at'], 'point_transactions_type_created_idx');
        });
    }

    public function down(): void
    {
        Schema::table('spin_events', function (Blueprint $table) {
            $table->dropIndex('spin_events_user_free_created_idx');
            $table->dropIndex('spin_events_user_created_desc_idx');
        });

        Schema::table('point_transactions', function (Blueprint $table) {
            $table->dropIndex('point_transactions_user_type_created_idx');
            $table->dropIndex('point_transactions_type_created_idx');
        });
    }
};
