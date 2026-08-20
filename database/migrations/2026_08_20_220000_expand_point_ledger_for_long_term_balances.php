<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('point_transactions', function (Blueprint $table): void {
            $table->bigInteger('amount')->change();
            $table->unsignedBigInteger('balance_after')->change();
        });

        Schema::table('request_idempotency_keys', function (Blueprint $table): void {
            $table->index('created_at', 'idempotency_created_at_idx');
        });
    }

    public function down(): void
    {
        Schema::table('request_idempotency_keys', function (Blueprint $table): void {
            $table->dropIndex('idempotency_created_at_idx');
        });

        Schema::table('point_transactions', function (Blueprint $table): void {
            $table->integer('amount')->change();
            $table->integer('balance_after')->change();
        });
    }
};
