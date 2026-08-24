<?php

namespace App\Services;

use App\Models\RequestIdempotencyKey;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Throwable;

class IdempotencyService
{
    private const DEFAULT_TTL_SECONDS = 86400;

    private const PROCESSING_TIMEOUT_SECONDS = 300;

    private const CLEANUP_CACHE_KEY = 'luckydraw:idempotency:last-cleanup';

    public function handle(Request $request, string $scope, callable $callback): JsonResponse
    {
        $this->maybePurgeExpiredEntries();

        $idempotencyKey = $this->resolveIdempotencyKey($request);
        if (! $idempotencyKey) {
            return $this->normalizeResponse($callback());
        }

        $user = $request->user();
        $requestHash = $this->buildRequestHash($request);
        $scopeKey = "{$scope}";

        $existing = $this->findLatestEntry($user->id, $scopeKey, $idempotencyKey);
        if ($existing) {
            if ($existing->request_hash !== $requestHash) {
                return response()->json([
                    'message' => 'Idempotency key reuse with different request body is not allowed.',
                ], 422);
            }

            if ($existing->response_status === null) {
                if ($this->removeStaleProcessingEntry($existing)) {
                    return $this->handle($request, $scope, $callback);
                }

                return response()->json([
                    'message' => 'Idempotent request is still processing.',
                ], 409);
            }

            return response()->json(
                $existing->response_payload ?? [],
                (int) $existing->response_status,
            );
        }

        try {
            $entry = DB::transaction(function () use ($user, $scopeKey, $idempotencyKey, $requestHash) {
                return RequestIdempotencyKey::query()->create([
                    'user_id' => $user->id,
                    'scope' => $scopeKey,
                    'idempotency_key' => $idempotencyKey,
                    'request_hash' => $requestHash,
                ]);
            });
        } catch (QueryException $queryException) {
            $existing = $this->findLatestEntry($user->id, $scopeKey, $idempotencyKey);
            if ($existing) {
                if ($existing->response_status === null) {
                    return response()->json([
                        'message' => 'Idempotent request is still processing.',
                    ], 409);
                }

                return response()->json(
                    $existing->response_payload ?? [],
                    (int) $existing->response_status,
                );
            }

            throw $queryException;
        }

        try {
            $response = DB::transaction(function () use ($callback, $entry): JsonResponse {
                $response = $this->normalizeResponse($callback());

                $entry->update([
                    'response_status' => $response->getStatusCode(),
                    'response_payload' => $response->getData(true),
                    'completed_at' => now(),
                ]);

                return $response;
            });
        } catch (Throwable $exception) {
            try {
                $entry->delete();
            } catch (Throwable) {
                // A stale processing entry can be recovered after the timeout.
            }

            throw $exception;
        }

        return $response;
    }

    public function purgeExpiredEntries(): int
    {
        return RequestIdempotencyKey::query()
            ->where('created_at', '<', now()->subSeconds(self::DEFAULT_TTL_SECONDS))
            ->delete();
    }

    private function resolveIdempotencyKey(Request $request): ?string
    {
        $key = trim((string) $request->header('Idempotency-Key', ''));

        return $key === '' ? null : $key;
    }

    private function buildRequestHash(Request $request): string
    {
        $payload = $request->all();
        ksort($payload);

        return hash('sha256', json_encode([
            'method' => strtoupper($request->method()),
            'path' => $request->path(),
            'payload' => $payload,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION));
    }

    private function findLatestEntry(int $userId, string $scope, string $key): ?RequestIdempotencyKey
    {
        return RequestIdempotencyKey::query()
            ->where('user_id', $userId)
            ->where('scope', $scope)
            ->where('idempotency_key', $key)
            ->latest('id')
            ->first();
    }

    private function removeStaleProcessingEntry(RequestIdempotencyKey $entry): bool
    {
        if (! $entry->created_at || $entry->created_at->isAfter(now()->subSeconds(self::PROCESSING_TIMEOUT_SECONDS))) {
            return false;
        }

        return RequestIdempotencyKey::query()
            ->whereKey($entry->id)
            ->whereNull('response_status')
            ->where('created_at', '<=', now()->subSeconds(self::PROCESSING_TIMEOUT_SECONDS))
            ->delete() === 1;
    }

    private function maybePurgeExpiredEntries(): void
    {
        try {
            if (Cache::add(self::CLEANUP_CACHE_KEY, now()->timestamp, now()->addDay())) {
                $this->purgeExpiredEntries();
            }
        } catch (Throwable) {
            // Cleanup must never prevent a user from spinning.
        }
    }

    private function normalizeResponse(mixed $response): JsonResponse
    {
        if ($response instanceof JsonResponse) {
            return $response;
        }

        if (! is_array($response)) {
            return response()->json([
                'message' => 'Unexpected response contract.',
            ], 500);
        }

        $status = (int) ($response['status'] ?? 200);
        $data = $response['data'] ?? $response;

        return response()->json($data, $status);
    }
}
