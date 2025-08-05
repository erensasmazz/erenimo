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
        Schema::create('images', function (Blueprint $table) {
            $table->id();
            $table->string('shopify_id')->unique(); // Shopify'dan gelen image ID
            $table->foreignId('product_id')->constrained()->onDelete('cascade');
            $table->foreignId('variant_id')->nullable()->constrained()->onDelete('cascade');
            $table->string('src'); // Image URL
            $table->integer('position')->default(1);
            $table->integer('width')->nullable();
            $table->integer('height')->nullable();
            $table->string('alt')->nullable(); // Alt text
            $table->timestamps();
            
            // Indexes
            $table->index('shopify_id');
            $table->index('product_id');
            $table->index('variant_id');
            $table->index('position');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('images');
    }
};
