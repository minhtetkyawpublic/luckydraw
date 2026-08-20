<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class RequestIdempotencyKey extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'scope',
        'idempotency_key',
        'request_hash',
        'response_status',
        'response_payload',
        'completed_at',
    ];

    protected $casts = [
        'response_payload' => 'array',
        'completed_at' => 'datetime',
    ];
}
