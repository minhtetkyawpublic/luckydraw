<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('spin_events', function (Blueprint $table): void {
            $table->dropForeign(['spin_segment_id']);
            $table->foreign('spin_segment_id')
                ->references('id')
                ->on('spin_segments')
                ->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('spin_events', function (Blueprint $table): void {
            $table->dropForeign(['spin_segment_id']);
            $table->foreign('spin_segment_id')
                ->references('id')
                ->on('spin_segments')
                ->cascadeOnDelete();
        });
    }
};
