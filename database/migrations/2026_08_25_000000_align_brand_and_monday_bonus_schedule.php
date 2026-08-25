<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $this->rotateSchedules(toMondayFirst: true);

        DB::table('application_settings')
            ->whereIn('about_content', [
                'မောင်းဘုရင် is a points-only Lucky Draw Wheel app.',
                'Maung Bayin is a points-only Lucky Draw Wheel app.',
            ])
            ->update(['about_content' => 'Moung Ba Yin is a points and rewards app.']);

        DB::table('application_settings')
            ->whereIn('home_ticker_text', [
                'Welcome to မောင်းဘုရင် • One free spin every day • Points-only rewards • Contact admin to exchange or buy points',
                'Welcome to Maung Bayin • One free spin every day • Points-only rewards • Contact admin to exchange or buy points',
            ])
            ->update([
                'home_ticker_text' => 'Welcome to Moung Ba Yin • One free spin every day • Points-only rewards • Contact admin to exchange or buy points',
            ]);
    }

    public function down(): void
    {
        $this->rotateSchedules(toMondayFirst: false);

        DB::table('application_settings')
            ->where('about_content', 'Moung Ba Yin is a points and rewards app.')
            ->update(['about_content' => 'မောင်းဘုရင် is a points-only Lucky Draw Wheel app.']);

        DB::table('application_settings')
            ->where('home_ticker_text', 'Welcome to Moung Ba Yin • One free spin every day • Points-only rewards • Contact admin to exchange or buy points')
            ->update([
                'home_ticker_text' => 'Welcome to မောင်းဘုရင် • One free spin every day • Points-only rewards • Contact admin to exchange or buy points',
            ]);
    }

    private function rotateSchedules(bool $toMondayFirst): void
    {
        DB::table('application_settings')
            ->select(['id', 'daily_bonus_schedule'])
            ->whereNotNull('daily_bonus_schedule')
            ->orderBy('id')
            ->each(function ($setting) use ($toMondayFirst): void {
                $schedule = json_decode((string) $setting->daily_bonus_schedule, true);
                if (! is_array($schedule) || count($schedule) !== 7) {
                    return;
                }

                $rotated = $toMondayFirst
                    ? [...array_slice($schedule, 1), $schedule[0]]
                    : [$schedule[6], ...array_slice($schedule, 0, 6)];

                DB::table('application_settings')
                    ->where('id', $setting->id)
                    ->update(['daily_bonus_schedule' => json_encode(array_values($rotated))]);
            });
    }
};
