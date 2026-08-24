<?php

namespace App\Services;

use App\Models\Announcement;
use App\Models\PushSubscription;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;

class WebPushService
{
    public function configured(): bool
    {
        return filled(config('services.webpush.subject'))
            && filled(config('services.webpush.public_key'))
            && filled(config('services.webpush.private_key'));
    }

    /**
     * @param  Collection<int, PushSubscription>  $subscriptions
     * @return array{sent:int, failed:int, expired:int}
     */
    public function sendAnnouncement(Announcement $announcement, Collection $subscriptions): array
    {
        $stats = ['sent' => 0, 'failed' => 0, 'expired' => 0];

        if (! $this->configured() || $subscriptions->isEmpty() || ! $announcement->isPublished()) {
            return $stats;
        }

        $webPush = new WebPush([
            'VAPID' => [
                'subject' => config('services.webpush.subject'),
                'publicKey' => config('services.webpush.public_key'),
                'privateKey' => config('services.webpush.private_key'),
            ],
        ], [
            'TTL' => 86400,
            'urgency' => 'normal',
            'topic' => 'mby-announcement',
            'batchSize' => 200,
            'requestConcurrency' => 20,
        ], 15, [], Log::getLogger());
        $webPush->setReuseVAPIDHeaders(true);

        $payload = json_encode([
            'type' => 'announcement',
            'title' => $announcement->title,
            'body' => str($announcement->body)->squish()->limit(180)->toString(),
            'version' => (int) $announcement->version,
            'url' => 'announcement',
            'tag' => 'mby-current-announcement',
        ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        $subscriptionsByHash = $subscriptions->keyBy('endpoint_hash');

        foreach ($subscriptions as $storedSubscription) {
            try {
                $webPush->queueNotification(Subscription::create([
                    'endpoint' => $storedSubscription->endpoint,
                    'publicKey' => $storedSubscription->public_key,
                    'authToken' => $storedSubscription->auth_token,
                    'contentEncoding' => $storedSubscription->content_encoding,
                ]), $payload);
            } catch (\Throwable $e) {
                $stats['failed']++;
                Log::warning('Could not prepare Web Push subscription.', [
                    'subscription_id' => $storedSubscription->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        foreach ($webPush->flush() as $report) {
            $storedSubscription = $subscriptionsByHash->get(hash('sha256', $report->getEndpoint()));

            if ($report->isSuccess()) {
                $stats['sent']++;
                $storedSubscription?->forceFill(['last_used_at' => now()])->save();

                continue;
            }

            if ($report->isSubscriptionExpired()) {
                $stats['expired']++;
                $storedSubscription?->delete();

                continue;
            }

            $stats['failed']++;
            Log::warning('Web Push delivery failed.', [
                'subscription_id' => $storedSubscription?->id,
                'reason' => $report->getReason(),
            ]);
        }

        return $stats;
    }
}
