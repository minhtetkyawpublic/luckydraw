<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('application_settings', function (Blueprint $table) {
            $table->text('how_to_use_terms')->nullable()->after('about_content');
        });

        DB::table('application_settings')
            ->select(['id', 'how_to_use_terms_en', 'how_to_use_terms_my'])
            ->orderBy('id')
            ->each(function ($setting): void {
                // Prefer the existing Burmese copy for this Burmese-first app,
                // while retaining both legacy columns for a safe rollback.
                $content = trim((string) ($setting->how_to_use_terms_my ?: $setting->how_to_use_terms_en));
                DB::table('application_settings')->where('id', $setting->id)->update([
                    'how_to_use_terms' => $content !== '' ? $content : null,
                ]);
            });
    }

    public function down(): void
    {
        Schema::table('application_settings', function (Blueprint $table) {
            $table->dropColumn('how_to_use_terms');
        });
    }
};
