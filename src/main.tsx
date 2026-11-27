import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { loadCatalog } from './catalog';
import '@fontsource/tajawal/arabic-400.css';
import '@fontsource/tajawal/arabic-500.css';
import '@fontsource/tajawal/arabic-700.css';
import '@fontsource/tajawal/arabic-800.css';
import '@fontsource/tajawal/latin-400.css';
import '@fontsource/tajawal/latin-500.css';
import '@fontsource/tajawal/latin-700.css';
import '@fontsource/tajawal/latin-800.css';
import './style.css';

Promise.all([loadCatalog(), import('./App')]).then(([, mod]) => {
    const App = mod.App;
    createRoot(document.getElementById('root')!).render(
        <HashRouter>
            <App />
        </HashRouter>
    );
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then((r) => r.update()).catch(() => {});
    });
}

// Fresh-deploy check: compare the running bundle with the live index.html and reload
// once if a newer one exists. Runs at app open and whenever the app returns to the
// foreground. It never reloads while a prescription or checkout is being filled in.
function runningBundle(): string {
    const s = document.querySelector('script[src*="assets/index-"]') as HTMLScriptElement | null;
    return s?.getAttribute('src')?.match(/index-[A-Za-z0-9_-]+\.js/)?.[0] ?? '';
}
async function checkForUpdate() {
    try {
        const mine = runningBundle();
        if (!mine) return;
        const last = Number(sessionStorage.getItem('kh_upd') ?? '0');
        if (Date.now() - last < 30000) return;
        const res = await fetch(`./index.html?t=${Date.now()}`, { cache: 'no-store' });
        const html = await res.text();
        const live = html.match(/index-[A-Za-z0-9_-]+\.js/)?.[0];
        if (live && live !== mine) {
            if (/#\/(prescription|cart)/.test(location.hash)) return;
            sessionStorage.setItem('kh_upd', String(Date.now()));
            // The service worker opens pages from cache first, so refresh its copy before reloading.
            try { const c = await caches.open('elkhalil-v4'); await c.put('./index.html', new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })); } catch { /* ignore */ }
            location.reload();
        }
    } catch { /* offline: ignore */ }
}
window.addEventListener('load', () => { void checkForUpdate(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void checkForUpdate(); });
