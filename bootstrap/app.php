<?php

use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\VerifyShopify;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->encryptCookies(except: ['appearance', 'sidebar_state']);

        $middleware->web(append: [
            HandleAppearance::class,
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);
        
        // Shopify middleware alias'ı ekle
        $middleware->alias([
            'verify.shopify' => VerifyShopify::class,
        ]);
        
        // CSRF korumasını API route'ları için devre dışı bırak
        $middleware->validateCsrfTokens(except: [
            '/api/sync/products',
            '/api/sync/status',
            '/api/shopify/products'
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();
