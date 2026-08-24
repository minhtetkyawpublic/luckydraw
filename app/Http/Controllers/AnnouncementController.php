<?php

namespace App\Http\Controllers;

use App\Models\Announcement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AnnouncementController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $announcement = Announcement::current();

        return response()->json([
            'announcement' => $announcement->isPublished()
                ? $this->payload($announcement, $request)
                : null,
        ]);
    }

    public function markRead(Request $request): JsonResponse
    {
        if (! Announcement::current()->isPublished()) {
            return response()->json(['announcement' => null]);
        }

        [$announcement, $user] = DB::transaction(function () use ($request): array {
            $announcement = Announcement::query()->lockForUpdate()->findOrFail(1);
            $user = $request->user()->newQuery()->lockForUpdate()->findOrFail($request->user()->id);
            $user->forceFill([
                'last_read_announcement_version' => max(
                    (int) $user->last_read_announcement_version,
                    (int) $announcement->version,
                ),
            ])->save();

            return [$announcement, $user];
        });

        return response()->json([
            'message' => 'Announcement marked as read',
            'announcement' => [
                'id' => $announcement->id,
                'title' => $announcement->title,
                'body' => $announcement->body,
                'version' => (int) $announcement->version,
                'published_at' => $announcement->published_at?->toISOString(),
                'unread' => (int) $user->last_read_announcement_version < (int) $announcement->version,
            ],
        ]);
    }

    private function payload(Announcement $announcement, Request $request, ?bool $unread = null): array
    {
        return [
            'id' => $announcement->id,
            'title' => $announcement->title,
            'body' => $announcement->body,
            'version' => (int) $announcement->version,
            'published_at' => $announcement->published_at?->toISOString(),
            'unread' => $unread ?? (int) $request->user()->last_read_announcement_version < (int) $announcement->version,
        ];
    }
}
