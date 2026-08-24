<?php

use App\Http\Controllers\AdminAnnouncementController;
use App\Http\Controllers\AdminUserController;
use App\Http\Controllers\AnnouncementController;
use App\Http\Controllers\ApplicationSettingController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\DailyBonusController;
use App\Http\Controllers\PushSubscriptionController;
use App\Http\Controllers\SpinConfigurationController;
use App\Http\Controllers\SpinController;
use App\Http\Controllers\SpinExchangeController;
use App\Http\Controllers\WalletController;
use Illuminate\Support\Facades\Route;

Route::get('/health', function () {
    return response()->json(['status' => 'ok']);
})->name('api.health');
Route::get('/app-settings', ApplicationSettingController::class.'@show')->middleware('throttle:60,1');

Route::prefix('auth')->group(function () {
    Route::post('/login', AuthController::class.'@login')->middleware('throttle:6,1');
    Route::post('/admin/login', AuthController::class.'@adminLogin')->middleware('throttle:6,1');
    Route::post('/logout', AuthController::class.'@logout')->middleware('auth:sanctum');
    Route::get('/me', AuthController::class.'@me')->middleware('auth:sanctum');
});

Route::middleware(['auth:sanctum', 'active-user', 'role:user'])->group(function () {
    Route::get('/wallet', WalletController::class.'@show');
    Route::get('/wallet/transactions', WalletController::class.'@transactions');
    Route::post('/points/claim-daily', DailyBonusController::class.'@claim')->middleware('throttle:4,1');
    Route::post('/spins/free', SpinController::class.'@free')->middleware('throttle:spin-free');
    Route::post('/spins', SpinController::class.'@paid')->middleware('throttle:spin-paid');
    Route::get('/spins/me', SpinController::class.'@me')->middleware('throttle:spin-status');
    Route::get('/spins/status', SpinController::class.'@status')->middleware('throttle:spin-status');
    Route::get('/spin-exchange-packages', SpinExchangeController::class.'@index');
    Route::post('/spin-exchange-packages/{package}/exchange', SpinExchangeController::class.'@exchange')->middleware('throttle:spin-paid');
    Route::get('/announcement', AnnouncementController::class.'@show');
    Route::post('/announcement/read', AnnouncementController::class.'@markRead')->middleware('throttle:20,1');
    Route::get('/push/config', PushSubscriptionController::class.'@config');
    Route::post('/push/subscriptions', PushSubscriptionController::class.'@store')->middleware('throttle:10,1');
    Route::delete('/push/subscriptions', PushSubscriptionController::class.'@destroy')->middleware('throttle:10,1');
});

Route::prefix('admin')->middleware(['auth:sanctum', 'active-user', 'role:admin', 'throttle:admin-write'])->group(function () {
    Route::get('/profile', AdminUserController::class.'@profile');
    Route::patch('/profile', AdminUserController::class.'@updateProfile');
    Route::patch('/profile/password', AdminUserController::class.'@changePassword');
    Route::patch('/app-settings', ApplicationSettingController::class.'@update');
    Route::get('/announcement', AdminAnnouncementController::class.'@show');
    Route::put('/announcement', AdminAnnouncementController::class.'@update');
    Route::get('/users', AdminUserController::class.'@index');
    Route::post('/users', AdminUserController::class.'@store');
    Route::get('/users/{user}', AdminUserController::class.'@show');
    Route::post('/users/{user}/reset-password', AdminUserController::class.'@resetPassword');
    Route::post('/users/{user}/adjust-points', AdminUserController::class.'@adjustPoints');
    Route::patch('/users/{user}', AdminUserController::class.'@update');

    Route::get('/spin-configuration', SpinConfigurationController::class.'@show');
    Route::patch('/spin-configuration', SpinConfigurationController::class.'@update');
    Route::get('/spin-exchange-packages', SpinExchangeController::class.'@adminIndex');
    Route::put('/spin-exchange-packages', SpinExchangeController::class.'@adminUpdate');
});
