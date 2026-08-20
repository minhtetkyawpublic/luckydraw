<?php

namespace App\Http\Controllers;

use App\Models\PointTransaction;
use App\Models\User;
use App\Services\AdminAuditService;
use App\Services\WalletService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class AdminUserController extends Controller
{
    public function __construct(
        private readonly WalletService $walletService,
        private readonly AdminAuditService $auditService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'status' => 'nullable|in:active,disabled',
            'q' => 'nullable|string|max:255',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        $status = $request->query('status');
        $q = trim((string) $request->query('q', ''));
        $perPage = min(100, max(5, (int) $request->query('per_page', 20)));
        $page = max(1, (int) $request->query('page', 1));

        $query = User::query()
            ->where('role', 'user')
            ->with('wallet:id,user_id,balance')
            ->orderByDesc('id');

        if ($q !== '') {
            $query->where(function ($builder) use ($q) {
                $builder->where('name', 'like', "%{$q}%")
                    ->orWhere('email', 'like', "%{$q}%")
                    ->orWhere('phone', 'like', "%{$q}%");
            });
        }

        if ($status) {
            $query->where('status', $status);
        }

        $users = $query->paginate($perPage, ['*'], 'page', $page);

        $rows = $users->through(fn (User $user) => [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'role' => $user->role,
            'status' => $user->status,
            'wallet_balance' => $user->wallet?->balance ?? 0,
            'created_at' => optional($user->created_at)->toISOString(),
        ])->items();

        return response()->json([
            'users' => $rows,
            'meta' => [
                'current_page' => $users->currentPage(),
                'per_page' => $users->perPage(),
                'total' => $users->total(),
                'last_page' => $users->lastPage(),
            ],
        ]);
    }

    public function show(Request $request, User $user): JsonResponse
    {
        abort_if($user->isAdmin(), 403, 'The administrator account is managed from Admin Settings.');

        $request->validate([
            'type' => 'nullable|string|max:100',
            'from' => 'nullable|date_format:Y-m-d',
            'to' => 'nullable|date_format:Y-m-d|after_or_equal:from',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        $type = $request->query('type');
        $from = $request->query('from');
        $to = $request->query('to');
        $page = max(1, (int) $request->query('page', 1));
        $perPage = min(100, max(5, (int) $request->query('per_page', 20)));

        $wallet = $this->walletService->getOrCreateWallet($user);
        $query = $user->pointTransactions();

        if ($type) {
            $query->where('type', $type);
        }

        if ($from) {
            $query->where('created_at', '>=', Carbon::createFromFormat('Y-m-d', $from)->startOfDay());
        }

        if ($to) {
            $query->where('created_at', '<=', Carbon::createFromFormat('Y-m-d', $to)->endOfDay());
        }

        $transactions = $query
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate($perPage, ['*'], 'page', $page);

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'role' => $user->role,
                'status' => $user->status,
                'wallet_balance' => $wallet->balance,
                'created_at' => optional($user->created_at)->toISOString(),
            ],
            'transactions' => $transactions->items(),
            'meta' => [
                'current_page' => $transactions->currentPage(),
                'per_page' => $transactions->perPage(),
                'total' => $transactions->total(),
                'last_page' => $transactions->lastPage(),
            ],
        ]);
    }

    public function export(Request $request)
    {
        $status = $request->query('status');
        $q = trim((string) $request->query('q', ''));

        $query = User::query()->where('role', 'user')->with('wallet:id,user_id,balance');
        if ($q !== '') {
            $query->where(function ($builder) use ($q) {
                $builder->where('name', 'like', "%{$q}%")
                    ->orWhere('email', 'like', "%{$q}%")
                    ->orWhere('phone', 'like', "%{$q}%");
            });
        }
        if ($status) {
            $query->where('status', $status);
        }

        $users = $query->orderByDesc('id')->get();

        $rows = [
            ['id', 'name', 'email', 'phone', 'role', 'status', 'wallet_balance', 'created_at'],
        ];
        foreach ($users as $user) {
            $rows[] = [
                $user->id,
                $user->name,
                $user->email,
                $user->phone,
                $user->role,
                $user->status,
                $user->wallet?->balance ?? 0,
                optional($user->created_at)->toISOString(),
            ];
        }

        $content = implode(PHP_EOL, array_map(static fn (array $row) => implode(',', $row), $rows));

        $this->auditService->log([
            'actor' => $request->user(),
            'action' => 'admin.user.export',
            'metadata' => [
                'status' => $status ?? null,
                'q' => $q ?: null,
                'count' => count($users),
            ],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response($content, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="users-'.now()->format('Ymd_His').'.csv"',
        ]);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        abort_if($user->isAdmin(), 403, 'The administrator account is managed from Admin Settings.');

        $data = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'email' => 'sometimes|required|email|unique:users,email,'.$user->id,
            'phone' => 'sometimes|nullable|string|max:50|unique:users,phone,'.$user->id,
            'status' => 'sometimes|in:active,disabled',
            'status_note' => 'nullable|string|max:1000',
        ]);

        $user->update($data);

        $this->auditService->log([
            'actor' => $request->user(),
            'action' => 'admin.user.update',
            'subject_user_id' => $user->id,
            'subject_type' => User::class,
            'subject_id' => $user->id,
            'metadata' => [
                'request' => $data,
                'status_note' => $data['status_note'] ?? null,
            ],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response()->json([
            'message' => 'User updated',
            'user' => $user->only([
                'id',
                'name',
                'email',
                'phone',
                'role',
                'status',
            ]),
        ]);
    }

    public function bulkStatus(Request $request): JsonResponse
    {
        $data = $request->validate([
            'user_ids' => 'required|array|min:1',
            'user_ids.*' => 'required|integer|exists:users,id',
            'status' => 'required|in:active,disabled',
            'status_note' => 'nullable|string|max:1000',
        ]);

        $count = User::query()
            ->where('role', 'user')
            ->whereIn('id', $data['user_ids'])
            ->update(['status' => $data['status']]);

        $this->auditService->log([
            'actor' => $request->user(),
            'action' => 'admin.user.bulk-status',
            'metadata' => [
                'user_ids' => $data['user_ids'],
                'status' => $data['status'],
                'status_note' => $data['status_note'] ?? null,
                'updated' => $count,
            ],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response()->json([
            'message' => 'Users status updated',
            'updated' => $count,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'phone' => 'nullable|string|max:50|unique:users,phone',
            'password' => ['required', 'string', Password::defaults()],
        ]);

        $user = User::query()->create([
            'name' => $data['name'],
            'email' => $data['email'],
            'phone' => $data['phone'] ?? null,
            'password' => $data['password'],
            'role' => 'user',
            'status' => 'active',
        ]);

        $wallet = $this->walletService->getOrCreateWallet($user);

        $this->auditService->log([
            'actor' => $request->user(),
            'action' => 'admin.user.create',
            'subject_user_id' => $user->id,
            'subject_type' => User::class,
            'subject_id' => $user->id,
            'metadata' => [
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
            ],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response()->json([
            'message' => 'User created',
            'user' => $user->only(['id', 'name', 'email', 'phone', 'role', 'status']),
            'wallet' => $wallet->only(['id', 'balance']),
        ], 201);
    }

    public function resetPassword(Request $request, User $user): JsonResponse
    {
        abort_if($user->isAdmin(), 403, 'Use Admin Settings to manage the administrator account.');

        $data = $request->validate([
            'password' => ['required', 'string', Password::defaults()],
            'notes' => 'nullable|string|max:1000',
        ]);

        $user->update([
            'password' => $data['password'],
        ]);

        $this->auditService->log([
            'actor' => $request->user(),
            'action' => 'admin.user.reset-password',
            'subject_user_id' => $user->id,
            'subject_type' => User::class,
            'subject_id' => $user->id,
            'metadata' => ['notes' => $data['notes'] ?? null],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response()->json([
            'message' => 'Password reset',
            'user_id' => $user->id,
        ]);
    }

    public function adjustPoints(Request $request, User $user): JsonResponse
    {
        abort_if($user->isAdmin(), 422, 'Administrator accounts do not have point wallets.');

        $data = $request->validate([
            'amount' => 'required|integer|between:-1000000000,1000000000|not_in:0',
            'notes' => 'nullable|string|max:1000',
        ]);

        $amount = (int) $data['amount'];
        $notes = $data['notes'] ?? 'Manual admin adjustment';
        $wallet = $this->walletService->getOrCreateWallet($user);
        $transactionType = PointTransaction::TYPE_ADMIN_ADJUSTMENT;

        if ($amount >= 0) {
            $transaction = $this->walletService->credit($user, $amount, $transactionType, [
                'notes' => $notes,
            ]);
        } else {
            $transaction = $this->walletService->debit($user, abs($amount), $transactionType, [
                'notes' => $notes,
            ]);
        }

        $this->auditService->log([
            'actor' => $request->user(),
            'action' => 'admin.user.adjust-points',
            'subject_user_id' => $user->id,
            'subject_type' => PointTransaction::class,
            'subject_id' => $transaction->id,
            'metadata' => [
                'amount' => $amount,
                'notes' => $notes,
                'balance_after' => $transaction->balance_after,
            ],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response()->json([
            'message' => 'Wallet adjusted',
            'transaction' => $transaction->only(['id', 'amount', 'balance_after', 'type', 'notes', 'created_at']),
            'wallet' => $wallet->refresh()->only(['id', 'balance']),
        ]);
    }

    public function profile(Request $request): JsonResponse
    {
        $admin = $request->user();

        return response()->json([
            'admin' => $admin->only(['id', 'name', 'email', 'phone', 'role', 'status', 'created_at']),
        ]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $admin = $request->user();
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email,'.$admin->id,
            'phone' => 'nullable|string|max:50|unique:users,phone,'.$admin->id,
        ]);

        $admin->update($data);

        $this->auditService->log([
            'actor' => $admin,
            'action' => 'admin.profile.update',
            'subject_user_id' => $admin->id,
            'subject_type' => User::class,
            'subject_id' => $admin->id,
            'metadata' => $data,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response()->json([
            'message' => 'Admin profile updated',
            'admin' => $admin->fresh()->only(['id', 'name', 'email', 'phone', 'role', 'status', 'created_at']),
        ]);
    }

    public function changePassword(Request $request): JsonResponse
    {
        $admin = $request->user();
        $data = $request->validate([
            'current_password' => 'required|string',
            'password' => ['required', 'string', 'confirmed', Password::defaults()],
        ]);

        if (! Hash::check($data['current_password'], $admin->password)) {
            throw ValidationException::withMessages([
                'current_password' => 'The current password is incorrect.',
            ]);
        }

        $admin->update(['password' => $data['password']]);

        $this->auditService->log([
            'actor' => $admin,
            'action' => 'admin.profile.password_change',
            'subject_user_id' => $admin->id,
            'subject_type' => User::class,
            'subject_id' => $admin->id,
            'metadata' => [],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response()->json(['message' => 'Admin password changed']);
    }
}
