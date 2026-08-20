<?php

namespace App\Http\Controllers;

use App\Models\SpinConfiguration;
use App\Models\SpinSegment;
use App\Services\AdminAuditService;
use App\Services\SpinEligibilityService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SpinConfigurationController extends Controller
{
    public function __construct(
        private readonly AdminAuditService $auditService,
        private readonly SpinEligibilityService $spinEligibilityService,
    ) {}

    public function show(): JsonResponse
    {
        return response()->json([
            'configuration' => $this->loadEditableConfiguration($this->singleConfiguration()),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $configuration = $this->singleConfiguration();
        $data = $request->validate([
            'cost_points' => 'required|integer|min:0|max:1000000000',
            'segments' => 'required|array|min:2|max:24',
            'segments.*.id' => 'nullable|integer|distinct',
            'segments.*.points_reward' => 'required|integer|min:0|max:1000000000',
            'segments.*.weight' => 'required|integer|min:1|max:1000000',
        ]);

        DB::transaction(function () use ($data, $configuration): void {
            SpinConfiguration::query()->where('id', '!=', $configuration->id)->update(['is_active' => false]);
            $configuration->update([
                'name' => 'Lucky Draw Wheel',
                'center_label' => 'LUCKY',
                'cost_points' => $data['cost_points'],
                'cooldown_seconds' => 0,
                'is_active' => true,
                'starts_at' => null,
                'ends_at' => null,
            ]);

            $activeSegmentIds = [];
            $palette = ['#ffca28', '#ff7a00', '#7c3aed', '#ec4899', '#22c55e', '#0ea5e9', '#e11d48', '#14b8a6'];

            foreach ($data['segments'] as $index => $segmentData) {
                $segment = null;
                if (! empty($segmentData['id'])) {
                    $segment = SpinSegment::query()
                        ->where('spin_configuration_id', $configuration->id)
                        ->whereKey($segmentData['id'])
                        ->first();

                    if (! $segment) {
                        throw ValidationException::withMessages([
                            "segments.{$index}.id" => 'The selected slice does not belong to this wheel.',
                        ]);
                    }
                }

                $values = [
                    'label' => 'Slice '.($index + 1),
                    'color' => $segment?->color ?: $palette[$index % count($palette)],
                    'text_color' => $segment?->text_color ?: '#ffffff',
                    'is_active' => true,
                    'points_reward' => $segmentData['points_reward'],
                    'weight' => $segmentData['weight'],
                    'max_win_per_day' => null,
                ];

                if ($segment) {
                    $segment->update($values);
                } else {
                    $segment = $configuration->segments()->create($values);
                }
                $activeSegmentIds[] = $segment->id;
            }

            $configuration->segments()
                ->whereNotIn('id', $activeSegmentIds)
                ->update(['is_active' => false]);

            $this->spinEligibilityService->assertValidConfigurationSegments($configuration->id);
        });

        $this->auditService->log([
            'actor' => $request->user(),
            'action' => 'admin.spin-config.update',
            'subject_type' => SpinConfiguration::class,
            'subject_id' => $configuration->id,
            'metadata' => [
                'cost_points' => $data['cost_points'],
                'slice_count' => count($data['segments']),
                'segments' => $data['segments'],
            ],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response()->json([
            'message' => 'Wheel settings updated',
            'configuration' => $this->loadEditableConfiguration($configuration->fresh()),
        ]);
    }

    private function singleConfiguration(): SpinConfiguration
    {
        $configuration = SpinConfiguration::query()
            ->where('is_active', true)
            ->oldest('id')
            ->first()
            ?? SpinConfiguration::query()->oldest('id')->first();

        if (! $configuration) {
            $configuration = SpinConfiguration::query()->create([
                'name' => 'Lucky Draw Wheel',
                'center_label' => 'LUCKY',
                'cost_points' => 10,
                'cooldown_seconds' => 0,
                'is_active' => true,
            ]);

            foreach ([5, 10, 20, 50] as $index => $points) {
                $configuration->segments()->create([
                    'label' => 'Slice '.($index + 1),
                    'color' => ['#ffca28', '#ff7a00', '#7c3aed', '#22c55e'][$index],
                    'text_color' => '#ffffff',
                    'is_active' => true,
                    'points_reward' => $points,
                    'weight' => [45, 30, 20, 5][$index],
                ]);
            }
        }

        SpinConfiguration::query()->where('id', '!=', $configuration->id)->update(['is_active' => false]);
        if (! $configuration->is_active || $configuration->cooldown_seconds !== 0) {
            $configuration->update(['is_active' => true, 'cooldown_seconds' => 0]);
        }

        return $configuration;
    }

    private function loadEditableConfiguration(SpinConfiguration $configuration): SpinConfiguration
    {
        return $configuration->load([
            'segments' => fn ($query) => $query->where('is_active', true)->orderBy('id'),
        ]);
    }
}
