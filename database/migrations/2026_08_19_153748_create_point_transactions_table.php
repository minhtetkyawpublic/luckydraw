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
        Schema::create('point_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('wallet_id')->constrained('points_wallets')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('type');
            $table->integer('amount');
            $table->integer('balance_after');
            $table->string('status')->default('completed');
            $table->string('reference_type')->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'created_at'], 'point_transactions_user_created_idx');
        });

        if (Schema::hasTable('daily_point_claims')) {
            Schema::table('daily_point_claims', function (Blueprint $table) {
                $table->foreign('wallet_transaction_id')
                    ->references('id')
                    ->on('point_transactions')
                    ->nullOnDelete();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('daily_point_claims')) {
            Schema::table('daily_point_claims', function (Blueprint $table) {
                $table->dropForeign(['wallet_transaction_id']);
            });
        }

        Schema::dropIfExists('point_transactions');
    }
};
