import { supabase, SUPABASE_READY } from './supabase';

export { SUPABASE_READY };

export type OrderItem = { id: string; name: string; qty: number; price: number };

export type OrderRow = {
    id: number;
    created_at: string;
    customer_name: string;
    phone: string;
    address: string;
    payment: string;
    items: OrderItem[];
    total: number;
    status: 'new' | 'prep' | 'out' | 'done';
};

export type RxRow = {
    id: number;
    created_at: string;
    phone: string;
    photo_path: string;
    photo_url: string | null;
    want_substitutes: boolean;
    want_call: boolean;
    notes: string;
    status: 'new' | 'done';
};

// Place a customer order. Returns the backend order id, or null when the
// backend is not configured (local fallback in the UI).
export async function placeOrder(input: {
    customer_name: string;
    phone: string;
    address: string;
    payment: string;
    items: OrderItem[];
    total: number;
}): Promise<number | null> {
    if (!supabase) return null;
    const { data, error } = await supabase.rpc('place_order', { p_name: input.customer_name, p_phone: input.phone, p_address: input.address, p_payment: input.payment, p_items: input.items, p_total: input.total });
    if (error) throw new Error(error.message);
    return Number(data);
}

// Shrink the photo in the browser so it uploads fast on mobile data.
async function toDataUrl(file: File): Promise<string> {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.72);
}

// Submit a prescription: the photo is stored in the private prescriptions table
// (no public read access); only the admin key can read it back.
export async function submitRx(input: {
    phone: string;
    file: File;
    want_substitutes: boolean;
    want_call: boolean;
    notes: string;
}): Promise<void> {
    if (!supabase) return; // local fallback: UI just shows the success screen
    const photo = await toDataUrl(input.file);
    const { error } = await supabase.rpc('submit_rx', {
        p_phone: input.phone,
        p_photo: photo,
        p_alt: input.want_substitutes,
        p_call: input.want_call,
        p_notes: input.notes,
    });
    if (error) throw new Error(error.message);
}

// Prices the pharmacy edited from the admin panel (the bundled catalog has the originals).
export async function loadPriceOverrides(): Promise<{ id: string; price: number }[]> {
    if (!supabase) return [];
    const { data, error } = await supabase.from('products').select('id,sell_price').eq('edited', true).limit(5000);
    if (error || !data) return [];
    return data.map((r) => ({ id: String(r.id), price: Number(r.sell_price) }));
}

// Admin calls go through the admin_api SQL function; the key is checked server-side.
export async function adminCall<T = unknown>(key: string, action: string, payload: Record<string, unknown> = {}): Promise<T> {
    if (!supabase) throw new Error('backend not configured');
    const { data, error } = await supabase.rpc('admin_api', { p_key: key, p_action: action, p_payload: payload });
    if (error) throw new Error(/unauthorized/i.test(error.message) ? 'unauthorized' : error.message);
    return data as T;
}

export function fmtTime(iso: string): string {
    const d = new Date(iso);
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).replace('AM', 'ص').replace('PM', 'م');
    const day = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    return `${day} — ${time}`;
}
