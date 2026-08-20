<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('spin_segments', function (Blueprint $table) {
            $table->boolean('is_active')->default(true)->after('text_color');
            $table->index(['spin_configuration_id', 'is_active'], 'spin_segments_config_active_idx');
        });
    }

    public function down(): void
    {
        Schema::table('spin_segments', function (Blueprint $table) {
            $table->dropIndex('spin_segments_config_active_idx');
            $table->dropColumn('is_active');
        });
    }
};
