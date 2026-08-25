<?php

namespace App\Http\Controllers;

use App\Models\BettingSite;
use App\Services\AdminAuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BettingSiteController extends Controller
{
    public function __construct(private readonly AdminAuditService $auditService) {}

    public function index(): JsonResponse
    {
        return response()->json([
            'sites' => BettingSite::query()
                ->where('is_active', true)
                ->ordered()
                ->get(['id', 'name', 'display_text', 'url', 'button_text']),
        ]);
    }

    public function adminIndex(): JsonResponse
    {
        return response()->json([
            'sites' => BettingSite::query()->ordered()->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $site = BettingSite::query()->create($this->validated($request));
        $this->audit($request, 'admin.betting-site.create', $site, null, $site->toArray());

        return response()->json([
            'message' => 'Betting website created',
            'site' => $site,
        ], 201);
    }

    public function update(Request $request, BettingSite $bettingSite): JsonResponse
    {
        $before = $bettingSite->toArray();
        $bettingSite->update($this->validated($request));
        $bettingSite->refresh();
        $this->audit($request, 'admin.betting-site.update', $bettingSite, $before, $bettingSite->toArray());

        return response()->json([
            'message' => 'Betting website updated',
            'site' => $bettingSite,
        ]);
    }

    public function destroy(Request $request, BettingSite $bettingSite): JsonResponse
    {
        $before = $bettingSite->toArray();
        $id = $bettingSite->id;
        $bettingSite->delete();
        $this->audit($request, 'admin.betting-site.delete', $bettingSite, $before, null, $id);

        return response()->json(['message' => 'Betting website deleted']);
    }

    /** @return array{name:string, display_text:string, url:string, button_text:string, is_active:bool, sort_order:int} */
    private function validated(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'display_text' => ['required', 'string', 'max:500'],
            'url' => ['required', 'url:http,https', 'max:2048'],
            'button_text' => ['required', 'string', 'max:40'],
            'is_active' => ['required', 'boolean'],
            'sort_order' => ['required', 'integer', 'min:0', 'max:100000'],
        ]);
    }

    private function audit(
        Request $request,
        string $action,
        BettingSite $site,
        ?array $before,
        ?array $after,
        ?int $subjectId = null,
    ): void {
        $this->auditService->log([
            'actor' => $request->user(),
            'action' => $action,
            'subject_type' => BettingSite::class,
            'subject_id' => $subjectId ?? $site->id,
            'metadata' => ['before' => $before, 'after' => $after],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);
    }
}
