@extends('shopify-app::layouts.default')

@section('content')
    <div class="min-h-screen bg-white flex items-center justify-center p-6">
        <div class="max-w-sm w-full text-center">
            <h1 class="text-2xl font-semibold text-gray-900 mb-4">
                Erenimo
            </h1>
            
            <p class="text-gray-600 mb-8">
                Google Drive integration for your Shopify store
            </p>
            
            <a href="/google-drive" 
               class="inline-block w-full py-3 px-4 bg-green-500 text-white font-medium rounded-md hover:bg-green-600 transition-colors">
                Google Drive
            </a>
        </div>
    </div>
@endsection
