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
                Log::error('Shopify session not found, using test data');
                
                // Create test data if no session
                $this->createTestData();
                return;
            }

            // Fetch products from Shopify
            $products = $this->fetchProductsFromShopify($shop, $accessToken);
            
            foreach ($products as $productData) {
                $this->syncProduct($productData);
            }

            Log::info('Shopify products successfully synchronized', [
                'count' => count($products)
            ]);

        } catch (\Exception $e) {
            Log::error('Shopify product synchronization error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            // Create test data even in case of error
            $this->createTestData();
        }
    }

    /**
     * Fetch products from Shopify
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
            throw new \Exception('Shopify API error: ' . $response->status());
        }

        $data = $response->json();
        return $data['data']['products']['edges'] ?? [];
    }

    /**
     * Synchronize product and related data
     */
    private function syncProduct(array $productEdge): void
    {
        $node = $productEdge['node'];
        
        // Process metafields
        $metafields = collect($node['metafields']['edges'] ?? [])
            ->pluck('node')
            ->keyBy('key')
            ->toArray();

        // Create/update product
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

        // Synchronize variants
        $this->syncVariants($product, $node['variants']['edges'] ?? []);

        // Synchronize images
        $this->syncImages($product, $node['images']['edges'] ?? []);
    }

    /**
     * Synchronize variants
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
     * Synchronize images
     */
    private function syncImages(Product $product, array $imageEdges): void
    {
        foreach ($imageEdges as $imageEdge) {
            $node = $imageEdge['node'];
            
            Image::updateOrCreate(
                ['shopify_id' => $node['id']],
                [
                    'product_id' => $product->id,
                    'variant_id' => null, // Currently null, can be linked to variant later
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
     * Create test data
     */
    private function createTestData(): void
    {
        $products = [
            [
                'title' => 'Premium Cotton T-Shirt',
                'handle' => 'premium-cotton-tshirt',
                'description' => 'Comfortable and durable t-shirt made from high-quality cotton',
                'vendor' => 'Fashion Store',
                'product_type' => 'T-Shirt',
                'status' => 'ACTIVE',
                'tags' => 'cotton, comfortable, premium',
                'price' => 89.99,
                'image' => 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop'
            ],
            [
                'title' => 'Vintage Denim Jacket',
                'handle' => 'vintage-denim-jacket',
                'description' => 'Classic vintage style denim jacket, compatible with every combination',
                'vendor' => 'Retro Fashion',
                'product_type' => 'Jacket',
                'status' => 'ACTIVE',
                'tags' => 'vintage, denim, classic',
                'price' => 299.99,
                'image' => 'https://images.unsplash.com/photo-1544022613-e87ca75a784a?w=400&h=400&fit=crop'
            ],
            [
                'title' => 'Leather Crossbody Bag',
                'handle' => 'leather-crossbody-bag',
                'description' => 'Stylish crossbody bag made from genuine leather material',
                'vendor' => 'Luxury Bags',
                'product_type' => 'Bag',
                'status' => 'ACTIVE',
                'tags' => 'leather, stylish, crossbody',
                'price' => 199.99,
                'image' => 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&h=400&fit=crop'
            ],
            [
                'title' => 'Wireless Bluetooth Headphones',
                'handle' => 'wireless-bluetooth-headphones',
                'description' => 'Wireless headphones with high sound quality and long battery life',
                'vendor' => 'Tech Gadgets',
                'product_type' => 'Electronics',
                'status' => 'ACTIVE',
                'tags' => 'bluetooth, wireless, sound',
                'price' => 399.99,
                'image' => 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop'
            ],
            [
                'title' => 'Organic Coffee Beans',
                'handle' => 'organic-coffee-beans',
                'description' => 'Premium coffee beans collected from organic farms',
                'vendor' => 'Coffee Masters',
                'product_type' => 'Coffee',
                'status' => 'ACTIVE',
                'tags' => 'organic, coffee, premium',
                'price' => 79.99,
                'image' => 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400&h=400&fit=crop'
            ],
            [
                'title' => 'Smart Fitness Watch',
                'handle' => 'smart-fitness-watch',
                'description' => 'Smart watch with health tracking and fitness features',
                'vendor' => 'Health Tech',
                'product_type' => 'Watch',
                'status' => 'ACTIVE',
                'tags' => 'fitness, smart, health',
                'price' => 599.99,
                'image' => 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop'
            ],
            [
                'title' => 'Handmade Ceramic Mug',
                'handle' => 'handmade-ceramic-mug',
                'description' => 'Handmade ceramic mug, unique design',
                'vendor' => 'Artisan Crafts',
                'product_type' => 'Home Goods',
                'status' => 'ACTIVE',
                'tags' => 'handmade, ceramic, unique',
                'price' => 45.99,
                'image' => 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400&h=400&fit=crop'
            ],
            [
                'title' => 'Natural Face Cream',
                'handle' => 'natural-face-cream',
                'description' => 'Moisturizing face cream made with natural ingredients',
                'vendor' => 'Natural Beauty',
                'product_type' => 'Cosmetics',
                'status' => 'ACTIVE',
                'tags' => 'natural, moisturizing, cosmetics',
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

            // Create variant
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

            // Create image
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

        Log::info('Test data created', ['count' => count($products)]);
    }
}
