// Generated from the pharmacy's real item file - customer-safe fields only (id, name, sell price, category). Never add cost or tax data here.
// The catalog is split: a small head file loads before the first paint, the rest streams in the background.
import React from 'react';
export type CatalogItem = { i: string; n: string; p: number; c: number };
import headUrl from './catalog/head.json?url';
const partUrls = import.meta.glob('./catalog/part-*.json', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

export const CATALOG: CatalogItem[] = [];
export const BY_ID = new Map<string, CatalogItem>();
let version = 0;
let ready = false;
const subs = new Set<() => void>();
export const catalogHooks: Array<() => void> = [];
const bump = () => { version++; catalogHooks.forEach((f) => { try { f(); } catch { /* ignore */ } }); subs.forEach((f) => f()); };
export const isCatalogReady = () => ready;
export function useCatalogVersion(): number {
    return React.useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => version);
}
function add(list: CatalogItem[]) { for (let k = 0; k < list.length; k++) { CATALOG.push(list[k]); BY_ID.set(list[k].i, list[k]); } }

export async function loadCatalog(): Promise<void> {
    const res = await fetch(headUrl);
    const head = (await res.json()) as { items: CatalogItem[]; extra: CatalogItem[] };
    add(head.items);
    for (const x of head.extra) BY_ID.set(x.i, x); // featured picks resolve before the rest arrives
}

// Streams the remaining parts one at a time, yielding to the UI between parts.
export async function loadRestInBackground(): Promise<void> {
    const urls = Object.keys(partUrls).sort((a, b) => Number(a.match(/(\d+)\.json/)![1]) - Number(b.match(/(\d+)\.json/)![1])).map((k) => partUrls[k]);
    for (const u of urls) {
        try {
            const list = (await (await fetch(u)).json()) as CatalogItem[];
            add(list);
            bump();
        } catch { await new Promise((r) => setTimeout(r, 3000)); try { add((await (await fetch(u)).json()) as CatalogItem[]); bump(); } catch { /* offline: stay partial */ } }
        await new Promise((r) => setTimeout(r, 60));
    }
    ready = true;
    bump();
}
