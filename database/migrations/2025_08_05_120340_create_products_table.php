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
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('shopify_id')->unique(); // Shopify'dan gelen ID
            $table->string('title');
            $table->string('handle')->unique();
            $table->text('description')->nullable();
            $table->string('vendor')->nullable();
            $table->string('product_type')->nullable();
            $table->string('status')->default('ACTIVE'); // ACTIVE, DRAFT, ARCHIVED
            $table->string('tags')->nullable();
            $table->string('template_suffix')->nullable();
            $table->boolean('published')->default(true);
            $table->timestamp('published_at')->nullable();
            $table->string('metafields_global_title_tag')->nullable();
            $table->text('metafields_global_description_tag')->nullable();
            $table->timestamps();
            
            // Indexes
            $table->index('shopify_id');
            $table->index('status');
            $table->index('vendor');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
