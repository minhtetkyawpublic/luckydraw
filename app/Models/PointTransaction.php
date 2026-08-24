<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PointTransaction extends Model
{
    use HasFactory;

    public const TYPE_DAILY_BONUS = 'daily_bonus';

    public const TYPE_FREE_SPIN_REWARD = 'free_spin_reward';

    public const TYPE_PAID_SPIN_REWARD = 'paid_spin_reward';

    public const TYPE_SPIN_SPEND = 'spin_spend';

    public const TYPE_ADMIN_ADJUSTMENT = 'admin_adjustment';

    public const TYPE_SPIN_EXCHANGE = 'spin_exchange';

    protected $fillable = [
        'wallet_id',
        'user_id',
        'type',
        'amount',
        'balance_after',
        'status',
        'reference_type',
        'reference_id',
        'notes',
    ];

    public function wallet(): BelongsTo
    {
        return $this->belongsTo(PointsWallet::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
