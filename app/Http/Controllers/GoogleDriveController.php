<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Google_Client;
use Google_Service_Drive;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http; // Added Http facade

class GoogleDriveController extends Controller
{
    private $client;

    public function __construct()
    {
        $this->client = new Google_Client();
        
        // Config değerlerini kontrol et
        $clientId = config('services.google.client_id');
        $clientSecret = config('services.google.client_secret');
        $redirectUri = config('services.google.redirect_uri');
        
        if (!$clientId || !$clientSecret || !$redirectUri) {
            Log::error('Google OAuth config missing', [
                'client_id' => $clientId ? 'set' : 'missing',
                'client_secret' => $clientSecret ? 'set' : 'missing',
                'redirect_uri' => $redirectUri ? 'set' : 'missing'
            ]);
        }
        
        $this->client->setClientId($clientId);
        $this->client->setClientSecret($clientSecret);
        $this->client->setRedirectUri($redirectUri);
        $this->client->setScopes([
            'https://www.googleapis.com/auth/drive',
            'https://www.googleapis.com/auth/drive.readonly',
            'https://www.googleapis.com/auth/drive.file',
            'https://www.googleapis.com/auth/drive.metadata.readonly'
        ]);
    }

    /**
     * Google OAuth login URL'ini döndür
     */
    public function getAuthUrl()
    {
        try {
            // Refresh token almak için access_type'ı offline yap
            $this->client->setAccessType('offline');
            $this->client->setPrompt('consent');
            
            $authUrl = $this->client->createAuthUrl();
            return response()->json([
                'success' => true,
                'auth_url' => $authUrl
            ]);
        } catch (\Exception $e) {
            Log::error('Google Auth URL Error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Google authentication URL oluşturulamadı'
            ], 500);
        }
    }

    /**
     * OAuth callback - authorization code'u access token'a çevir
     */
    public function handleCallback(Request $request)
    {
        try {
            if ($request->has('code')) {
                $token = $this->client->fetchAccessTokenWithAuthCode($request->get('code'));
                
                if (isset($token['error'])) {
                    Log::error('Google Token Error: ' . ($token['error_description'] ?? $token['error']));
                    return redirect()->route('google-drive')->with('error', 'Google Drive bağlantısı başarısız oldu: ' . ($token['error_description'] ?? $token['error']));
                }

                // Token'ları session'da sakla
                session(['google_access_token' => $token['access_token']]);
                if (isset($token['refresh_token'])) {
                    session(['google_refresh_token' => $token['refresh_token']]);
                }

                // Başarılı bağlantı sonrası Google Drive sayfasına yönlendir
                return redirect()->route('google-drive')->with('success', 'Google Drive bağlantısı başarılı!');

            } else {
                // Kullanıcı izni reddetti
                return redirect()->route('google-drive')->with('error', 'Google Drive bağlantısı reddedildi.');
            }
        } catch (\Exception $e) {
            Log::error('Google Callback Error: ' . $e->getMessage());
            return redirect()->route('google-drive')->with('error', 'Google Drive bağlantısı sırasında bir hata oluştu.');
        }
    }

    /**
     * Google Drive'dan dosyaları listele
     */
    public function listFiles(Request $request)
    {
        try {
            $accessToken = session('google_access_token');
            $refreshToken = session('google_refresh_token');
            
            // GET veya POST'tan folder_id'yi al
            $folderId = $request->query('folder_id');
            if (!$folderId) {
                $folderId = $request->input('folder_id');
            }
            
            if (!$accessToken) {
                return response()->json([
                    'success' => false,
                    'error' => 'Google Drive bağlantısı gerekli'
                ], 401);
            }

            $this->client->setAccessToken($accessToken);

            // Token expire olduysa refresh et
            if ($this->client->isAccessTokenExpired()) {
                if ($refreshToken) {
                    // Refresh token ile yeni access token al
                    $token = $this->client->fetchAccessTokenWithRefreshToken($refreshToken);
                    if (isset($token['access_token'])) {
                        session(['google_access_token' => $token['access_token']]);
                        if (isset($token['refresh_token'])) {
                            session(['google_refresh_token' => $token['refresh_token']]);
                        }
                    } else {
                        return response()->json([
                            'success' => false,
                            'error' => 'Token yenilenemedi'
                        ], 401);
                    }
                } else {
                    return response()->json([
                        'success' => false,
                        'error' => 'Refresh token bulunamadı'
                    ], 401);
                }
            }

            $service = new Google_Service_Drive($this->client);
            
            // Sorgu oluştur - klasör ID'si varsa sadece o klasördeki dosyaları getir
            $query = "mimeType contains 'image/'";
            if ($folderId && $folderId !== 'root' && $folderId !== '') {
                $query .= " and '$folderId' in parents";
            }
            
            Log::info('Google Drive Files Query', [
                'folder_id' => $folderId,
                'query' => $query,
                'method' => $request->method(),
                'raw_query' => $request->query('folder_id'),
                'raw_input' => $request->input('folder_id')
            ]);
            
            $results = $service->files->listFiles([
                'q' => $query,
                'fields' => 'files(id,name,size,mimeType,thumbnailLink,webContentLink,webViewLink)',
                'pageSize' => 50
            ]);

            $files = [];
            foreach ($results->getFiles() as $file) {
                // Proxy thumbnail URL'ini oluştur
                $thumbnailUrl = route('api.google.thumbnail', ['fileId' => $file->getId()]);
                
                $files[] = [
                    'id' => $file->getId(),
                    'name' => $file->getName(),
                    'size' => $file->getSize(),
                    'mime_type' => $file->getMimeType(),
                    'thumbnail' => $thumbnailUrl,
                    'download_url' => $file->getWebContentLink(),
                    'view_url' => $file->getWebViewLink()
                ];
            }

            Log::info('Google Drive Files Found', [
                'folder_id' => $folderId,
                'file_count' => count($files),
                'files' => array_map(function($file) { return $file['name']; }, $files)
            ]);

            return response()->json([
                'success' => true,
                'files' => $files,
                'folder_id' => $folderId
            ]);

        } catch (\Exception $e) {
            Log::error('Google Drive List Error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Dosyalar listelenemedi'
            ], 500);
        }
    }

    /**
     * Dosya indir
     */
    public function downloadFile(Request $request, $fileId)
    {
        try {
            $accessToken = session('google_access_token');
            
            if (!$accessToken) {
                return response()->json([
                    'success' => false,
                    'error' => 'Google Drive bağlantısı gerekli'
                ], 401);
            }

            $this->client->setAccessToken($accessToken);
            $service = new Google_Service_Drive($this->client);
            
            $file = $service->files->get($fileId);
            $content = $service->files->get($fileId, ['alt' => 'media']);

            return response()->json([
                'success' => true,
                'file' => [
                    'id' => $file->getId(),
                    'name' => $file->getName(),
                    'mime_type' => $file->getMimeType(),
                    'content' => base64_encode($content->getBody()->getContents())
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Google Drive Download Error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Dosya indirilemedi'
            ], 500);
        }
    }

    /**
     * Google Drive thumbnail'ını proxy ile serve et
     */
    public function proxyThumbnail(Request $request, $fileId)
    {
        try {
            $accessToken = session('google_access_token');
            
            if (!$accessToken) {
                return response()->json(['error' => 'Unauthorized'], 401);
            }

            $this->client->setAccessToken($accessToken);
            $service = new Google_Service_Drive($this->client);
            
            // Dosyayı al
            $file = $service->files->get($fileId, ['fields' => 'thumbnailLink']);
            $thumbnailUrl = $file->getThumbnailLink();
            
            if (!$thumbnailUrl) {
                return response()->json(['error' => 'Thumbnail not found'], 404);
            }
            
            // Thumbnail URL'ini düzelt
            $thumbnailUrl = str_replace('=s220', '=s300', $thumbnailUrl);
            
            // Thumbnail'i indir ve serve et
            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . $accessToken
            ])->get($thumbnailUrl);
            
            if ($response->successful()) {
                return response($response->body())
                    ->header('Content-Type', 'image/jpeg')
                    ->header('Cache-Control', 'public, max-age=3600');
            }
            
            return response()->json(['error' => 'Failed to fetch thumbnail'], 500);
            
        } catch (\Exception $e) {
            Log::error('Thumbnail Proxy Error: ' . $e->getMessage());
            return response()->json(['error' => 'Internal server error'], 500);
        }
    }

    /**
     * Google Picker API için config bilgilerini döndür
     */
    public function getPickerConfig()
    {
        try {
            return response()->json([
                'success' => true,
                'config' => [
                    'developerKey' => config('services.google.api_key'),
                    'clientId' => config('services.google.client_id'),
                    'scope' => 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.metadata.readonly',
                    'appId' => config('services.google.client_id')
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Picker Config Error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Picker config alınamadı'
            ], 500);
        }
    }

    /**
     * Google Picker API için access token döndür
     */
    public function getAccessToken()
    {
        try {
            $accessToken = session('google_access_token');
            
            if (!$accessToken) {
                return response()->json([
                    'success' => false,
                    'error' => 'Google Drive bağlantısı gerekli'
                ], 401);
            }

            // Token expire olduysa refresh et
            $this->client->setAccessToken($accessToken);
            if ($this->client->isAccessTokenExpired()) {
                $refreshToken = session('google_refresh_token');
                if ($refreshToken) {
                    $token = $this->client->fetchAccessTokenWithRefreshToken($refreshToken);
                    if (isset($token['access_token'])) {
                        session(['google_access_token' => $token['access_token']]);
                        $accessToken = $token['access_token'];
                        if (isset($token['refresh_token'])) {
                            session(['google_refresh_token' => $token['refresh_token']]);
                        }
                    } else {
                        return response()->json([
                            'success' => false,
                            'error' => 'Token yenilenemedi'
                        ], 401);
                    }
                } else {
                    return response()->json([
                        'success' => false,
                        'error' => 'Refresh token bulunamadı'
                    ], 401);
                }
            }

            return response()->json([
                'success' => true,
                'access_token' => $accessToken
            ]);
        } catch (\Exception $e) {
            Log::error('Access Token Error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Access token alınamadı'
            ], 500);
        }
    }

    /**
     * Seçili klasörden dosyaları listele
     */
    public function listFilesFromFolder(Request $request)
    {
        try {
            $folderId = $request->input('folder_id');
            $accessToken = session('google_access_token');
            
            if (!$accessToken) {
                return response()->json([
                    'success' => false,
                    'error' => 'Google Drive bağlantısı gerekli'
                ], 401);
            }

            $this->client->setAccessToken($accessToken);

            // Token expire olduysa refresh et
            if ($this->client->isAccessTokenExpired()) {
                $refreshToken = session('google_refresh_token');
                if ($refreshToken) {
                    $token = $this->client->fetchAccessTokenWithRefreshToken($refreshToken);
                    if (isset($token['access_token'])) {
                        session(['google_access_token' => $token['access_token']]);
                        if (isset($token['refresh_token'])) {
                            session(['google_refresh_token' => $token['refresh_token']]);
                        }
                    } else {
                        return response()->json([
                            'success' => false,
                            'error' => 'Token yenilenemedi'
                        ], 401);
                    }
                } else {
                    return response()->json([
                        'success' => false,
                        'error' => 'Refresh token bulunamadı'
                    ], 401);
                }
            }

            $service = new Google_Service_Drive($this->client);
            
            // Klasör sorgusu - eğer folder_id boşsa tüm dosyaları getir
            $query = "mimeType contains 'image/'";
            if ($folderId && $folderId !== 'root' && $folderId !== '') {
                $query .= " and '$folderId' in parents";
            }
            
            Log::info('Google Drive Folder Query', [
                'folder_id' => $folderId,
                'query' => $query
            ]);
            
            $results = $service->files->listFiles([
                'q' => $query,
                'fields' => 'files(id,name,size,mimeType,thumbnailLink,webContentLink,webViewLink)',
                'pageSize' => 50
            ]);

            $files = [];
            foreach ($results->getFiles() as $file) {
                // Proxy thumbnail URL'ini oluştur
                $thumbnailUrl = route('api.google.thumbnail', ['fileId' => $file->getId()]);
                
                $files[] = [
                    'id' => $file->getId(),
                    'name' => $file->getName(),
                    'size' => $file->getSize(),
                    'mime_type' => $file->getMimeType(),
                    'thumbnail' => $thumbnailUrl,
                    'download_url' => $file->getWebContentLink(),
                    'view_url' => $file->getWebViewLink()
                ];
            }

            Log::info('Google Drive Files Found', [
                'folder_id' => $folderId,
                'file_count' => count($files)
            ]);

            return response()->json([
                'success' => true,
                'files' => $files,
                'folder_id' => $folderId
            ]);

        } catch (\Exception $e) {
            Log::error('Google Drive Folder List Error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Dosyalar listelenirken hata oluştu'
            ], 500);
        }
    }

    /**
     * Google Drive klasörlerini listele
     */
    public function listFolders()
    {
        try {
            $accessToken = session('google_access_token');
            
            if (!$accessToken) {
                return response()->json([
                    'success' => false,
                    'error' => 'Google Drive bağlantısı gerekli'
                ], 401);
            }

            $this->client->setAccessToken($accessToken);

            // Token expire olduysa refresh et
            if ($this->client->isAccessTokenExpired()) {
                $refreshToken = session('google_refresh_token');
                if ($refreshToken) {
                    $token = $this->client->fetchAccessTokenWithRefreshToken($refreshToken);
                    if (isset($token['access_token'])) {
                        session(['google_access_token' => $token['access_token']]);
                        if (isset($token['refresh_token'])) {
                            session(['google_refresh_token' => $token['refresh_token']]);
                        }
                    } else {
                        return response()->json([
                            'success' => false,
                            'error' => 'Token yenilenemedi'
                        ], 401);
                    }
                } else {
                    return response()->json([
                        'success' => false,
                        'error' => 'Refresh token bulunamadı'
                    ], 401);
                }
            }

            $service = new Google_Service_Drive($this->client);
            
            // Sadece klasörleri listele
            $query = "mimeType='application/vnd.google-apps.folder'";
            
            Log::info('Google Drive Folders Query', ['query' => $query]);
            
            $results = $service->files->listFiles([
                'q' => $query,
                'fields' => 'files(id,name,createdTime,modifiedTime)',
                'pageSize' => 50
            ]);

            $folders = [];
            foreach ($results->getFiles() as $folder) {
                $folders[] = [
                    'id' => $folder->getId(),
                    'name' => $folder->getName(),
                    'createdTime' => $folder->getCreatedTime(),
                    'modifiedTime' => $folder->getModifiedTime()
                ];
            }

            Log::info('Google Drive Folders Found', ['folder_count' => count($folders)]);

            return response()->json([
                'success' => true,
                'folders' => $folders
            ]);

        } catch (\Exception $e) {
            Log::error('Google Drive Folders List Error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Klasörler listelenirken hata oluştu'
            ], 500);
        }
    }
}
