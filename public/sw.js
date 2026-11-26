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
    event.respondWith(fetch(event.request));
});
