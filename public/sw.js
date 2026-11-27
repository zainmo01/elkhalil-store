// El-Khalil store service worker: online-first, no caching.
// Exists so the app is installable; every request goes straight to the network
// so products, orders and prices are never served stale.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).then(() => self.clients.claim())
    );
});
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    // Pages are always revalidated with the server (GitHub Pages would otherwise let the
    // HTTP cache serve an old index.html for up to 10 minutes after a deploy).
    if (event.request.mode === 'navigate') {
        event.respondWith(fetch(event.request, { cache: 'no-cache' }));
        return;
    }
    event.respondWith(fetch(event.request));
});
