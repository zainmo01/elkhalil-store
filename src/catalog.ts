// Generated from the pharmacy's real item file - customer-safe fields only (id, name, sell price, category). Never add cost or tax data here.
export type CatalogItem = { i: string; n: string; p: number; c: number };
import dataUrl from './catalog-data.json?url';
// Filled in place by loadCatalog() before the app module is loaded.
export const CATALOG: CatalogItem[] = [];
export async function loadCatalog(): Promise<void> {
    const res = await fetch(dataUrl);
    const list = (await res.json()) as CatalogItem[];
    for (let k = 0; k < list.length; k++) CATALOG.push(list[k]);
}
