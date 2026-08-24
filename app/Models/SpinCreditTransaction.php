<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SpinCreditTransaction extends Model
{
    public const TYPE_EXCHANGE = 'points_exchange';

    public const TYPE_WHEEL_REWARD = 'wheel_reward';

    public const TYPE_SPIN_SPEND = 'spin_spend';

    protected $fillable = ['spin_wallet_id', 'user_id', 'type', 'amount', 'balance_after', 'reference_type', 'reference_id', 'notes'];

    protected $casts = ['amount' => 'integer', 'balance_after' => 'integer'];

    public function wallet(): BelongsTo
    {
        return $this->belongsTo(SpinWallet::class, 'spin_wallet_id');
    }
}
