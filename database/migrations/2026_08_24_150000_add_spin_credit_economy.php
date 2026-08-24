<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('spin_wallets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('balance')->default(0);
            $table->timestamps();
        });

        Schema::create('spin_credit_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('spin_wallet_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('type', 50)->index();
            $table->bigInteger('amount');
            $table->unsignedBigInteger('balance_after');
            $table->nullableMorphs('reference');
            $table->string('notes')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'created_at'], 'spin_credit_user_date_idx');
        });

        Schema::create('spin_exchange_packages', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('points_cost');
            $table->unsignedInteger('spins_amount');
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
        });

        Schema::table('spin_segments', function (Blueprint $table) {
            $table->string('reward_type', 20)->default('points')->after('points_reward');
            $table->unsignedInteger('spins_reward')->default(0)->after('reward_type');
        });

        Schema::table('spin_events', function (Blueprint $table) {
            $table->unsignedInteger('spins_spent')->default(0)->after('points_spent');
            $table->unsignedInteger('spins_awarded')->default(0)->after('points_awarded');
        });

        DB::table('spin_exchange_packages')->insert([
            ['points_cost' => 100, 'spins_amount' => 3, 'sort_order' => 1, 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
            ['points_cost' => 300, 'spins_amount' => 10, 'sort_order' => 2, 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
            ['points_cost' => 500, 'spins_amount' => 18, 'sort_order' => 3, 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    public function down(): void
    {
        Schema::table('spin_events', function (Blueprint $table) {
            $table->dropColumn(['spins_spent', 'spins_awarded']);
        });
        Schema::table('spin_segments', function (Blueprint $table) {
            $table->dropColumn(['reward_type', 'spins_reward']);
        });
        Schema::dropIfExists('spin_exchange_packages');
        Schema::dropIfExists('spin_credit_transactions');
        Schema::dropIfExists('spin_wallets');
    }
};
