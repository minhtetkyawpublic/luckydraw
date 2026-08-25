<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    @php
        $configuredBasePath = rtrim((string) parse_url(config('app.url'), PHP_URL_PATH), '/');
        $isAdminPortal = request()->is('admin') || request()->is('admin/*');
        $installedAppName = $isAdminPortal ? 'MBY Admin' : 'Moung Ba Yin';
        $manifestFile = $isAdminPortal ? 'admin-manifest.webmanifest' : 'manifest.webmanifest';
    @endphp
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="csrf-token" content="{{ csrf_token() }}">
        <meta name="theme-color" content="#ff6500">
        <meta name="apple-mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-title" content="{{ $installedAppName }}">
        <title>{{ $installedAppName }}</title>

        @vite(['resources/css/app.css', 'resources/js/app.jsx'])
        <link rel="manifest" href="{{ $configuredBasePath }}/{{ $manifestFile }}">
        <link rel="icon" type="image/png" sizes="32x32" href="{{ $configuredBasePath }}/logo.png">
        <link rel="icon" type="image/png" sizes="192x192" href="{{ $configuredBasePath }}/logo.png">
        <link rel="apple-touch-icon" sizes="180x180" href="{{ $configuredBasePath }}/logotransparent.png">
    </head>
    <body>
        <div id="app"></div>
    </body>
</html>
