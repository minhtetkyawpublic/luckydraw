<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class SessionSecurityService
{
    public function revoke(User $user, ?string $exceptSessionId = null): void
    {
        $user->forceFill([
            'remember_token' => Str::random(60),
        ])->save();

        $table = (string) config('session.table', 'sessions');
        if ($table === '' || ! Schema::hasTable($table)) {
            return;
        }

        $sessions = DB::table($table)->where('user_id', $user->id);
        if ($exceptSessionId) {
            $sessions->where('id', '!=', $exceptSessionId);
        }

        $sessions->delete();
    }
}
