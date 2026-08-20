<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('spin_segments', function (Blueprint $table) {
            $table->string('color', 7)->nullable()->after('label');
            $table->string('text_color', 7)->nullable()->after('color');
        });

        $palette = ['#ffca28', '#ff7a00', '#7c3aed', '#ec4899', '#22c55e', '#0ea5e9'];
        DB::table('spin_segments')->orderBy('spin_configuration_id')->orderBy('id')->get()
            ->groupBy('spin_configuration_id')
            ->each(function ($segments) use ($palette): void {
                foreach ($segments->values() as $index => $segment) {
                    DB::table('spin_segments')->where('id', $segment->id)->update([
                        'color' => $palette[$index % count($palette)],
                        'text_color' => '#ffffff',
                    ]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('spin_segments', function (Blueprint $table) {
            $table->dropColumn(['color', 'text_color']);
        });
    }
};
