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
        Schema::create('daily_free_spins', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->date('spin_date');
            $table->unsignedBigInteger('spin_event_id')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'spin_date'], 'daily_free_spins_user_date_unique');
            $table->index('spin_event_id', 'daily_free_spins_spin_event_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('daily_free_spins');
    }
};
