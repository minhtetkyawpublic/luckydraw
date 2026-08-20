<?php

namespace App\Http\Controllers;

use App\Models\AdminAuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminAuditController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $action = $request->query('action');
        $actor = (int) $request->query('actor_user_id', 0);
        $subjectUser = (int) $request->query('subject_user_id', 0);
        $page = max(1, (int) $request->query('page', 1));
        $perPage = min(100, max(5, (int) $request->query('per_page', 20)));

        $query = AdminAuditLog::query()
            ->with('actor:id,name,email')
            ->latest();

        if ($action) {
            $query->where('action', $action);
        }
        if ($actor > 0) {
            $query->where('actor_user_id', $actor);
        }
        if ($subjectUser > 0) {
            $query->where('subject_user_id', $subjectUser);
        }

        $logs = $query->paginate($perPage, ['*'], 'page', $page);

        return response()->json([
            'logs' => $logs->items(),
            'meta' => [
                'current_page' => $logs->currentPage(),
                'per_page' => $logs->perPage(),
                'total' => $logs->total(),
                'last_page' => $logs->lastPage(),
            ],
        ]);
    }
}
