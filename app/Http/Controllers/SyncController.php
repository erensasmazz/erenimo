<?php

namespace App\Http\Controllers;

use App\Jobs\SyncShopifyProducts;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

class SyncController extends Controller
{
    /**
     * Manuel olarak senkronizasyonu başlat
     */
    public function syncProducts(Request $request): JsonResponse
    {
        try {
            // Job'ı dispatch et
            SyncShopifyProducts::dispatch();
            
            Log::info('Manuel senkronizasyon başlatıldı');
            
            return response()->json([
                'success' => true,
                'message' => 'Senkronizasyon başlatıldı. Job arka planda çalışıyor.'
            ]);
            
        } catch (\Exception $e) {
            Log::error('Manuel senkronizasyon hatası', [
                'error' => $e->getMessage()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Senkronizasyon başlatılırken hata oluştu: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Senkronizasyon durumunu kontrol et
     */
    public function syncStatus(Request $request): JsonResponse
    {
        try {
            // Son senkronizasyon zamanını kontrol et
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
            Log::error('Senkronizasyon durumu kontrol hatası', [
                'error' => $e->getMessage()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Durum kontrol edilirken hata oluştu'
            ], 500);
        }
    }

    /**
     * Database'den ürünleri getir
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
