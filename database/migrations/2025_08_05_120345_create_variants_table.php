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
        Schema::create('variants', function (Blueprint $table) {
            $table->id();
            $table->string('shopify_id')->unique(); // Shopify'dan gelen variant ID
            $table->foreignId('product_id')->constrained()->onDelete('cascade');
            $table->string('title');
            $table->string('sku')->nullable();
            $table->string('barcode')->nullable();
            $table->decimal('price', 10, 2)->default(0);
            $table->decimal('compare_at_price', 10, 2)->nullable();
            $table->integer('position')->default(1);
            $table->string('option1')->nullable(); // Size, Color, etc.
            $table->string('option2')->nullable();
            $table->string('option3')->nullable();
            $table->integer('inventory_quantity')->default(0);
            $table->string('inventory_management')->nullable(); // shopify, manual, etc.
            $table->string('inventory_policy')->nullable(); // deny, continue
            $table->boolean('taxable')->default(true);
            $table->decimal('weight', 8, 2)->nullable();
            $table->string('weight_unit')->nullable(); // kg, lb, oz, g
            $table->boolean('requires_shipping')->default(true);
            $table->timestamps();
            
            // Indexes
            $table->index('shopify_id');
            $table->index('product_id');
            $table->index('sku');
            $table->index('position');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('variants');
    }
};
