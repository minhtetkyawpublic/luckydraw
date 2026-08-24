<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SpinExchangePackage extends Model
{
    protected $fillable = ['points_cost', 'spins_amount', 'sort_order', 'is_active'];

    protected $casts = ['points_cost' => 'integer', 'spins_amount' => 'integer', 'sort_order' => 'integer', 'is_active' => 'boolean'];
}
