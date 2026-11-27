// El-Khalil store service worker.
// Hashed build files (/assets/*) never change for a given name, so they are cached
// forever for fast repeat opens. Pages and data always go to the network first so
// products, orders and prices are never stale.
const CACHE = 'kh-assets-v2';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
    );
});
self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    if (req.mode === 'navigate') {
        event.respondWith(fetch(req, { cache: 'no-cache' }));
        return;
    }
    const url = new URL(req.url);
    if (url.origin === location.origin && /\/assets\/[^/]+-[A-Za-z0-9_-]{6,}\.[a-z0-9]+$/.test(url.pathname)) {
        event.respondWith(caches.open(CACHE).then(async (c) => {
            const hit = await c.match(req);
            if (hit) return hit;
            const res = await fetch(req);
            if (res.ok) c.put(req, res.clone());
            return res;
        }));
        return;
    }
    event.respondWith(fetch(req));
});
