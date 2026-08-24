<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\AuthService;
use App\Services\WalletService;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(
        private readonly AuthService $authService,
        private readonly WalletService $walletService,
    ) {}

    public function login(Request $request): JsonResponse
    {
        return $this->authenticate($request, 'user');
    }

    public function adminLogin(Request $request): JsonResponse
    {
        return $this->authenticate($request, 'admin');
    }

    private function authenticate(Request $request, string $expectedRole): JsonResponse
    {
        $identifierField = $expectedRole === 'admin' ? 'email_or_phone' : 'username';
        $data = $request->validate([
            $identifierField => 'required|string|max:255',
            'password' => 'required|string|max:255',
            'remember_me' => 'sometimes|boolean',
        ]);

        try {
            $user = $this->authService->login($data, $expectedRole);
            if (! $user->isAdmin()) {
                $this->walletService->getOrCreateWallet($user);
            }

            return response()->json([
                'message' => 'Login successful',
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'username' => $user->username,
                    'email' => $user->email,
                    'phone' => $user->phone,
                    'role' => $user->role,
                ],
                'role' => $user->role,
                'auth' => true,
            ]);
        } catch (ValidationException $e) {
            $validationMessage = collect($e->errors())->flatten()->first();
            $message = is_string($validationMessage) && str_starts_with($validationMessage, 'This account belongs')
                ? $validationMessage
                : 'Invalid credentials';

            return response()->json([
                'message' => $message,
                'errors' => $e->errors(),
            ], 422);
        } catch (Exception) {
            return response()->json([
                'message' => 'Unable to sign in. Please try again.',
            ], 422);
        }
    }

    public function logout(Request $request): JsonResponse
    {
        $this->authService->logout();

        return response()->json([
            'message' => 'Logout successful',
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user instanceof User) {
            return response()->json([
                'message' => 'Unauthenticated',
            ], 401);
        }

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'username' => $user->username,
                'email' => $user->email,
                'phone' => $user->phone,
                'role' => $user->role,
            ],
        ]);
    }
}
