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
    const draw = (src: CanvasImageSource, w: number, h: number) => {
        const scale = Math.min(1, 1400 / Math.max(w, h));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w * scale));
        c.height = Math.max(1, Math.round(h * scale));
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(src, 0, 0, c.width, c.height);
        const out = c.toDataURL('image/jpeg', 0.72);
        if (!out.startsWith('data:image/jpeg')) throw new Error('encode');
        return out;
    };
    // 1) fast path
    try {
        const bmp = await createImageBitmap(file);
        return draw(bmp, bmp.width, bmp.height);
    } catch { /* try next */ }
    // 2) <img> decode (works in WebViews / formats createImageBitmap refuses)
    try {
        const url = URL.createObjectURL(file);
        try {
            const img = new Image();
            img.src = url;
            await img.decode();
            return draw(img, img.naturalWidth, img.naturalHeight);
        } finally { URL.revokeObjectURL(url); }
    } catch { /* try next */ }
    // 3) send the original if it is small enough for the server
    if (file.size <= 2_000_000) {
        const raw = await new Promise<string>((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(String(r.result));
            r.onerror = () => rej(new Error('read'));
            r.readAsDataURL(file);
        });
        if (raw.startsWith('data:image/')) return raw;
    }
    throw new Error('bad photo');
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
    const photo = await Promise.race([
        toDataUrl(input.file),
        new Promise<string>((_, rej) => setTimeout(() => rej(new Error('compress timeout')), 20000)),
    ]);
    // One request id per submission: if the answer is lost and we retry, the server returns the same row instead of a duplicate.
    const req = `rx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    let lastErr: Error = new Error('failed');
    for (let attempt = 0; attempt < 3; attempt++) {
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 25000);
        try {
            const { error } = await supabase.rpc('submit_rx2', {
                p_phone: input.phone,
                p_photo: photo,
                p_alt: input.want_substitutes,
                p_call: input.want_call,
                p_notes: input.notes,
                p_req: req,
            }).abortSignal(ctl.signal);
            clearTimeout(timer);
            if (!error) return;
            if (/bad photo/i.test(error.message)) throw new Error(error.message);
            lastErr = new Error(error.message);
        } catch (e) {
            clearTimeout(timer);
            lastErr = e instanceof Error ? e : new Error('failed');
            if (/bad photo/i.test(lastErr.message)) throw lastErr;
        }
    }
    throw lastErr;
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
    if (action === 'offers-set') {
        const r = await supabase.rpc('admin_offers_set', { p_key: key, p_val: JSON.stringify(payload.list ?? []) });
        if (r.error) throw new Error(/unauthorized/i.test(r.error.message) ? 'unauthorized' : r.error.message);
        return r.data as T;
    }
    if (action === 'featured-set') {
        const r = await supabase.rpc('admin_featured_set', { p_key: key, p_ids: (payload.ids as string[]).join(',') });
        if (r.error) throw new Error(/unauthorized/i.test(r.error.message) ? 'unauthorized' : r.error.message);
        return r.data as T;
    }
    if (action === 'photo-set') {
        const r = await supabase.rpc('admin_photo_set', { p_key: key, p_id: String(payload.id), p_data: String(payload.data ?? '') });
        if (r.error) throw new Error(/unauthorized/i.test(r.error.message) ? 'unauthorized' : r.error.message);
        return r.data as T;
    }
    if (action === 'announce-set') {
        const r = await supabase.rpc('admin_announce_set', { p_key: key, p_text: String(payload.text ?? '') });
        if (r.error) throw new Error(/unauthorized/i.test(r.error.message) ? 'unauthorized' : r.error.message);
        return r.data as T;
    }
    if (action === 'driver-get' || action === 'driver-set') {
        const r = action === 'driver-get'
            ? await supabase.rpc('admin_order_driver_get', { p_key: key, p_id: Number(payload.id) })
            : await supabase.rpc('admin_order_driver_set', { p_key: key, p_id: Number(payload.id), p_driver: String(payload.driver ?? '') });
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

export type MyOrder = { id: number; status: string; driver_phone: string | null; total: number; payment: string; created_at: string; items: { id?: string; name: string; qty: number }[] };
export async function myOrders(phone: string): Promise<MyOrder[] | null> {
    if (!supabase) return null;
    const { data, error } = await supabase.rpc('my_orders', { p_phone: phone });
    if (error || !Array.isArray(data)) return null;
    return data as MyOrder[];
}

export type AcctStatus = 'none' | 'legacy' | 'has' | 'bad';
export async function accountStatus(phone: string): Promise<AcctStatus> {
    if (!supabase) return 'has';
    const { data, error } = await supabase.rpc('account_status', { p_phone: phone });
    if (error) throw new Error('net');
    return data as AcctStatus;
}
export async function accountRegister(phone: string, pass: string): Promise<string> {
    if (!supabase) return 'ok';
    const { data, error } = await supabase.rpc('account_register', { p_phone: phone, p_pass: pass });
    if (error) throw new Error('net');
    return data as string;
}
export async function accountLogin(phone: string, pass: string): Promise<string> {
    if (!supabase) return 'ok';
    const { data, error } = await supabase.rpc('account_login', { p_phone: phone, p_pass: pass });
    if (error) throw new Error('net');
    return data as string;
}

export async function getAnnouncement(): Promise<string | null> {
    if (!supabase) return null;
    const { data, error } = await supabase.rpc('announcement_get');
    if (error) return null;
    return typeof data === 'string' ? data : '';
}

export type Offer = { i: string; n: string; c: number; p: number; o: number };
export async function getOffers(): Promise<Offer[] | null> {
    if (!supabase) return null;
    const { data, error } = await supabase.rpc('offers_get');
    if (error) return null;
    try {
        const v = JSON.parse(typeof data === 'string' && data !== '' ? data : '[]');
        return Array.isArray(v) ? v.filter((x) => x && typeof x.i === 'string' && Number(x.p) > 0 && Number(x.o) > Number(x.p)).map((x) => ({ i: x.i, n: String(x.n ?? ''), c: Number(x.c) || 0, p: Number(x.p), o: Number(x.o) })) : [];
    } catch { return []; }
}

export async function getFeatured(): Promise<string[] | null> {
    if (!supabase) return null;
    const { data, error } = await supabase.rpc('featured_get');
    if (error) return null;
    return typeof data === 'string' ? data.split(',').map((s) => s.trim()).filter(Boolean) : [];
}

export async function getPhotoIds(): Promise<string[] | null> {
    if (!supabase) return null;
    const { data, error } = await supabase.rpc('photo_ids');
    if (error) return null;
    return typeof data === 'string' ? data.split(',').filter(Boolean) : [];
}

export async function getPhotos(ids: string[]): Promise<Record<string, string> | null> {
    if (!supabase || ids.length === 0) return null;
    const { data, error } = await supabase.rpc('photos_get', { p_ids: ids.join(',') });
    if (error || !data) return null;
    return data as Record<string, string>;
}
