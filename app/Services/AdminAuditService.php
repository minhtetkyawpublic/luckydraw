<?php

namespace App\Services;

use App\Models\AdminAuditLog;
use Illuminate\Contracts\Auth\Authenticatable;

class AdminAuditService
{
    public function log(array $payload): void
    {
        $actor = $payload['actor'] ?? null;
        $actorId = $actor instanceof Authenticatable ? $actor->getAuthIdentifier() : null;

        AdminAuditLog::query()->create([
            'actor_user_id' => $actorId,
            'subject_user_id' => $payload['subject_user_id'] ?? null,
            'action' => $payload['action'],
            'subject_type' => $payload['subject_type'] ?? null,
            'subject_id' => $payload['subject_id'] ?? null,
            'metadata' => $payload['metadata'] ?? null,
            'ip_address' => $payload['ip_address'] ?? null,
            'user_agent' => $payload['user_agent'] ?? null,
        ]);
    }
}
