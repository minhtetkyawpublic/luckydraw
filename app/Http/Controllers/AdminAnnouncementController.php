<?php

namespace App\Http\Controllers;

use App\Jobs\DispatchAnnouncementPush;
use App\Models\Announcement;
use App\Services\AdminAuditService;
use App\Services\WebPushService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminAnnouncementController extends Controller
{
    public function __construct(
        private readonly AdminAuditService $auditService,
        private readonly WebPushService $webPushService,
    ) {}

    public function show(): JsonResponse
    {
        return response()->json([
            'announcement' => Announcement::current(),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:180'],
            'body' => ['required', 'string', 'max:20000'],
        ]);

        Announcement::current();
        $announcement = DB::transaction(function () use ($request, $data): Announcement {
            $announcement = Announcement::query()->lockForUpdate()->findOrFail(1);
            $before = $announcement->only(['title', 'body', 'version', 'published_at']);

            $announcement->update([
                ...$data,
                'version' => (int) $announcement->version + 1,
                'published_at' => now(),
                'updated_by' => $request->user()->id,
            ]);

            $this->auditService->log([
                'actor' => $request->user(),
                'action' => 'admin.announcement.publish',
                'subject_type' => Announcement::class,
                'subject_id' => $announcement->id,
                'metadata' => [
                    'before' => $before,
                    'after' => $announcement->only(['title', 'body', 'version', 'published_at']),
                ],
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);

            return $announcement->fresh();
        });

        DispatchAnnouncementPush::dispatch((int) $announcement->version)->onQueue('push');

        return response()->json([
            'message' => 'Announcement published',
            'announcement' => $announcement,
            'push_configured' => $this->webPushService->configured(),
        ]);
    }
}
