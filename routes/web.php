<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Controllers\ShopifyController;
use App\Http\Controllers\SyncController;

// Ana sayfa - Shopify app kurulumu
Route::get('/', function () {
    return view('welcome');
})->middleware(['verify.shopify'])->name('home');

// Dashboard - Shopify session gerektirir
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', function () {
        return Inertia::render('dashboard');
    })->name('dashboard');
    
    // Products sayfası
    Route::get('products', function () {
        return Inertia::render('Products');
    })->name('products');
    
    // Shopify API routes
    Route::get('/api/shopify/products', [ShopifyController::class, 'getProducts'])->name('api.shopify.products');
});

// Sync routes - auth gerektirmez
Route::post('/api/sync/products', [SyncController::class, 'syncProducts'])->name('api.sync.products');
Route::get('/api/sync/status', [SyncController::class, 'syncStatus'])->name('api.sync.status');
Route::get('/api/sync/products', [SyncController::class, 'getProducts'])->name('api.sync.getProducts');

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
