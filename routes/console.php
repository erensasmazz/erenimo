<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;
use App\Jobs\SyncShopifyProducts;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Automatic synchronization - runs daily at 02:00
Schedule::job(new SyncShopifyProducts())
    ->daily()
    ->at('02:00')
    ->withoutOverlapping();
