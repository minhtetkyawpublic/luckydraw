<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Announcement extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'body',
        'version',
        'published_at',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'version' => 'integer',
            'published_at' => 'datetime',
        ];
    }

    public function editor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public static function current(): self
    {
        return self::query()->firstOrCreate(['id' => 1], [
            'version' => 0,
        ]);
    }

    public function isPublished(): bool
    {
        return $this->version > 0
            && $this->published_at !== null
            && filled($this->title)
            && filled($this->body);
    }
}
