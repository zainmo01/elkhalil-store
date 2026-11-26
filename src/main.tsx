import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from './App';
import '@fontsource/tajawal/arabic-400.css';
import '@fontsource/tajawal/arabic-500.css';
import '@fontsource/tajawal/arabic-700.css';
import '@fontsource/tajawal/arabic-800.css';
import '@fontsource/tajawal/latin-400.css';
import '@fontsource/tajawal/latin-500.css';
import '@fontsource/tajawal/latin-700.css';
import '@fontsource/tajawal/latin-800.css';
import './style.css';

createRoot(document.getElementById('root')!).render(
    <HashRouter>
        <App />
    </HashRouter>
);

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
}
