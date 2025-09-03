<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Controllers\ShopifyController;
use App\Http\Controllers\SyncController;
use App\Http\Controllers\GoogleDriveController;

// CSRF Token endpoint for Shopify app
Route::get('/api/csrf-token', function () {
    return response()->json(['csrf_token' => csrf_token()]);
});

// Test page - without middleware
Route::get('/test', function () {
    return '<h1>Test Page Working!</h1><p>Laravel project is working successfully.</p>';
})->name('test');

// Main page - Shopify app installation
Route::get('/', function () {
    return view('welcome');
})->middleware(['verify.shopify'])->name('home');

// Google Drive page - no auth required
Route::get('google-drive', function () {
    return Inertia::render('google-drive');
})->name('google-drive');

// Dashboard - requires Shopify session
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', function () {
        return Inertia::render('dashboard');
    })->name('dashboard');
});

// Products page - public (no Shopify middleware to avoid iframe auth issues)
Route::get('products', function () {
    return Inertia::render('Products');
})->name('products');

// Shopify API routes - no auth required, except CSRF
Route::get('/api/shopify/products', [ShopifyController::class, 'getProducts'])->name('api.shopify.products');
Route::post('/api/shopify/upload-image', [ShopifyController::class, 'uploadImage'])->name('api.shopify.upload-image');
Route::post('/api/shopify/upload-from-google-drive', [ShopifyController::class, 'uploadFromGoogleDrive'])->name('api.shopify.upload-from-google-drive');
Route::post('/api/shopify/delete-product-images', [ShopifyController::class, 'deleteProductImages'])->name('api.shopify.delete-product-images');

// Shopify OAuth routes
Route::get('/api/shopify/auth-url', [ShopifyController::class, 'getAuthUrl'])->name('api.shopify.auth-url');
Route::get('/auth/shopify/callback', [ShopifyController::class, 'handleCallback'])->name('auth.shopify.callback');

// Sync routes - no auth required
Route::post('/api/sync/products', [SyncController::class, 'syncProducts'])->name('api.sync.products');
Route::get('/api/sync/status', [SyncController::class, 'syncStatus'])->name('api.sync.status');
Route::get('/api/sync/products', [SyncController::class, 'getProducts'])->name('api.sync.getProducts');

// Google OAuth callback route - direct route for .env compatibility
Route::get('/auth/google/callback', [GoogleDriveController::class, 'handleCallback'])->name('auth.google.callback');

// Google Drive API routes
Route::prefix('api/google')->group(function () {
    Route::get('/auth-url', [GoogleDriveController::class, 'getAuthUrl'])->name('api.google.auth-url');
    Route::get('/callback', [GoogleDriveController::class, 'handleCallback'])->name('api.google.callback');
    Route::get('/files', [GoogleDriveController::class, 'listFiles'])->name('api.google.files');
    Route::get('/folders', [GoogleDriveController::class, 'listFolders'])->name('api.google.folders');
    Route::get('/files/{fileId}/download', [GoogleDriveController::class, 'downloadFile'])->name('api.google.download');
    Route::get('/thumbnail/{fileId}', [GoogleDriveController::class, 'proxyThumbnail'])->name('api.google.thumbnail');
    Route::get('/picker-config', [GoogleDriveController::class, 'getPickerConfig'])->name('api.google.picker-config');
    Route::get('/access-token', [GoogleDriveController::class, 'getAccessToken'])->name('api.google.access-token');
    Route::post('/files/folder', [GoogleDriveController::class, 'listFilesFromFolder'])->name('api.google.files.folder');
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
