<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SpinSegment extends Model
{
    use HasFactory;

    protected $fillable = [
        'spin_configuration_id',
        'label',
        'color',
        'text_color',
        'is_active',
        'points_reward',
        'weight',
        'max_win_per_day',
    ];

    protected $casts = [
        'points_reward' => 'integer',
        'weight' => 'integer',
        'max_win_per_day' => 'integer',
        'is_active' => 'boolean',
    ];

    public function configuration(): BelongsTo
    {
        return $this->belongsTo(SpinConfiguration::class, 'spin_configuration_id');
    }
}
