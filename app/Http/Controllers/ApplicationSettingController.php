<?php

namespace App\Http\Controllers;

use App\Models\ApplicationSetting;
use App\Services\AdminAuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ApplicationSettingController extends Controller
{
    public function __construct(private readonly AdminAuditService $auditService) {}

    public function show(): JsonResponse
    {
        return response()->json([
            'settings' => ApplicationSetting::current(),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'play_bet_url' => ['required', 'url:http,https', 'max:2048'],
            'play_bet_label' => ['required', 'string', 'max:255'],
            'contact_phone' => ['nullable', 'string', 'max:50'],
            'contact_phone_numbers' => ['nullable', 'string', 'max:3000'],
            'telegram_contact_url' => ['nullable', 'string', 'max:2048', 'regex:/^(https?:\/\/|tg:\/\/)/i'],
            'viber_contact_url' => ['nullable', 'string', 'max:2048', 'regex:/^(https?:\/\/|viber:\/\/)/i'],
            'telegram_channel_url' => ['nullable', 'url:http,https', 'max:2048'],
            'facebook_page_url' => ['nullable', 'url:http,https', 'max:2048'],
            'tiktok_channel_url' => ['nullable', 'url:http,https', 'max:2048'],
            'about_content' => ['nullable', 'string', 'max:5000'],
            'buy_points_instructions' => ['nullable', 'string', 'max:5000'],
            'daily_bonus_points' => ['required', 'integer', 'min:0', 'max:1000000'],
            'home_ticker_text' => ['nullable', 'string', 'max:1000'],
            'home_board_text' => ['nullable', 'string', 'max:5000'],
        ]);

        $settings = ApplicationSetting::current();
        $before = $settings->only(array_keys($data));
        $settings->update($data);

        $this->auditService->log([
            'actor' => $request->user(),
            'action' => 'admin.application-settings.update',
            'subject_type' => ApplicationSetting::class,
            'subject_id' => $settings->id,
            'metadata' => ['before' => $before, 'after' => $data],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response()->json([
            'message' => 'Application settings updated',
            'settings' => $settings->fresh(),
        ]);
    }
}
