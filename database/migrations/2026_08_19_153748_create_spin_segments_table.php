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
        Schema::create('spin_segments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('spin_configuration_id')->constrained()->cascadeOnDelete();
            $table->string('label');
            $table->unsignedInteger('points_reward')->default(0);
            $table->unsignedInteger('weight')->default(1);
            $table->unsignedInteger('max_win_per_day')->nullable();
            $table->timestamps();

            $table->index('spin_configuration_id', 'spin_segments_config_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('spin_segments');
    }
};
