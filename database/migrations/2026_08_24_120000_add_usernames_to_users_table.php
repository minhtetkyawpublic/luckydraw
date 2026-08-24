<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('username', 50)->nullable()->after('name');
            $table->unique('username', 'users_username_unique');
            $table->string('email')->nullable()->change();
        });

        DB::table('users')
            ->where('role', 'user')
            ->orderBy('id')
            ->chunkById(200, function ($users): void {
                foreach ($users as $user) {
                    $source = $user->phone ?: Str::before((string) $user->email, '@');
                    $base = Str::lower((string) preg_replace(
                        '/[^A-Za-z0-9._-]+/',
                        '-',
                        Str::ascii((string) $source),
                    ));
                    $base = trim($base, '.-_');
                    if (strlen($base) < 3) {
                        $base = 'user'.$user->id;
                    }

                    $candidate = substr($base, 0, 50);
                    $attempt = 0;
                    while (DB::table('users')->where('username', $candidate)->exists()) {
                        $attempt++;
                        $suffix = '-'.$user->id.($attempt > 1 ? '-'.$attempt : '');
                        $candidate = substr($base, 0, 50 - strlen($suffix)).$suffix;
                    }

                    DB::table('users')->where('id', $user->id)->update([
                        'username' => $candidate,
                    ]);
                }
            });
    }

    public function down(): void
    {
        DB::table('users')
            ->whereNull('email')
            ->orderBy('id')
            ->chunkById(200, function ($users): void {
                foreach ($users as $user) {
                    DB::table('users')->where('id', $user->id)->update([
                        'email' => 'user'.$user->id.'@users.invalid',
                    ]);
                }
            });

        Schema::table('users', function (Blueprint $table): void {
            $table->string('email')->nullable(false)->change();
            $table->dropUnique('users_username_unique');
            $table->dropColumn('username');
        });
    }
};
