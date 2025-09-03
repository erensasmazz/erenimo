<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Variant extends Model
{
    protected $fillable = [
        'shopify_id',
        'product_id',
        'title',
        'sku',
        'barcode',
        'price',
        'compare_at_price',
        'position',
        'option1',
        'option2',
        'option3',
        'inventory_quantity',
        'inventory_management',
        'inventory_policy',
        'taxable',
        'weight',
        'weight_unit',
        'requires_shipping',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'compare_at_price' => 'decimal:2',
        'inventory_quantity' => 'integer',
        'taxable' => 'boolean',
        'weight' => 'decimal:2',
        'requires_shipping' => 'boolean',
    ];

    /**
     * Get the product that owns the variant.
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /**
     * Get the images for the variant.
     */
    public function images(): HasMany
    {
        return $this->hasMany(Image::class);
    }
}
