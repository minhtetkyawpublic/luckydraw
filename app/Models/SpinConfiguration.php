<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SpinConfiguration extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'center_label',
        'is_active',
        'cost_points',
        'cooldown_seconds',
        'starts_at',
        'ends_at',
        'metadata',
        'notes',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'cost_points' => 'integer',
        'cooldown_seconds' => 'integer',
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function segments(): HasMany
    {
        return $this->hasMany(SpinSegment::class);
    }

    public function events(): HasMany
    {
        return $this->hasMany(SpinEvent::class);
    }
}
