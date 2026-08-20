const VERSION = 'v8-editable-home-content';
const PATHNAME = new URL(self.location.href).pathname;
const SW_MARKER = '/sw.js';
const BASE_PATH = (PATHNAME.lastIndexOf(SW_MARKER) >= 0
    ? PATHNAME.slice(0, PATHNAME.lastIndexOf(SW_MARKER))
    : '')
    .replace(/\/+$/, '')
    .replace(/\/{2,}/g, '/')
    || '/';

const joinPath = (relativePath) => {
    const path = String(relativePath || '').replace(/^\/+/, '');
    if (path === '') {
        return `${BASE_PATH}`;
    }

    if (BASE_PATH === '/') {
        return `/${path}`;
    }

    return `${BASE_PATH}/${path}`;
};

const SHELL_CACHE = `lucky-draw-shell-${VERSION}`;
const API_PREFIX = joinPath('api');
const SANCTUM_CSRF = joinPath('sanctum/csrf-cookie');
const APP_MANIFEST = joinPath('manifest.webmanifest');
const BUILD_MANIFEST = joinPath('build/manifest.json');
const APP_SHELL = [
    joinPath(''),
    APP_MANIFEST,
    joinPath('favicon.ico'),
    joinPath('robots.txt'),
    joinPath('logo.png'),
    joinPath('logotransparent.png'),
];

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(SHELL_CACHE);

        await cache.addAll(APP_SHELL);

        try {
            const buildManifestResponse = await fetch(BUILD_MANIFEST);
            if (buildManifestResponse.ok) {
                const manifestData = await buildManifestResponse.json();
                const assetPaths = Object.values(manifestData).flatMap((asset) => {
                    const paths = [];

                    if (asset.file) {
                        paths.push(asset.file);
                    }

                    if (Array.isArray(asset.css)) {
                        asset.css.forEach((cssFile) => paths.push(cssFile));
                    }

                    if (Array.isArray(asset.assets)) {
                        asset.assets.forEach((assetFile) => paths.push(assetFile));
                    }

                    return paths;
                });

                const uniqueShellAssets = [...new Set(assetPaths.filter(Boolean))]
                    .map((assetPath) => joinPath(assetPath));

                await cache.addAll(uniqueShellAssets);
            }
        } catch {
            // Manifest may not be available during some setups; shell assets already cached.
        }
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(
            keys
                .filter((key) => key.startsWith('lucky-draw-shell-') && key !== SHELL_CACHE)
                .map((oldKey) => caches.delete(oldKey)),
        );
        await self.clients.claim();
    })());
});

self.addEventListener('message', (event) => {
    if (!event.data) {
        return;
    }

    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

function isNetworkOnlyRequest(url) {
    if (url.origin !== self.location.origin) {
        return true;
    }

    return url.pathname === SANCTUM_CSRF
        || url.pathname === API_PREFIX
        || url.pathname.startsWith(`${API_PREFIX}/`);
}

function isNavigationRequest(request) {
    return request.mode === 'navigate'
        || (request.headers.get('accept') || '').includes('text/html');
}

self.addEventListener('fetch', (event) => {
    const request = event.request;

    if (request.method !== 'GET') {
        return;
    }

    const url = new URL(request.url);

    if (isNetworkOnlyRequest(url)) {
        event.respondWith(fetch(request));
        return;
    }

    if (isNavigationRequest(request)) {
        const fallbackUrl = joinPath('');
        event.respondWith((async () => {
            try {
                const networkResponse = await fetch(request);
                const cache = await caches.open(SHELL_CACHE);
                await cache.put(request, networkResponse.clone());
                return networkResponse;
            } catch {
                const cachedFallback = await caches.match(fallbackUrl);
                if (cachedFallback) {
                    return cachedFallback;
                }

                return new Response('Offline', {
                    status: 503,
                    headers: { 'content-type': 'text/plain; charset=utf-8' },
                });
            }
        })());
        return;
    }

    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }

            return fetch(request)
                .then((networkResponse) => {
                    if (!networkResponse || !networkResponse.ok) {
                        return networkResponse;
                    }

                    const copy = networkResponse.clone();
                    caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
                    return networkResponse;
                })
                .catch(() => {
                    const fallbackUrl = joinPath('');
                    return caches.match(fallbackUrl);
                });
        }),
    );
});

self.addEventListener('sync', (event) => {
    if (event.tag === 'wallet-readonly-retry') {
        event.waitUntil(Promise.resolve());
    }
});
