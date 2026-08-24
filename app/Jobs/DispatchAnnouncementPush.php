<?php

namespace App\Jobs;

use App\Models\Announcement;
use App\Models\PushSubscription;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class DispatchAnnouncementPush implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $timeout = 60;

    public function __construct(public readonly int $announcementVersion) {}

    public function handle(): void
    {
        $announcement = Announcement::current();

        // If an admin published again before this job ran, only the newest post is sent.
        if (! $announcement->isPublished() || (int) $announcement->version !== $this->announcementVersion) {
            return;
        }

        PushSubscription::query()
            ->whereHas('user', fn ($query) => $query
                ->where('role', 'user')
                ->where('status', 'active'))
            ->select('id')
            ->orderBy('id')
            ->chunkById(200, function ($subscriptions): void {
                SendAnnouncementPushBatch::dispatch(
                    $this->announcementVersion,
                    $subscriptions->pluck('id')->map(fn ($id) => (int) $id)->all(),
                )->onQueue('push');
            });
    }
}
