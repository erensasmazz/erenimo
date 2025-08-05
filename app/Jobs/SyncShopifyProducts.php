<?php

namespace App\Jobs;

use App\Models\Product;
use App\Models\Variant;
use App\Models\Image;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SyncShopifyProducts implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Create a new job instance.
     */
    public function __construct()
    {
        //
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        try {
            $shop = session('shopify_domain');
            $accessToken = session('shopify_access_token');

            if (!$shop || !$accessToken) {
                Log::error('Shopify session bulunamadı, test verisi kullanılıyor');
                
                // Session yoksa test verisi oluştur
                $this->createTestData();
                return;
            }

            // Shopify'dan ürünleri çek
            $products = $this->fetchProductsFromShopify($shop, $accessToken);
            
            foreach ($products as $productData) {
                $this->syncProduct($productData);
            }

            Log::info('Shopify ürünleri başarıyla senkronize edildi', [
                'count' => count($products)
            ]);

        } catch (\Exception $e) {
            Log::error('Shopify ürün senkronizasyonu hatası', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            // Hata durumunda da test verisi oluştur
            $this->createTestData();
        }
    }

    /**
     * Shopify'dan ürünleri çek
     */
    private function fetchProductsFromShopify(string $shop, string $accessToken): array
    {
        $query = '
            query {
                products(first: 250) {
                    edges {
                        node {
                            id
                            title
                            handle
                            description
                            vendor
                            productType
                            status
                            tags
                            templateSuffix
                            published
                            publishedAt
                            metafields(global: true, first: 10) {
                                edges {
                                    node {
                                        key
                                        value
                                    }
                                }
                            }
                            variants(first: 250) {
                                edges {
                                    node {
                                        id
                                        title
                                        sku
                                        barcode
                                        price
                                        compareAtPrice
                                        position
                                        option1
                                        option2
                                        option3
                                        inventoryQuantity
                                        inventoryManagement
                                        inventoryPolicy
                                        taxable
                                        weight
                                        weightUnit
                                        requiresShipping
                                    }
                                }
                            }
                            images(first: 250) {
                                edges {
                                    node {
                                        id
                                        src
                                        position
                                        width
                                        height
                                        altText
                                    }
                                }
                            }
                        }
                    }
                }
            }
        ';

        $response = Http::withHeaders([
            'X-Shopify-Access-Token' => $accessToken,
            'Content-Type' => 'application/json',
        ])->post("https://{$shop}/admin/api/2023-10/graphql.json", [
            'query' => $query
        ]);

        if (!$response->successful()) {
            throw new \Exception('Shopify API hatası: ' . $response->status());
        }

        $data = $response->json();
        return $data['data']['products']['edges'] ?? [];
    }

    /**
     * Ürünü ve ilişkili verilerini senkronize et
     */
    private function syncProduct(array $productEdge): void
    {
        $node = $productEdge['node'];
        
        // Metafields'ları işle
        $metafields = collect($node['metafields']['edges'] ?? [])
            ->pluck('node')
            ->keyBy('key')
            ->toArray();

        // Ürünü oluştur/güncelle
        $product = Product::updateOrCreate(
            ['shopify_id' => $node['id']],
            [
                'title' => $node['title'],
                'handle' => $node['handle'],
                'description' => $node['description'] ?? '',
                'vendor' => $node['vendor'] ?? '',
                'product_type' => $node['productType'] ?? '',
                'status' => $node['status'],
                'tags' => $node['tags'] ?? '',
                'template_suffix' => $node['templateSuffix'] ?? '',
                'published' => $node['published'] ?? false,
                'published_at' => $node['publishedAt'] ?? null,
                'metafields_global_title_tag' => $metafields['title_tag']['value'] ?? null,
                'metafields_global_description_tag' => $metafields['description_tag']['value'] ?? null,
            ]
        );

        // Variant'ları senkronize et
        $this->syncVariants($product, $node['variants']['edges'] ?? []);

        // Image'ları senkronize et
        $this->syncImages($product, $node['images']['edges'] ?? []);
    }

    /**
     * Variant'ları senkronize et
     */
    private function syncVariants(Product $product, array $variantEdges): void
    {
        foreach ($variantEdges as $variantEdge) {
            $node = $variantEdge['node'];
            
            Variant::updateOrCreate(
                ['shopify_id' => $node['id']],
                [
                    'product_id' => $product->id,
                    'title' => $node['title'],
                    'sku' => $node['sku'] ?? '',
                    'barcode' => $node['barcode'] ?? '',
                    'price' => $node['price'] ?? 0,
                    'compare_at_price' => $node['compareAtPrice'] ?? null,
                    'position' => $node['position'] ?? 1,
                    'option1' => $node['option1'] ?? '',
                    'option2' => $node['option2'] ?? '',
                    'option3' => $node['option3'] ?? '',
                    'inventory_quantity' => $node['inventoryQuantity'] ?? 0,
                    'inventory_management' => $node['inventoryManagement'] ?? '',
                    'inventory_policy' => $node['inventoryPolicy'] ?? '',
                    'taxable' => $node['taxable'] ?? true,
                    'weight' => $node['weight'] ?? null,
                    'weight_unit' => $node['weightUnit'] ?? '',
                    'requires_shipping' => $node['requiresShipping'] ?? true,
                ]
            );
        }
    }

    /**
     * Image'ları senkronize et
     */
    private function syncImages(Product $product, array $imageEdges): void
    {
        foreach ($imageEdges as $imageEdge) {
            $node = $imageEdge['node'];
            
            Image::updateOrCreate(
                ['shopify_id' => $node['id']],
                [
                    'product_id' => $product->id,
                    'variant_id' => null, // Şimdilik null, daha sonra variant'a bağlanabilir
                    'src' => $node['src'],
                    'position' => $node['position'] ?? 1,
                    'width' => $node['width'] ?? null,
                    'height' => $node['height'] ?? null,
                    'alt' => $node['altText'] ?? '',
                ]
            );
        }
    }

    /**
     * Test verisi oluştur
     */
    private function createTestData(): void
    {
        $products = [
            [
                'title' => 'Premium Cotton T-Shirt',
                'handle' => 'premium-cotton-tshirt',
                'description' => 'Yüksek kaliteli pamuktan üretilen rahat ve dayanıklı t-shirt',
                'vendor' => 'Fashion Store',
                'product_type' => 'T-Shirt',
                'status' => 'ACTIVE',
                'tags' => 'pamuk, rahat, premium',
                'price' => 89.99,
                'image' => 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop'
            ],
            [
                'title' => 'Vintage Denim Jacket',
                'handle' => 'vintage-denim-jacket',
                'description' => 'Klasik vintage tarzında denim ceket, her kombinle uyumlu',
                'vendor' => 'Retro Fashion',
                'product_type' => 'Ceket',
                'status' => 'ACTIVE',
                'tags' => 'vintage, denim, klasik',
                'price' => 299.99,
                'image' => 'https://images.unsplash.com/photo-1544022613-e87ca75a784a?w=400&h=400&fit=crop'
            ],
            [
                'title' => 'Leather Crossbody Bag',
                'handle' => 'leather-crossbody-bag',
                'description' => 'Gerçek deri malzemeden üretilen şık crossbody çanta',
                'vendor' => 'Luxury Bags',
                'product_type' => 'Çanta',
                'status' => 'ACTIVE',
                'tags' => 'deri, şık, crossbody',
                'price' => 199.99,
                'image' => 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&h=400&fit=crop'
            ],
            [
                'title' => 'Wireless Bluetooth Headphones',
                'handle' => 'wireless-bluetooth-headphones',
                'description' => 'Yüksek ses kalitesi ve uzun pil ömrü ile kablosuz kulaklık',
                'vendor' => 'Tech Gadgets',
                'product_type' => 'Elektronik',
                'status' => 'ACTIVE',
                'tags' => 'bluetooth, kablosuz, ses',
                'price' => 399.99,
                'image' => 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop'
            ],
            [
                'title' => 'Organic Coffee Beans',
                'handle' => 'organic-coffee-beans',
                'description' => 'Organik çiftliklerden toplanan premium kahve çekirdekleri',
                'vendor' => 'Coffee Masters',
                'product_type' => 'Kahve',
                'status' => 'ACTIVE',
                'tags' => 'organik, kahve, premium',
                'price' => 79.99,
                'image' => 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400&h=400&fit=crop'
            ],
            [
                'title' => 'Smart Fitness Watch',
                'handle' => 'smart-fitness-watch',
                'description' => 'Sağlık takibi ve fitness özellikleri ile akıllı saat',
                'vendor' => 'Health Tech',
                'product_type' => 'Saat',
                'status' => 'ACTIVE',
                'tags' => 'fitness, akıllı, sağlık',
                'price' => 599.99,
                'image' => 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop'
            ],
            [
                'title' => 'Handmade Ceramic Mug',
                'handle' => 'handmade-ceramic-mug',
                'description' => 'El yapımı seramik bardak, benzersiz tasarım',
                'vendor' => 'Artisan Crafts',
                'product_type' => 'Ev Eşyası',
                'status' => 'ACTIVE',
                'tags' => 'el yapımı, seramik, benzersiz',
                'price' => 45.99,
                'image' => 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400&h=400&fit=crop'
            ],
            [
                'title' => 'Natural Face Cream',
                'handle' => 'natural-face-cream',
                'description' => 'Doğal içeriklerle üretilen nemlendirici yüz kremi',
                'vendor' => 'Natural Beauty',
                'product_type' => 'Kozmetik',
                'status' => 'ACTIVE',
                'tags' => 'doğal, nemlendirici, kozmetik',
                'price' => 129.99,
                'image' => 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400&h=400&fit=crop'
            ]
        ];

        foreach ($products as $index => $productData) {
            $product = Product::updateOrCreate(
                ['shopify_id' => 'test-product-' . ($index + 1)],
                [
                    'title' => $productData['title'],
                    'handle' => $productData['handle'],
                    'description' => $productData['description'],
                    'vendor' => $productData['vendor'],
                    'product_type' => $productData['product_type'],
                    'status' => $productData['status'],
                    'tags' => $productData['tags'],
                    'published' => true,
                ]
            );

            // Variant oluştur
            Variant::updateOrCreate(
                ['shopify_id' => 'test-variant-' . ($index + 1)],
                [
                    'product_id' => $product->id,
                    'title' => 'Default Title',
                    'sku' => 'SKU-' . str_pad(($index + 1), 3, '0', STR_PAD_LEFT),
                    'price' => $productData['price'],
                    'position' => 1,
                    'inventory_quantity' => rand(5, 50),
                    'inventory_management' => 'shopify',
                    'inventory_policy' => 'deny',
                    'taxable' => true,
                    'requires_shipping' => true,
                ]
            );

            // Image oluştur
            Image::updateOrCreate(
                ['shopify_id' => 'test-image-' . ($index + 1)],
                [
                    'product_id' => $product->id,
                    'src' => $productData['image'],
                    'position' => 1,
                    'width' => 400,
                    'height' => 400,
                    'alt' => $productData['title'],
                ]
            );
        }

        Log::info('Test verisi oluşturuldu', ['count' => count($products)]);
    }
}
