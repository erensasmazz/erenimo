<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ShopifyController extends Controller
{
    /**
     * Shopify mağazasından ürünleri getir
     */
    public function getProducts(Request $request): JsonResponse
    {
        try {
            // Shopify session'dan shop domain'ini al
            $shop = session('shopify_domain');
            
            if (!$shop) {
                return response()->json(['error' => 'Shopify mağazası bulunamadı'], 400);
            }

            // Shopify GraphQL query
            $query = '
                query {
                    products(first: 50) {
                        edges {
                            node {
                                id
                                title
                                handle
                                status
                                vendor
                                productType
                                createdAt
                                updatedAt
                            }
                        }
                    }
                }
            ';

            // Shopify Admin API'ye istek gönder
            $response = Http::withHeaders([
                'X-Shopify-Access-Token' => session('shopify_access_token'),
                'Content-Type' => 'application/json',
            ])->post("https://{$shop}/admin/api/2023-10/graphql.json", [
                'query' => $query
            ]);

            if ($response->successful()) {
                $data = $response->json();
                
                // GraphQL response'unu düzenle
                $products = collect($data['data']['products']['edges'] ?? [])
                    ->map(function ($edge) {
                        $node = $edge['node'];
                        return [
                            'id' => $node['id'],
                            'title' => $node['title'],
                            'handle' => $node['handle'],
                            'status' => $node['status'],
                            'vendor' => $node['vendor'] ?? '',
                            'productType' => $node['productType'] ?? '',
                            'createdAt' => $node['createdAt'],
                            'updatedAt' => $node['updatedAt'],
                        ];
                    })
                    ->toArray();

                return response()->json([
                    'products' => $products,
                    'success' => true
                ]);
            } else {
                Log::error('Shopify API hatası', [
                    'status' => $response->status(),
                    'response' => $response->body()
                ]);
                
                return response()->json([
                    'error' => 'Shopify API\'den ürünler alınamadı',
                    'products' => []
                ], 500);
            }

        } catch (\Exception $e) {
            Log::error('Ürünler getirilirken hata oluştu', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'error' => 'Ürünler yüklenirken bir hata oluştu',
                'products' => []
            ], 500);
        }
    }
} 