<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Google_Client;
use Google_Service_Drive;

class ShopifyController extends Controller
{
    private $client;

    public function __construct()
    {
        $this->client = new Google_Client();
        $this->client->setClientId(config('services.google.client_id'));
        $this->client->setClientSecret(config('services.google.client_secret'));
        $this->client->setRedirectUri(config('services.google.redirect_uri'));
        $this->client->setScopes([
            'https://www.googleapis.com/auth/drive.readonly',
            'https://www.googleapis.com/auth/drive.file'
        ]);
    }

    /**
     * Create Shopify OAuth URL
     */
    public function getAuthUrl()
    {
        $shop = 'erenimo-test.myshopify.com';
        $clientId = config('services.shopify.client_id');
        $redirectUri = 'http://localhost:8000/auth/shopify/callback';
        $scope = 'read_products,write_products';
        
        $authUrl = "https://{$shop}/admin/oauth/authorize?" . http_build_query([
            'client_id' => $clientId,
            'scope' => $scope,
            'redirect_uri' => $redirectUri,
            'state' => csrf_token()
        ]);
        
        return response()->json([
            'success' => true,
            'auth_url' => $authUrl
        ]);
    }

    /**
     * Shopify OAuth callback
     */
    public function handleCallback(Request $request)
    {
        try {
            $code = $request->get('code');
            $shop = 'erenimo-test.myshopify.com';
            $clientId = config('services.shopify.client_id');
            $clientSecret = config('services.shopify.client_secret');
            $redirectUri = 'http://localhost:8000/auth/shopify/callback';
            
            // Add debug log
            Log::info('Shopify OAuth Callback Debug', [
                'code' => $code,
                'shop' => $shop,
                'client_id' => $clientId,
                'client_secret' => $clientSecret ? 'EXISTS' : 'NULL',
                'redirect_uri' => $redirectUri
            ]);
            
            // Get access token
            $response = Http::post("https://{$shop}/admin/oauth/access_token", [
                'client_id' => $clientId,
                'client_secret' => $clientSecret,
                'code' => $code,
                'redirect_uri' => $redirectUri
            ]);
            
            if ($response->successful()) {
                $data = $response->json();
                
                // Save to session
                session(['shop' => $shop]);
                session(['access_token' => $data['access_token']]);
                
                Log::info('Shopify OAuth Success', [
                    'shop' => $shop,
                    'access_token_exists' => !empty($data['access_token'])
                ]);
                
                return redirect('/google-drive');
            }
            
            return response()->json([
                'success' => false,
                'error' => 'Shopify OAuth error'
            ]);
            
        } catch (\Exception $e) {
            Log::error('Shopify OAuth Error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Shopify OAuth hatası'
            ]);
        }
    }

    /**
     * Get products from Shopify store
     */
    public function getProducts()
    {
        try {
            // Check Shopify session
            $shop = session('shop');
            $accessToken = session('access_token');
            
            // Add debug log
            Log::info('Shopify Session Debug', [
                'shop' => $shop,
                'access_token' => $accessToken ? 'EXISTS' : 'NULL',
                'all_session_keys' => array_keys(session()->all())
            ]);
            
            // If no session, create manual session for testing
            if (!$shop || !$accessToken) {
                Log::info('Shopify session not found, creating test session');
                
                // Create test session
                session(['shop' => 'erenimo-test.myshopify.com']);
                session(['access_token' => env('SHOPIFY_ACCESS_TOKEN')]);
                
                $shop = session('shop');
                $accessToken = session('access_token');
                
                Log::info('Test session created', [
                    'shop' => $shop,
                    'access_token_exists' => !empty($accessToken),
                    'access_token' => $accessToken ? 'EXISTS' : 'NULL'
                ]);
            }

            // GraphQL query - tüm ürün bilgilerini alalım
            $query = 'query { 
                products(first: 50) { 
                    edges { 
                        node { 
                            id 
                            title 
                            handle 
                            description
                            vendor
                            productType
                            status
                            variants(first: 10) {
                                edges {
                                    node {
                                        id
                                        sku
                                        title
                                        price
                                    }
                                }
                            }
                            images(first: 1) {
                                edges {
                                    node {
                                        url
                                    }
                                }
                            }
                        } 
                    } 
                } 
            }';

            try {
                $response = $this->shopifyGraphQL($query);

                if (isset($response['data']['products']['edges'])) {
                    $products = collect($response['data']['products']['edges'])->map(function ($edge) {
                        $product = $edge['node'];
                        
                        // SKU'ları variants'tan al
                        $skus = collect($product['variants']['edges'])->map(function ($variantEdge) {
                            return $variantEdge['node']['sku'];
                        })->filter()->toArray();
                        
                        return [
                            'id' => $product['id'],
                            'title' => $product['title'],
                            'vendor' => $product['vendor'] ?? 'Unknown',
                            'productType' => $product['productType'] ?? 'Unknown',
                            'status' => $product['status'] ?? 'ACTIVE',
                            'handle' => $product['handle'],
                            'description' => $product['description'],
                            'sku' => !empty($skus) ? $skus[0] : null, // İlk SKU'yu al
                            'skus' => $skus, // Tüm SKU'ları da sakla
                            'image' => $product['images']['edges'][0]['node']['url'] ?? null
                        ];
                    })->toArray();

                    Log::info('Shopify products successfully retrieved', [
                        'count' => count($products),
                        'products_with_sku' => collect($products)->filter(function($p) { return !empty($p['sku']); })->map(function($p) { return $p['title'] . ' (SKU: ' . $p['sku'] . ')'; })->toArray()
                    ]);

                    return response()->json([
                        'success' => true,
                        'products' => $products
                    ]);
                }
            } catch (\Exception $e) {
                Log::warning('Shopify API failed, using test data: ' . $e->getMessage());
            }

            // Return test data if API fails
            $testProducts = [
                [
                    'id' => 'gid://shopify/Product/1',
                    'title' => 'Test Product 1',
                    'vendor' => 'Test Vendor',
                    'productType' => 'T-Shirt',
                    'status' => 'ACTIVE',
                    'handle' => 'test-product-1',
                    'description' => 'Test product description 1',
                    'sku' => 'TEST-001',
                    'skus' => ['TEST-001'],
                    'image' => null
                ],
                [
                    'id' => 'gid://shopify/Product/2',
                    'title' => 'Test Product 2',
                    'vendor' => 'Test Vendor',
                    'productType' => 'Hoodie',
                    'status' => 'ACTIVE',
                    'handle' => 'test-product-2',
                    'description' => 'Test product description 2',
                    'image' => null
                ]
            ];

            Log::info('Returning test data', [
                'count' => count($testProducts),
                'products' => array_map(function($p) { return $p['title']; }, $testProducts)
            ]);

            return response()->json([
                'success' => true,
                'products' => $testProducts
            ]);

        } catch (\Exception $e) {
            Log::error('Shopify Products Error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Shopify connection error: ' . $e->getMessage(),
                'products' => []
            ]);
        }
    }

    /**
     * Upload image to Shopify
     */
    public function uploadImage(Request $request)
    {
        try {
            $productId = $request->input('product_id');
            $imageUrl = $request->input('image_url');
            $imageName = $request->input('image_name');

            // Shopify GraphQL mutation
            $mutation = '
                mutation productImageCreate($input: ProductImageInput!) {
                    productImageCreate(input: $input) {
                        image {
                            id
                            url
                            altText
                        }
                        userErrors {
                            field
                            message
                        }
                    }
                }
            ';

            $variables = [
                'input' => [
                    'productId' => $productId,
                    'src' => $imageUrl,
                    'altText' => $imageName
                ]
            ];

            $response = $this->shopifyGraphQL($mutation, $variables);

            if (isset($response['data']['productImageCreate']['userErrors']) && 
                !empty($response['data']['productImageCreate']['userErrors'])) {
                return response()->json([
                    'success' => false,
                    'error' => $response['data']['productImageCreate']['userErrors'][0]['message']
                ], 400);
            }

            return response()->json([
                'success' => true,
                'image' => $response['data']['productImageCreate']['image']
            ]);

        } catch (\Exception $e) {
            Log::error('Shopify Image Upload Error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Image upload failed'
            ], 500);
        }
    }

    /**
     * Google Drive'dan görsel indir ve Shopify'a yükle
     */
    public function uploadFromGoogleDrive(Request $request)
    {
        try {
            // Session ID'yi header'dan al ve session'ı restore et
            $sessionId = $request->header('X-Session-ID');
            if ($sessionId) {
                session()->setId($sessionId);
                session()->start();
                Log::info('Session restored from header for upload', ['session_id' => $sessionId]);
            }

            $productId = $request->input('product_id');
            $googleDriveFileId = $request->input('google_drive_file_id');
            $fileName = $request->input('file_name');
            $imagePosition = $request->input('image_position', 1); // Görsel pozisyonu

            // Check and restore Shopify session if missing
            $shop = session('shop');
            $accessToken = session('access_token');
            
            if (!$shop || !$accessToken) {
                Log::info('Shopify session missing in upload, restoring test session');
                
                // Restore test session
                session(['shop' => 'erenimo-test.myshopify.com']);
                session(['access_token' => env('SHOPIFY_ACCESS_TOKEN')]);
                
                $shop = session('shop');
                $accessToken = session('access_token');
                
                Log::info('Test session restored for upload', [
                    'shop' => $shop,
                    'access_token_exists' => !empty($accessToken)
                ]);
            }

            // Debug log ekle
            Log::info('Upload from Google Drive Debug', [
                'product_id' => $productId,
                'google_drive_file_id' => $googleDriveFileId,
                'file_name' => $fileName,
                'image_position' => $imagePosition,
                'session_keys' => array_keys(session()->all()),
                'google_access_token' => session('google_access_token') ? 'EXISTS' : 'NULL',
                'shop' => session('shop'),
                'access_token' => session('access_token') ? 'EXISTS' : 'NULL'
            ]);

            // Google Drive'dan dosyayı indir
            $accessToken = session('google_access_token');
            
            if (!$accessToken) {
                return response()->json([
                    'success' => false,
                    'error' => 'Google Drive connection required'
                ], 401);
            }

            $this->client->setAccessToken($accessToken);
            $service = new \Google_Service_Drive($this->client);
            
            // Debug: File ID'yi kontrol et
            Log::info('Google Drive File Debug', [
                'file_id' => $googleDriveFileId,
                'access_token_exists' => !empty($accessToken)
            ]);
            
            try {
                Log::info('Google Drive: File get işlemi başlıyor', ['file_id' => $googleDriveFileId]);
                $file = $service->files->get($googleDriveFileId);
                Log::info('Google Drive: File get başarılı', ['file_name' => $file->getName()]);
                
                Log::info('Google Drive: Content get işlemi başlıyor', ['file_id' => $googleDriveFileId]);
                $content = $service->files->get($googleDriveFileId, ['alt' => 'media']);
                $fileContent = $content->getBody()->getContents();
                Log::info('Google Drive: Content get başarılı', ['content_size' => strlen($fileContent)]);
            } catch (\Exception $e) {
                Log::error('Google Drive File Error: ' . $e->getMessage(), [
                    'file_id' => $googleDriveFileId,
                    'error_code' => $e->getCode(),
                    'error_trace' => $e->getTraceAsString()
                ]);
                return response()->json([
                    'success' => false,
                    'error' => 'Google Drive file not found: ' . $e->getMessage()
                ], 400);
            }

            // Dosyayı geçici olarak kaydet
            $tempPath = storage_path('app/temp/' . $fileName);
            
            Log::info('Google Drive: File content debug', [
                'content_size' => strlen($fileContent),
                'content_empty' => empty($fileContent),
                'content_substr' => substr($fileContent, 0, 100)
            ]);
            
            $bytesWritten = file_put_contents($tempPath, $fileContent);
            
            Log::info('Google Drive: Dosya geçici olarak kaydedildi', [
                'temp_path' => $tempPath,
                'file_size' => strlen($fileContent),
                'bytes_written' => $bytesWritten,
                'file_exists' => file_exists($tempPath),
                'actual_file_size' => file_exists($tempPath) ? filesize($tempPath) : 0
            ]);

            // Shopify'a yükle
            Log::info('Shopify: Upload işlemi başlıyor', [
                'product_id' => $productId,
                'temp_path' => $tempPath,
                'file_name' => $fileName,
                'image_position' => $imagePosition
            ]);
            
            $result = $this->uploadImageToShopify($productId, $tempPath, $fileName, $imagePosition);

            // Geçici dosyayı sil
            unlink($tempPath);

            return $result;

        } catch (\Exception $e) {
            Log::error('Google Drive to Shopify Upload Error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Image upload failed'
            ], 500);
        }
    }

    /**
     * Shopify GraphQL API'ye istek gönderir
     */
    private function shopifyGraphQL(string $query): array
    {
        $shop = session('shop');
        $accessToken = session('access_token');

        if (!$shop || !$accessToken) {
            throw new \Exception('Shopify store or access token not found.');
        }

        $response = Http::withHeaders([
            'X-Shopify-Access-Token' => $accessToken,
            'Content-Type' => 'application/json',
        ])->post("https://{$shop}/admin/api/2023-10/graphql.json", [
            'query' => $query
        ]);

        if ($response->successful()) {
            $jsonResponse = $response->json();
            Log::info('Shopify GraphQL Success', [
                'status' => $response->status(),
                'response' => $jsonResponse,
                'query' => $query,
            ]);
            return $jsonResponse;
        } else {
            Log::error('Shopify GraphQL API Error', [
                'status' => $response->status(),
                'response' => $response->body(),
                'query' => $query,
            ]);
            throw new \Exception('Shopify GraphQL API error: ' . $response->body());
        }
    }

    /**
     * Dosyayı Shopify'a yükle
     */
    private function uploadImageToShopify($productId, $filePath, $fileName, $imagePosition)
    {
        try {
            // Shopify Admin API ile dosya yükle
            $shop = session('shop');
            $accessToken = session('access_token');

            Log::info('Shopify Upload Debug', [
                'shop' => $shop,
                'access_token_exists' => !empty($accessToken),
                'product_id' => $productId,
                'file_path' => $filePath,
                'file_exists' => file_exists($filePath),
                'file_size' => file_exists($filePath) ? filesize($filePath) : 0
            ]);

            // Product ID'den sadece ID kısmını al (gid://shopify/Product/9299271385319 -> 9299271385319)
            $productIdOnly = str_replace('gid://shopify/Product/', '', $productId);
            $url = "https://{$shop}/admin/api/2024-10/products/{$productIdOnly}/images.json";
            
            Log::info('Shopify Upload URL', ['url' => $url]);
            
            $imageData = base64_encode(file_get_contents($filePath));
            
            Log::info('Shopify Upload Data', [
                'image_data_length' => strlen($imageData),
                'filename' => $fileName
            ]);
            
            $data = [
                'image' => [
                    'attachment' => $imageData,
                    'filename' => $fileName,
                    'position' => $imagePosition // Görsel pozisyonunu ekleyin
                ]
            ];

            Log::info('Shopify Upload Request başlıyor');
            
            $response = Http::withHeaders([
                'X-Shopify-Access-Token' => $accessToken,
                'Content-Type' => 'application/json'
            ])->post($url, $data);

            Log::info('Shopify Upload Response', [
                'status' => $response->status(),
                'successful' => $response->successful(),
                'body' => $response->body(),
                'headers' => $response->headers()
            ]);

            if ($response->successful()) {
                return response()->json([
                    'success' => true,
                    'image' => $response->json()['image']
                ]);
            } else {
                return response()->json([
                    'success' => false,
                    'error' => 'Shopify API error: ' . $response->body()
                ], 400);
            }

        } catch (\Exception $e) {
            Log::error('Shopify Image Upload Error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Image upload failed'
            ], 500);
        }
    }

    /**
     * Ürünün mevcut görsellerini Shopify'dan sil
     */
    public function deleteProductImages(Request $request)
    {
        try {
            // Session ID'yi header'dan al ve session'ı restore et
            $sessionId = $request->header('X-Session-ID');
            if ($sessionId) {
                session()->setId($sessionId);
                session()->start();
                Log::info('Session restored from header for delete images', ['session_id' => $sessionId]);
            }

            $productId = $request->input('product_id');
            
            if (!$productId) {
                return response()->json([
                    'success' => false,
                    'error' => 'Product ID required'
                ], 400);
            }

            // Check and restore Shopify session if missing
            $shop = session('shop');
            $accessToken = session('access_token');
            
            if (!$shop || !$accessToken) {
                Log::info('Shopify session missing in delete images, restoring test session');
                
                // Restore test session
                session(['shop' => 'erenimo-test.myshopify.com']);
                session(['access_token' => env('SHOPIFY_ACCESS_TOKEN')]);
                
                $shop = session('shop');
                $accessToken = session('access_token');
                
                Log::info('Test session restored for delete images', [
                    'shop' => $shop,
                    'access_token_exists' => !empty($accessToken)
                ]);
            }

            if (!$shop || !$accessToken) {
                return response()->json([
                    'success' => false,
                    'error' => 'Shopify session not found'
                ], 401);
            }

            Log::info('Ürün görselleri siliniyor', [
                'product_id' => $productId,
                'shop' => $shop
            ]);

            // Product ID'den sadece ID kısmını al
            $productIdOnly = str_replace('gid://shopify/Product/', '', $productId);
            
            // Önce ürünün mevcut görsellerini al
            $imagesUrl = "https://{$shop}/admin/api/2024-10/products/{$productIdOnly}/images.json";
            
            $imagesResponse = Http::withHeaders([
                'X-Shopify-Access-Token' => $accessToken,
                'Content-Type' => 'application/json'
            ])->get($imagesUrl);

            if (!$imagesResponse->successful()) {
                return response()->json([
                    'success' => false,
                    'error' => 'Ürün görselleri alınamadı'
                ], 400);
            }

            $images = $imagesResponse->json()['images'];
            $deletedCount = 0;

            // Her görseli tek tek sil
            foreach ($images as $image) {
                $imageId = $image['id'];
                $deleteUrl = "https://{$shop}/admin/api/2024-10/products/{$productIdOnly}/images/{$imageId}.json";
                
                $deleteResponse = Http::withHeaders([
                    'X-Shopify-Access-Token' => $accessToken,
                    'Content-Type' => 'application/json'
                ])->delete($deleteUrl);

                if ($deleteResponse->successful()) {
                    $deletedCount++;
                    Log::info("Görsel silindi", ['image_id' => $imageId]);
                } else {
                    Log::warning("Görsel silinemedi", [
                        'image_id' => $imageId,
                        'response' => $deleteResponse->body()
                    ]);
                }
            }

            Log::info('Ürün görselleri silme tamamlandı', [
                'product_id' => $productId,
                'deleted_count' => $deletedCount,
                'total_images' => count($images)
            ]);

            return response()->json([
                'success' => true,
                'message' => "{$deletedCount} görsel başarıyla silindi",
                'deleted_count' => $deletedCount,
                'total_images' => count($images)
            ]);

        } catch (\Exception $e) {
            Log::error('Ürün görselleri silinirken hata: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Görseller silinirken hata oluştu: ' . $e->getMessage()
            ], 500);
        }
    }
} 