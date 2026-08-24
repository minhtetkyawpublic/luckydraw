<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DailyPointClaim extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'claim_date',
        'points_awarded',
        'wallet_transaction_id',
    ];

    protected function casts(): array
    {
        return [
            'claim_date' => 'date',
            'points_awarded' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(PointTransaction::class, 'wallet_transaction_id');
    }
}
