@extends('shopify-app::layouts.default')

@section('content')
    <div class="min-h-screen flex items-center justify-center bg-gray-50">
        <div class="max-w-md w-full space-y-8">
            <div>
                <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
                    Erenimo App
                </h2>
                <p class="mt-2 text-center text-sm text-gray-600">
                    Shopify mağazanızın ürünlerini yönetin
                </p>
            </div>
            
            <div class="mt-8 space-y-6">
                <div class="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                    <div class="space-y-6">
                        <div class="text-center">
                            <a href="/dashboard" 
                               class="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                                Dashboard'a Git
                            </a>
                        </div>
                        
                        <div class="text-center">
                            <a href="/products" 
                               class="w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                                Ürün Listesi
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
@endsection
