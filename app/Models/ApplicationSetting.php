<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ApplicationSetting extends Model
{
    use HasFactory;

    protected $fillable = [
        'play_bet_url',
        'play_bet_label',
        'contact_phone',
        'contact_phone_numbers',
        'telegram_contact_url',
        'viber_contact_url',
        'telegram_channel_url',
        'facebook_page_url',
        'tiktok_channel_url',
        'about_content',
        'how_to_use_terms',
        'daily_bonus_points',
        'daily_bonus_schedule',
        'home_ticker_text',
        'home_board_text',
    ];

    protected $hidden = [
        'how_to_use_terms_en',
        'how_to_use_terms_my',
        'buy_points_instructions',
    ];

    protected function casts(): array
    {
        return [
            'daily_bonus_points' => 'integer',
            'daily_bonus_schedule' => 'array',
        ];
    }

    public static function defaults(): array
    {
        return [
            'play_bet_url' => 'https://m.bet555mix.com',
            'play_bet_label' => 'ဘောလုံးမောင်း ဘော်ဒီ၊ ဂိုးပေါင်း ကစားရန်',
            'contact_phone' => '09441884527',
            'contact_phone_numbers' => "09441884527\n09441884528\n09441884529",
            'telegram_contact_url' => 'tg://resolve?phone=959441884527',
            'viber_contact_url' => 'viber://chat?number=%2B959441884527',
            'telegram_channel_url' => null,
            'facebook_page_url' => null,
            'tiktok_channel_url' => null,
            'about_content' => 'မောင်းဘုရင် is a points-only Lucky Draw Wheel app.',
            'how_to_use_terms' => "အပ်(ပ်)အသုံးပြုနည်း\n• အသုံးပြုသူအမည်နှင့် စကားဝှက်ဖြင့် လော့အင်ဝင်ပါ။\n• နေ့စဉ်ပွိုင့်ရယူပြီး ကံစမ်းဘီးကို လှည့်နိုင်ပါသည်။\n• ပွိုင့်ဝယ်ရန် အက်ဒမင်ကို ဆက်သွယ်ပါ။\n\nစည်းကမ်းချက်များ\n• တစ်ရက်လျှင် အခမဲ့တစ်ကြိမ် လှည့်နိုင်ပါသည်။\n• အပ်(ပ်)အတွင်းရှိ ပွိုင့်များကို ငွေသားအဖြစ် သတ်မှတ်မထားပါ။\n• အကူအညီလိုပါက အက်ဒမင်ကို ဆက်သွယ်ပါ။",
            'daily_bonus_points' => 20,
            // Sunday through Saturday. Day 1 is always Sunday.
            'daily_bonus_schedule' => [20, 20, 20, 20, 20, 20, 20],
            'home_ticker_text' => 'Welcome to မောင်းဘုရင် • One free spin every day • Points-only rewards • Contact admin to exchange or buy points',
            'home_board_text' => "One free spin every day\nPoints-only wheel rewards\nPaid spins use wallet points\nDaily bonus available once\nAll activity is recorded\nContact admin for points",
        ];
    }

    public static function current(): self
    {
        return self::query()->firstOrCreate(['id' => 1], self::defaults());
    }
}
