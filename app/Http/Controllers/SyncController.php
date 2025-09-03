<?php

namespace App\Http\Controllers;

use App\Jobs\SyncShopifyProducts;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

class SyncController extends Controller
{
    /**
     * Manually start synchronization
     */
    public function syncProducts(Request $request): JsonResponse
    {
        try {
            // Dispatch the job
            SyncShopifyProducts::dispatch();
            
            Log::info('Manual synchronization started');
            
            return response()->json([
                'success' => true,
                'message' => 'Synchronization started. Job is running in background.'
            ]);
            
        } catch (\Exception $e) {
            Log::error('Manual synchronization error', [
                'error' => $e->getMessage()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Error occurred while starting synchronization: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Check synchronization status
     */
    public function syncStatus(Request $request): JsonResponse
    {
        try {
            // Check last synchronization time
            $lastSync = \App\Models\Product::latest('updated_at')->first();
            
            $status = [
                'last_sync' => $lastSync ? $lastSync->updated_at : null,
                'total_products' => \App\Models\Product::count(),
                'total_variants' => \App\Models\Variant::count(),
                'total_images' => \App\Models\Image::count(),
            ];
            
            return response()->json([
                'success' => true,
                'data' => $status
            ]);
            
        } catch (\Exception $e) {
            Log::error('Synchronization status check error', [
                'error' => $e->getMessage()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Error occurred while checking status'
            ], 500);
        }
    }

    /**
     * Get products from database
     */
    public function getProducts(Request $request): JsonResponse
    {
        try {
            $products = \App\Models\Product::with(['variants', 'images'])->get();
            
            $formattedProducts = $products->map(function ($product) {
                return [
                    'id' => $product->id,
                    'title' => $product->title,
                    'handle' => $product->handle,
                    'status' => $product->status,
                    'vendor' => $product->vendor,
                    'productType' => $product->product_type,
                    'createdAt' => $product->created_at->toISOString(),
                    'updatedAt' => $product->updated_at->toISOString(),
                    'description' => $product->description,
                    'tags' => $product->tags,
                    'images' => $product->images->map(function ($image) {
                        return [
                            'id' => $image->id,
                            'src' => $image->src,
                            'alt' => $image->alt,
                        ];
                    }),
                    'variants' => $product->variants->map(function ($variant) {
                        return [
                            'id' => $variant->id,
                            'price' => $variant->price,
                            'sku' => $variant->sku,
                            'inventory_quantity' => $variant->inventory_quantity,
                        ];
                    }),
                ];
            });
            
            return response()->json([
                'success' => true,
                'products' => $formattedProducts
            ]);
            
        } catch (\Exception $e) {
            Log::error('Database ürünleri getirme hatası', [
                'error' => $e->getMessage()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Ürünler getirilirken hata oluştu'
            ], 500);
        }
    }
}
