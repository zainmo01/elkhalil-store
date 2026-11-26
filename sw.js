// El-Khalil store service worker: offline shell + fast repeat visits.
const CACHE = 'elkhalil-v2';

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE).then((cache) => cache.addAll(['./', './index.html', './manifest.webmanifest']))
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
        event.respondWith(
            fetch(event.request)
                .then((res) => {
                    const copy = res.clone();
                    caches.open(CACHE).then((cache) => cache.put('./index.html', copy));
                    return res;
                })
                .catch(() => caches.match('./index.html'))
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
