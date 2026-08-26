const VERSION = 'v13-moung-bayin-manifest';
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
const ADMIN_MANIFEST = joinPath('admin-manifest.webmanifest');
const BUILD_MANIFEST = joinPath('build/manifest.json');
const APP_SHELL = [
    joinPath(''),
    APP_MANIFEST,
    ADMIN_MANIFEST,
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

self.addEventListener('push', (event) => {
    event.waitUntil((async () => {
        let payload = {};
        try {
            payload = event.data?.json() || {};
        } catch {
            payload = { body: event.data?.text() || '' };
        }

        const tag = payload.tag || 'mby-current-announcement';
        const currentNotifications = await self.registration.getNotifications({ tag });
        currentNotifications.forEach((notification) => notification.close());

        await self.registration.showNotification(payload.title || 'မောင်းဘုရင်', {
            body: payload.body || 'အသိပေးစာအသစ် ရရှိပါသည်။',
            icon: joinPath('logo.png'),
            badge: joinPath('logotransparent.png'),
            tag,
            renotify: true,
            data: {
                url: joinPath(payload.url || 'announcement'),
                version: payload.version || null,
            },
        });

        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        windows.forEach((client) => client.postMessage({
            type: 'ANNOUNCEMENT_UPDATED',
            version: payload.version || null,
        }));
    })());
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = new URL(event.notification.data?.url || joinPath('announcement'), self.location.origin).href;

    event.waitUntil((async () => {
        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of windows) {
            if (client.url === targetUrl && 'focus' in client) return client.focus();
        }
        for (const client of windows) {
            if ('navigate' in client && 'focus' in client) {
                await client.navigate(targetUrl);
                return client.focus();
            }
        }
        return self.clients.openWindow ? self.clients.openWindow(targetUrl) : undefined;
    })());
});

self.addEventListener('pushsubscriptionchange', (event) => {
    event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
        windows.forEach((client) => client.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED' }));
    }));
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

    if (url.pathname.endsWith('.webmanifest')) {
        event.respondWith((async () => {
            try {
                const networkResponse = await fetch(request, { cache: 'no-store' });
                if (networkResponse?.ok) {
                    const cache = await caches.open(SHELL_CACHE);
                    await cache.put(request, networkResponse.clone());
                }
                return networkResponse;
            } catch {
                return caches.match(request);
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
