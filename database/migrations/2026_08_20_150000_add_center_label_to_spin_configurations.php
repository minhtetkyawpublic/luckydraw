<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('spin_configurations', function (Blueprint $table) {
            $table->string('center_label', 20)->default('LUCKY')->after('name');
        });
    }

    public function down(): void
    {
        Schema::table('spin_configurations', function (Blueprint $table) {
            $table->dropColumn('center_label');
        });
    }
};
