<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Osiset\ShopifyApp\Facades\ShopifyApp;

class VerifyShopify
{
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure(\Illuminate\Http\Request): (\Illuminate\Http\Response|\Illuminate\Http\RedirectResponse)  $next
     * @return \Illuminate\Http\Response|\Illuminate\Http\RedirectResponse
     */
    public function handle(Request $request, Closure $next)
    {
        // Shopify session kontrolü
        $shop = session('shopify_domain');
        $accessToken = session('shopify_access_token');
        
        if (!$shop || !$accessToken) {
            Log::info('Shopify session bulunamadı, ana sayfaya yönlendiriliyor');
            
            // Eğer API isteği ise JSON hata döndür
            if ($request->expectsJson()) {
                return response()->json(['error' => 'Shopify mağazası bulunamadı'], 400);
            }

            // Eğer Shopify admin içinde ise ve shop parametresi varsa,
            // ShopifyApp'in kendi yönlendirme mekanizmasını kullanarak üst düzey pencereyi yönlendir
            if ($request->query('shop')) {
                return ShopifyApp::redirect()->toInstall();
            }

            // Normal HTTP isteği ise ana sayfaya yönlendir
            return redirect()->route('home');
        }

        return $next($request);
    }
} 