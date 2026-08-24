<?php

namespace App\Http\Controllers;

use App\Models\PushSubscription;
use App\Services\WebPushService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PushSubscriptionController extends Controller
{
    public function __construct(private readonly WebPushService $webPushService) {}

    public function config(): JsonResponse
    {
        $publicKey = config('services.webpush.public_key');

        return response()->json([
            'configured' => $this->webPushService->configured(),
            'public_key' => $publicKey ?: null,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        abort_unless(
            $this->webPushService->configured(),
            503,
            'Web Push is not configured.',
        );

        $data = $request->validate([
            'endpoint' => ['required', 'string', 'max:4096', 'url:https'],
            'keys' => ['required', 'array'],
            'keys.p256dh' => ['required', 'string', 'max:2048'],
            'keys.auth' => ['required', 'string', 'max:2048'],
            'content_encoding' => ['nullable', 'in:aes128gcm,aesgcm'],
        ]);

        $subscription = PushSubscription::query()->updateOrCreate(
            ['endpoint_hash' => hash('sha256', $data['endpoint'])],
            [
                'user_id' => $request->user()->id,
                'endpoint' => $data['endpoint'],
                'public_key' => $data['keys']['p256dh'],
                'auth_token' => $data['keys']['auth'],
                'content_encoding' => $data['content_encoding'] ?? 'aes128gcm',
                'user_agent' => str($request->userAgent())->limit(500)->toString() ?: null,
                'last_used_at' => now(),
            ],
        );

        return response()->json([
            'message' => 'Push notifications enabled',
            'subscription_id' => $subscription->id,
        ], $subscription->wasRecentlyCreated ? 201 : 200);
    }

    public function destroy(Request $request): JsonResponse
    {
        $data = $request->validate([
            'endpoint' => ['required', 'string', 'max:4096'],
        ]);

        PushSubscription::query()
            ->where('user_id', $request->user()->id)
            ->where('endpoint_hash', hash('sha256', $data['endpoint']))
            ->delete();

        return response()->json(['message' => 'Push notifications disabled']);
    }
}
