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
            $table->text('how_to_use_terms_en')->nullable()->after('about_content');
            $table->text('how_to_use_terms_my')->nullable()->after('how_to_use_terms_en');
        });

        DB::table('application_settings')->whereNull('how_to_use_terms_en')->update([
            'how_to_use_terms_en' => "How to use\n• Log in with your username and password.\n• Claim your daily points and use the Lucky Draw Wheel.\n• Contact admin to buy points.\n\nTerms\n• One free spin is available each day.\n• Points have no cash value inside this app.\n• Contact the administrator if you need help.",
            'how_to_use_terms_my' => "အပ်(ပ်)အသုံးပြုနည်း\n• အသုံးပြုသူအမည်နှင့် စကားဝှက်ဖြင့် လော့အင်ဝင်ပါ။\n• နေ့စဉ်ပွိုင့်ရယူပြီး ကံစမ်းဘီးကို လှည့်နိုင်ပါသည်။\n• ပွိုင့်ဝယ်ရန် အက်ဒမင်ကို ဆက်သွယ်ပါ။\n\nစည်းကမ်းချက်များ\n• တစ်ရက်လျှင် အခမဲ့တစ်ကြိမ် လှည့်နိုင်ပါသည်။\n• အပ်(ပ်)အတွင်းရှိ ပွိုင့်များကို ငွေသားအဖြစ် သတ်မှတ်မထားပါ။\n• အကူအညီလိုပါက အက်ဒမင်ကို ဆက်သွယ်ပါ။",
        ]);
    }

    public function down(): void
    {
        Schema::table('application_settings', function (Blueprint $table) {
            $table->dropColumn(['how_to_use_terms_en', 'how_to_use_terms_my']);
        });
    }
};
