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
            $table->text('home_board_text')->nullable()->after('home_ticker_text');
            $table->text('contact_phone_numbers')->nullable()->after('contact_phone');
        });

        DB::table('application_settings')->orderBy('id')->each(function ($settings): void {
            DB::table('application_settings')->where('id', $settings->id)->update([
                'contact_phone_numbers' => $settings->contact_phone,
                'home_board_text' => implode("\n", [
                    'One free spin every day',
                    'Points-only wheel rewards',
                    'Paid spins use wallet points',
                    'Daily bonus available once',
                    'All activity is recorded',
                    'Contact admin for points',
                ]),
            ]);
        });
    }

    public function down(): void
    {
        Schema::table('application_settings', function (Blueprint $table) {
            $table->dropColumn(['home_board_text', 'contact_phone_numbers']);
        });
    }
};
