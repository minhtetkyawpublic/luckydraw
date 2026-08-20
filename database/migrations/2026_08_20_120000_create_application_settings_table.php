<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('application_settings', function (Blueprint $table) {
            $table->id();
            $table->string('play_bet_url', 2048)->default('https://m.bet555mix.com');
            $table->string('play_bet_label')->default('ဘောလုံးမောင်း ဘော်ဒီ၊ ဂိုးပေါင်း ကစားရန်');
            $table->string('contact_phone', 50)->nullable();
            $table->string('telegram_contact_url', 2048)->nullable();
            $table->string('viber_contact_url', 2048)->nullable();
            $table->string('telegram_channel_url', 2048)->nullable();
            $table->string('facebook_page_url', 2048)->nullable();
            $table->string('tiktok_channel_url', 2048)->nullable();
            $table->text('about_content')->nullable();
            $table->text('home_ticker_text')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('application_settings');
    }
};
