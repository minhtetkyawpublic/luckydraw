<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('request_idempotency_keys', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('scope');
            $table->string('idempotency_key');
            $table->string('request_hash');
            $table->unsignedInteger('response_status')->nullable();
            $table->json('response_payload')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'scope', 'idempotency_key'], 'idempotency_user_scope_key_unique');
            $table->index(['scope', 'created_at'], 'idempotency_scope_created_idx');
            $table->index(['user_id', 'scope'], 'idempotency_user_scope_idx');
            $table->index('completed_at', 'idempotency_completed_at_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('request_idempotency_keys');
    }
};
