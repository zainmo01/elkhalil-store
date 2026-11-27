// El-Khalil store service worker: offline shell + fast repeat visits.
const CACHE = 'elkhalil-v4';

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE).then((cache) => cache.addAll(['./', './index.html', './manifest.webmanifest', './icons/welcome-logo.webp']))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    // Never cache API/backend calls.
    if (url.hostname.includes('supabase')) return;
    if (event.request.method !== 'GET') return;

    // Network-first for pages, cache-first for assets.
    if (event.request.mode === 'navigate') {
        // Stale-while-revalidate: open instantly from cache, refresh in the background.
        // main.tsx reloads once if the refreshed index.html points to a newer bundle.
        event.respondWith(
            caches.match('./index.html').then((hit) => {
                const net = fetch(event.request, { cache: 'no-cache' }).then((res) => {
                    const copy = res.clone();
                    caches.open(CACHE).then((cache) => cache.put('./index.html', copy));
                    return res;
                });
                if (hit) { net.catch(() => {}); return hit; }
                return net.catch(() => caches.match('./index.html'));
            })
        );
        return;
    }
    event.respondWith(
        caches.match(event.request).then(
            (hit) =>
                hit ||
                fetch(event.request).then((res) => {
                    if (res.ok && url.origin === self.location.origin) {
                        const copy = res.clone();
                        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
                    }
                    return res;
                })
        )
    );
});
