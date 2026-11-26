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

export type NotifRow = { id: number; title: string; body: string; created_at: string };

export async function loadNotifications(): Promise<NotifRow[]> {
    if (!supabase) return [];
    const { data, error } = await supabase.from('notifications').select('id,title,body,created_at').order('id', { ascending: false }).limit(50);
    if (error || !data) return [];
    return data.map((r) => ({ id: Number(r.id), title: String(r.title), body: String(r.body ?? ''), created_at: String(r.created_at) }));
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
    if (action === 'loyalty-get' || action === 'loyalty-set') {
        const r = action === 'loyalty-get'
            ? await supabase.rpc('admin_loyalty', { p_key: key })
            : await supabase.rpc('admin_loyalty_set', { p_key: key, p_earn_per: Number(payload.earn_per), p_point_value: Number(payload.point_value) });
        if (r.error) throw new Error(/unauthorized/i.test(r.error.message) ? 'unauthorized' : r.error.message);
        return r.data as T;
    }
    if (action === 'publish-notification' || action === 'delete-notification') {
        const r = action === 'publish-notification'
            ? await supabase.rpc('admin_notify', { p_key: key, p_title: String(payload.title ?? ''), p_body: String(payload.body ?? '') })
            : await supabase.rpc('admin_notify_delete', { p_key: key, p_id: Number(payload.id) });
        if (r.error) throw new Error(/unauthorized/i.test(r.error.message) ? 'unauthorized' : r.error.message);
        return r.data as T;
    }
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

export type LoyaltyInfo = { balance: number; earn_per: number; point_value: number; history: { delta: number; reason: string; order_id: number | null; created_at: string }[] };

export async function loadCart(phone: string): Promise<Record<string, number>> {
    if (!supabase) return {};
    const { data, error } = await supabase.rpc('cart_get', { p_phone: phone });
    if (error) throw new Error(error.message);
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries((data ?? {}) as Record<string, unknown>)) { const n = Number(v); if (n > 0) out[k] = n; }
    return out;
}

export async function saveCart(phone: string, cart: Record<string, number>): Promise<void> {
    if (!supabase) return;
    await supabase.rpc('cart_set', { p_phone: phone, p_items: cart });
}

export async function loyaltyInfo(phone: string): Promise<LoyaltyInfo | null> {
    if (!supabase) return null;
    const { data, error } = await supabase.rpc('loyalty_info', { p_phone: phone });
    if (error || !data) return null;
    return data as LoyaltyInfo;
}

export async function placeOrder2(input: {
    customer_name: string; phone: string; address: string; payment: string; items: OrderItem[]; total: number; account: string; redeem: number;
}): Promise<{ id: number; redeemed: number; discount: number; total: number } | null> {
    if (!supabase) return null;
    const { data, error } = await supabase.rpc('place_order2', { p_name: input.customer_name, p_phone: input.phone, p_address: input.address, p_payment: input.payment, p_items: input.items, p_total: input.total, p_account: input.account, p_redeem: input.redeem });
    if (error) throw new Error(error.message);
    return data as { id: number; redeemed: number; discount: number; total: number };
}
