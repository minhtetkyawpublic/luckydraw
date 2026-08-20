<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('spin_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('spin_configuration_id')->constrained()->restrictOnDelete();
            $table->foreignId('spin_segment_id')->constrained('spin_segments')->cascadeOnDelete();
            $table->unsignedInteger('points_spent')->default(0);
            $table->unsignedInteger('points_awarded')->default(0);
            $table->boolean('is_free_spin')->default(false);
            $table->json('result_payload')->nullable();
            $table->string('random_seed');
            $table->string('algorithm_version')->default('v1');
            $table->string('status')->default('completed');
            $table->timestamps();

            $table->index('user_id', 'spin_events_user_idx');
            $table->index('spin_configuration_id', 'spin_events_config_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('spin_events');
    }
};
