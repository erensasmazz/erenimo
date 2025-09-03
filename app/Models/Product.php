<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    protected $fillable = [
        'shopify_id',
        'title',
        'handle',
        'description',
        'vendor',
        'product_type',
        'status',
        'tags',
        'template_suffix',
        'published',
        'published_at',
        'metafields_global_title_tag',
        'metafields_global_description_tag',
    ];

    protected $casts = [
        'published' => 'boolean',
        'published_at' => 'datetime',
    ];

    /**
     * Get the variants for the product.
     */
    public function variants(): HasMany
    {
        return $this->hasMany(Variant::class);
    }

    /**
     * Get the images for the product.
     */
    public function images(): HasMany
    {
        return $this->hasMany(Image::class);
    }
}
