<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('upload_history', function (Blueprint $table) {
            $table->id();
            $table->string('file_name');
            $table->string('sku')->nullable();
            $table->string('product_title')->nullable();
            $table->string('product_id');
            $table->boolean('success')->default(false);
            $table->text('error')->nullable();
            $table->integer('position')->default(1);
            $table->string('operation_type')->default('upload'); // upload, cleanup
            $table->string('google_drive_file_id')->nullable();
            $table->timestamps();
            
            // Indexes
            $table->index('sku');
            $table->index('product_id');
            $table->index('success');
            $table->index('created_at');
            $table->index('operation_type');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('upload_history');
    }
};
