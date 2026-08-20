<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('spin-free', function (Request $request) {
            return [
                Limit::perMinute(30)->by($this->rateLimitSubject($request))->response(function () {
                    return response()->json([
                        'message' => 'Spin attempt limit reached. Please retry shortly.',
                    ], 429);
                }),
                Limit::perSecond(8)->by($this->rateLimitSubject($request))->response(function () {
                    return response()->json([
                        'message' => 'Too many spin attempts too quickly. Please slow down.',
                    ], 429);
                }),
            ];
        });

        RateLimiter::for('spin-paid', function (Request $request) {
            return [
                Limit::perMinute(60)->by($this->rateLimitSubject($request))->response(function () {
                    return response()->json([
                        'message' => 'Paid spin attempt limit reached. Please retry shortly.',
                    ], 429);
                }),
                Limit::perSecond(10)->by($this->rateLimitSubject($request))->response(function () {
                    return response()->json([
                        'message' => 'Too many paid spin attempts too quickly. Please slow down.',
                    ], 429);
                }),
            ];
        });

        RateLimiter::for('spin-status', function (Request $request) {
            return [
                Limit::perMinute(120)->by($this->rateLimitSubject($request)),
                Limit::perSecond(25)->by($this->rateLimitSubject($request)),
            ];
        });

        RateLimiter::for('admin-write', function (Request $request) {
            return Limit::perMinute(120)->by($this->rateLimitSubject($request));
        });
    }

    private function rateLimitSubject(Request $request): string
    {
        $user = $request->user();

        return $user ? "user:{$user->id}" : "ip:{$request->ip()}";
    }
}
