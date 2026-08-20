<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SpinEvent extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'spin_configuration_id',
        'spin_segment_id',
        'points_spent',
        'points_awarded',
        'is_free_spin',
        'result_payload',
        'random_seed',
        'algorithm_version',
        'status',
    ];

    protected $casts = [
        'points_spent' => 'integer',
        'points_awarded' => 'integer',
        'is_free_spin' => 'boolean',
        'result_payload' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function configuration(): BelongsTo
    {
        return $this->belongsTo(SpinConfiguration::class, 'spin_configuration_id');
    }

    public function segment(): BelongsTo
    {
        return $this->belongsTo(SpinSegment::class, 'spin_segment_id');
    }
}
