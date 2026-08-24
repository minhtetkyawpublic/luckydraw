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
        'buy_points_instructions',
        'daily_bonus_points',
        'home_ticker_text',
        'home_board_text',
    ];

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
            'buy_points_instructions' => "To buy points, contact the administrator outside this app.\nSend your username or phone number, complete payment with the admin, and your wallet points will be added manually.",
            'daily_bonus_points' => 20,
            'home_ticker_text' => 'Welcome to မောင်းဘုရင် • One free spin every day • Points-only rewards • Contact admin to exchange or buy points',
            'home_board_text' => "One free spin every day\nPoints-only wheel rewards\nPaid spins use wallet points\nDaily bonus available once\nAll activity is recorded\nContact admin for points",
        ];
    }

    public static function current(): self
    {
        return self::query()->firstOrCreate(['id' => 1], self::defaults());
    }
}
