<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="csrf-token" content="{{ csrf_token() }}">
        <meta name="theme-color" content="#ff6500">
        <meta name="apple-mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-title" content="{{ config('app.name', 'Lucky Draw') }}">
        <title>{{ config('app.name', 'Lucky Draw') }}</title>

        @vite(['resources/css/app.css', 'resources/js/app.jsx'])
        <link rel="manifest" href="{{ request()->getBasePath() }}/manifest.webmanifest">
        <link rel="icon" type="image/png" sizes="32x32" href="{{ request()->getBasePath() }}/logo.png">
        <link rel="icon" type="image/png" sizes="192x192" href="{{ request()->getBasePath() }}/logo.png">
        <link rel="apple-touch-icon" sizes="180x180" href="{{ request()->getBasePath() }}/logotransparent.png">
    </head>
    <body>
        <div id="app"></div>
    </body>
</html>
