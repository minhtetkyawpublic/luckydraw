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
        Schema::create('daily_point_claims', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->date('claim_date');
            $table->unsignedInteger('points_awarded')->default(0);
            $table->unsignedBigInteger('wallet_transaction_id')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'claim_date'], 'daily_point_claims_user_date_unique');
        });

        // These two migrations share the same timestamp, so MySQL may run this
        // migration before point_transactions exists. Add the constraint now
        // when possible; otherwise the point_transactions migration adds it.
        if (Schema::hasTable('point_transactions')) {
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
        Schema::dropIfExists('daily_point_claims');
    }
};
