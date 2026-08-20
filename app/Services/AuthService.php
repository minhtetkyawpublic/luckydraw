<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthService
{
    public function login(array $data, string $expectedRole): User
    {
        $remember = (bool) ($data['remember_me'] ?? false);
        $identifier = trim((string) ($data['email_or_phone'] ?? ''));
        $password = $data['password'] ?? '';

        $user = User::query()
            ->where('email', $identifier)
            ->orWhere('phone', $identifier)
            ->first();

        if (! $user || ! Hash::check($password, $user->password)) {
            throw ValidationException::withMessages([
                'email_or_phone' => 'The provided credentials are incorrect.',
            ]);
        }

        if ($user->role !== $expectedRole) {
            $portal = $user->isAdmin() ? 'administrator portal' : 'user app';
            throw ValidationException::withMessages([
                'email_or_phone' => "This account belongs to the {$portal}.",
            ]);
        }

        if ($user->status !== 'active') {
            throw ValidationException::withMessages([
                'email_or_phone' => 'Your account is not active.',
            ]);
        }

        Auth::guard('web')->login($user, $remember);
        Auth::guard('web')->getSession()->regenerate();

        return $user;
    }

    public function logout(): void
    {
        Auth::guard('web')->logout();

        $request = request();
        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }
    }
}
