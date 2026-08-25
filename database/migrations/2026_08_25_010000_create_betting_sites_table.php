<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('betting_sites', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->string('display_text', 500);
            $table->string('url', 2048);
            $table->string('button_text', 40)->default('Play');
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['is_active', 'sort_order', 'id'], 'betting_sites_active_order_idx');
        });

        $settings = DB::table('application_settings')->where('id', 1)->first();
        $url = (string) ($settings?->play_bet_url ?: 'https://m.bet555mix.com');
        $host = parse_url($url, PHP_URL_HOST) ?: 'Betting website';

        DB::table('betting_sites')->insert([
            'name' => $host,
            'display_text' => (string) ($settings?->play_bet_label ?: 'ဘောလုံးမောင်း ဘော်ဒီ၊ ဂိုးပေါင်း ကစားရန်'),
            'url' => $url,
            'button_text' => 'Play',
            'is_active' => true,
            'sort_order' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('betting_sites');
    }
};
