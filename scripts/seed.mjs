// Seed the products table from the generated catalog (src/catalog.ts).
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/seed.mjs
// The service key bypasses RLS — never ship it in the app bundle.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY');
    process.exit(1);
}

const CAT_NAMES = ['الأدوية', 'العناية', 'الفيتامينات', 'الأم والطفل', 'أجهزة طبية'];

const src = readFileSync(new URL('../src/catalog.ts', import.meta.url), 'utf8');
const match = src.match(/export const CATALOG: CatalogItem\[\] = (\[.*\]);?\s*$/s);
if (!match) {
    console.error('Could not parse catalog.ts');
    process.exit(1);
}
const catalog = JSON.parse(match[1]);
console.log(`Parsed ${catalog.length} products`);

const rows = catalog.map((x) => ({
    id: x.i,
    name: x.n,
    sell_price: x.p,
    category: CAT_NAMES[x.c] ?? 'الأدوية',
    stock: 10, // placeholder until the pharmacy enters real stock counts in the admin panel
}));

const supabase = createClient(url, key);
const BATCH = 500;
let done = 0;
for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase.from('products').upsert(batch, { onConflict: 'id' });
    if (error) {
        console.error(`Batch starting at ${i} failed:`, error.message);
        process.exit(1);
    }
    done += batch.length;
    console.log(`Seeded ${done}/${rows.length}`);
}
console.log('Seed complete.');
