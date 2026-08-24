<?php

namespace App\Jobs;

use App\Models\Announcement;
use App\Models\PushSubscription;
use App\Services\WebPushService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class SendAnnouncementPushBatch implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $timeout = 120;

    /**
     * @param  array<int, int>  $subscriptionIds
     */
    public function __construct(
        public readonly int $announcementVersion,
        public readonly array $subscriptionIds,
    ) {}

    public function handle(WebPushService $webPushService): void
    {
        $announcement = Announcement::current();

        if (! $announcement->isPublished() || (int) $announcement->version !== $this->announcementVersion) {
            return;
        }

        $subscriptions = PushSubscription::query()
            ->whereIn('id', $this->subscriptionIds)
            ->get();

        $webPushService->sendAnnouncement($announcement, $subscriptions);
    }
}
