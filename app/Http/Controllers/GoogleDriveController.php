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
        
        // Check config values
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
     * Return Google OAuth login URL
     */
    public function getAuthUrl()
    {
        try {
            // Set access_type to offline to get refresh token
            $this->client->setAccessType('offline');
            $this->client->setPrompt('consent');
            
            // Popup için ayar ekle
            $this->client->setApprovalPrompt('force');
            
            $authUrl = $this->client->createAuthUrl();
            return response()->json([
                'success' => true,
                'auth_url' => $authUrl,
                'popup' => true  // Frontend'e popup kullanacağımızı bildir
            ]);
        } catch (\Exception $e) {
            Log::error('Google Auth URL Error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Google authentication URL could not be created'
            ], 500);
        }
    }

    /**
     * OAuth callback - convert authorization code to access token
     */
    public function handleCallback(Request $request)
    {
        try {
            if ($request->has('code')) {
                $token = $this->client->fetchAccessTokenWithAuthCode($request->get('code'));
                
                if (isset($token['error'])) {
                    Log::error('Google Token Error: ' . ($token['error_description'] ?? $token['error']));
                    // Popup için JavaScript ile hata mesajı gönder
                    return response()->view('google-callback', [
                        'status' => 'error',
                        'message' => 'Google Drive connection failed: ' . ($token['error_description'] ?? $token['error'])
                    ]);
                }

                // Store tokens in session
                session(['google_access_token' => $token['access_token']]);
                if (isset($token['refresh_token'])) {
                    session(['google_refresh_token' => $token['refresh_token']]);
                }
                
                // Session'ı kaydet
                session()->save();
                
                // Session ID'yi al
                $sessionId = session()->getId();
                
                // Debug log
                Log::info('Google tokens stored in session', [
                    'access_token_exists' => !empty($token['access_token']),
                    'refresh_token_exists' => isset($token['refresh_token']),
                    'session_id' => $sessionId,
                    'session_data' => session()->all()
                ]);
                
                // Session regenerate kaldırıldı: aynı session ID kullanılacak
                Log::info('Session persisted without regenerate', [
                    'session_id' => $sessionId,
                ]);

                // Popup için JavaScript ile popup'ı kapat ve parent'a mesaj gönder
                // Session ID'yi de mesajda gönder
                // Redirect URL: app.url ya da request hostunu kullan
                $ngrokDomain = config('app.url') ?: $request->getSchemeAndHttpHost();
                return response()->view('google-callback-simple', [
                    'status' => 'success',
                    'message' => 'Google Drive connection successful!',
                    'session_id' => session()->getId(),
                    'redirect_url' => $ngrokDomain . '/google-drive?session_id=' . session()->getId()
                ]);

            } else {
                // User denied permission
                return response()->view('google-callback', [
                    'status' => 'error',
                    'message' => 'Google Drive connection denied.'
                ]);
            }
        } catch (\Exception $e) {
            Log::error('Google Callback Error: ' . $e->getMessage());
            return response()->view('google-callback', [
                'status' => 'error',
                'message' => 'An error occurred during Google Drive connection.'
            ]);
        }
    }

    /**
     * Google Drive'dan dosyaları listele
     */
    public function listFiles(Request $request)
    {
        try {
            // Session ID'yi header'dan al ve session'ı restore et
            $sessionId = $request->header('X-Session-ID');
            if ($sessionId) {
                Log::info('Restoring session from header', ['session_id' => $sessionId]);
                // Session ID'yi kullanarak session'ı restore et
                session()->setId($sessionId);
                session()->start();
            }
            
            $accessToken = session('google_access_token');
            $refreshToken = session('google_refresh_token');
            
            // Pagination params
            $pageSize = (int) ($request->query('page_size', 100));
            if ($pageSize <= 0 || $pageSize > 200) {
                $pageSize = 100;
            }
            $pageToken = $request->query('page_token');

            // GET veya POST'tan folder_id'yi al
            $folderId = $request->query('folder_id');
            if (!$folderId) {
                $folderId = $request->input('folder_id');
            }
            
            if (!$accessToken) {
                return response()->json([
                    'success' => false,
                    'error' => 'Google Drive connection required'
                ], 401);
            }

            $this->client->setAccessToken($accessToken);

            // Refresh if token is expired
            if ($this->client->isAccessTokenExpired()) {
                if ($refreshToken) {
                    // Get new access token with refresh token
                    $token = $this->client->fetchAccessTokenWithRefreshToken($refreshToken);
                    if (isset($token['access_token'])) {
                        session(['google_access_token' => $token['access_token']]);
                        if (isset($token['refresh_token'])) {
                            session(['google_refresh_token' => $token['refresh_token']]);
                        }
                    } else {
                        return response()->json([
                            'success' => false,
                            'error' => 'Token could not be renewed'
                        ], 401);
                    }
                } else {
                    return response()->json([
                        'success' => false,
                        'error' => 'Refresh token not found'
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
                'fields' => 'nextPageToken, files(id,name,size,mimeType,thumbnailLink,webContentLink,webViewLink)',
                'pageSize' => $pageSize,
                'pageToken' => $pageToken
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
                'folder_id' => $folderId,
                'next_page_token' => $results->getNextPageToken() ?? null,
                'page_size' => $pageSize
            ]);

        } catch (\Exception $e) {
            Log::error('Google Drive List Error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Files could not be listed'
            ], 500);
        }
    }

    /**
     * Download file
     */
    public function downloadFile(Request $request, $fileId)
    {
        try {
            $accessToken = session('google_access_token');
            
            if (!$accessToken) {
                return response()->json([
                    'success' => false,
                    'error' => 'Google Drive connection required'
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
                'error' => 'File could not be downloaded'
            ], 500);
        }
    }

    /**
     * Serve Google Drive thumbnail via proxy
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
            
            // Get file
            $file = $service->files->get($fileId, ['fields' => 'thumbnailLink']);
            $thumbnailUrl = $file->getThumbnailLink();
            
            if (!$thumbnailUrl) {
                return response()->json(['error' => 'Thumbnail not found'], 404);
            }
            
            // Fix thumbnail URL
            $thumbnailUrl = str_replace('=s220', '=s300', $thumbnailUrl);
            
            // Download and serve thumbnail
            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . $accessToken
            ])->get($thumbnailUrl);
            
            if ($response->successful()) {
                return response($response->body())
                    ->header('Content-Type', 'image/jpeg')
                    ->header('Cache-Control', 'public, max-age=86400');
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
                'error' => 'Picker config could not be obtained'
            ], 500);
        }
    }

    /**
     * Return access token for Google Picker API
     */
    public function getAccessToken()
    {
        try {
            $accessToken = session('google_access_token');
            
            if (!$accessToken) {
                return response()->json([
                    'success' => false,
                    'error' => 'Google Drive connection required'
                ], 401);
            }

            // Refresh if token is expired
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
                            'error' => 'Token could not be renewed'
                        ], 401);
                    }
                } else {
                    return response()->json([
                        'success' => false,
                        'error' => 'Refresh token not found'
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
                'error' => 'Access token could not be obtained'
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
                    'error' => 'Google Drive connection required'
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
                            'error' => 'Token could not be renewed'
                        ], 401);
                    }
                } else {
                    return response()->json([
                        'success' => false,
                        'error' => 'Refresh token not found'
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
                'error' => 'Files could not be listed'
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
                    'error' => 'Google Drive connection required'
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
                            'error' => 'Token could not be renewed'
                        ], 401);
                    }
                } else {
                    return response()->json([
                        'success' => false,
                        'error' => 'Refresh token not found'
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
                'error' => 'Folders could not be listed'
            ], 500);
        }
    }
}
