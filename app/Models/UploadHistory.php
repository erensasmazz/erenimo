<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UploadHistory extends Model
{
    protected $table = 'upload_history';
    
    protected $fillable = [
        'file_name',
        'sku',
        'product_title',
        'product_id',
        'success',
        'error',
        'position',
        'operation_type',
        'google_drive_file_id'
    ];

    protected $casts = [
        'success' => 'boolean',
        'position' => 'integer',
    ];

    /**
     * Get the formatted created date
     */
    public function getFormattedDateAttribute()
    {
        return $this->created_at->format('d.m.Y H:i:s');
    }

    /**
     * Get the status badge
     */
    public function getStatusBadgeAttribute()
    {
        return $this->success ? 'success' : 'critical';
    }
}
