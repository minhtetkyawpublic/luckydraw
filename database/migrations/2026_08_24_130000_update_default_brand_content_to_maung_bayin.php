<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('application_settings')) {
            return;
        }

        DB::table('application_settings')
            ->where('about_content', 'Lucky Draw is a points-only spin wheel app.')
            ->update([
                'about_content' => 'မောင်းဘုရင် is a points-only Lucky Draw Wheel app.',
            ]);

        DB::table('application_settings')
            ->where('home_ticker_text', 'Welcome to Lucky Draw • One free spin every day • Points-only rewards • Contact admin to exchange or buy points')
            ->update([
                'home_ticker_text' => 'Welcome to မောင်းဘုရင် • One free spin every day • Points-only rewards • Contact admin to exchange or buy points',
            ]);
    }

    public function down(): void
    {
        // Branding updates are intentionally not reverted to avoid overwriting later admin edits.
    }
};
