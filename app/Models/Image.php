<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Image extends Model
{
    protected $fillable = [
        'shopify_id',
        'product_id',
        'variant_id',
        'src',
        'position',
        'width',
        'height',
        'alt',
    ];

    protected $casts = [
        'position' => 'integer',
        'width' => 'integer',
        'height' => 'integer',
    ];

    /**
     * Get the product that owns the image.
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /**
     * Get the variant that owns the image.
     */
    public function variant(): BelongsTo
    {
        return $this->belongsTo(Variant::class);
    }
}
