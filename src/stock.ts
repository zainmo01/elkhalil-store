// Stock overlay: the pharmacy's current in-stock list (id, sell price). Read live from the database; the bundled catalog
// is only the fallback. Never reads or stores cost columns.
import { supabase } from './lib/supabase';
export type StockRow = [string, number] | [string, number, string, number];
export const STOCK: { rows: StockRow[] | null } = { rows: (() => { try { const v = JSON.parse(localStorage.getItem('kh_stock') ?? 'null'); return Array.isArray(v) && v.length > 0 ? v : null; } catch { return null; } })() };
export async function getStock(): Promise<StockRow[] | null> {
    if (!supabase) return null;
    const { data, error } = await supabase.rpc('stock_get');
    if (error || typeof data !== 'string' || data === '') return null;
    try { const v = JSON.parse(data); if (Array.isArray(v) && v.length > 0) { STOCK.rows = v; try { localStorage.setItem('kh_stock', data); } catch { /* ignore */ } return v; } } catch { /* ignore */ }
    return null;
}

export type ReportRow = { code: string; name: string; sell: number; qty: number };
// Reads the e-Stock "تقرير أصناف مخازن موجز" export (.xls). Fixed layout: code col 31, name col 21, sell price col 8, quantity col 13.
export async function parseReport(buf: ArrayBuffer): Promise<ReportRow[]> {
    const X = await import('xlsx');
    const wb = X.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = X.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', raw: true });
    const head = rows.slice(0, 8).flat().map((x) => String(x));
    if (!head.some((h) => h.includes('تقرير أصناف'))) throw new Error('الملف مش تقرير أصناف المخازن بتاع e-Stock');
    const seen = new Set<string>();
    const out: ReportRow[] = [];
    for (let r = 9; r < rows.length; r++) {
        const v = rows[r] as unknown[];
        if (!v || v[31] === '' || v[31] === undefined || v[21] === '' || v[21] === undefined) continue;
        const code = String(Math.round(Number(v[31])));
        const sell = Number(v[8]);
        const qty = Number(v[13]);
        if (!/^\d+$/.test(code) || !isFinite(sell) || !isFinite(qty) || seen.has(code)) continue;
        if (!(sell > 0) || !(qty > 0)) continue;
        seen.add(code);
        out.push({ code, name: String(v[21]).trim(), sell: Math.round(sell * 100) / 100, qty });
    }
    if (out.length === 0) throw new Error('مفيش أصناف في الملف');
    return out;
}

// Rough category guess for items the catalog doesn't have yet (the pharmacist can fix them later).
export function guessCat(name: string): number {
    const n = name.toLowerCase();
    const has = (ws: string[]) => ws.some((w) => n.includes(w));
    if (has(['قرص', 'اقراص', 'كبسول', 'حقن', 'امبول', 'شراب', 'مجم', ' mg', 'tab', 'caps', 'inj', 'amp', 'لبوس', 'نقط', 'قطره', 'مرهم'])) return 0;
    if (has(['فيتامين', 'vitamin', 'اوميجا', 'omega', 'كالسيوم', 'زنك', 'مكمل', 'ماجنسيوم', 'كولاجين'])) return 2;
    if (has(['بيبي', 'baby', 'اطفال', 'طفل', 'حفاض', 'رضاع', 'رضع'])) return 3;
    if (has(['جهاز', 'ترمومتر', 'سماعه', 'سماعة', 'ضغط', 'نبولايزر', 'سكر'])) return 4;
    if (has(['شامبو', 'كريم', 'سيروم', 'صابون', 'معجون', 'غسول', 'لوشن', 'مرطب', 'عطر', 'ماسك', 'روج', 'مكياج', 'شاور', 'بلسم', 'مزيل', 'تونر', 'deod', 'serum', 'cream', 'shampoo'])) return 1;
    return 0;
}
