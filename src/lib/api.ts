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
    const { data, error } = await supabase.from('orders').insert(input).select('id').single();
    if (error) throw new Error(error.message);
    return data.id as number;
}

// Submit a prescription: photo to private storage, row to prescriptions.
export async function submitRx(input: {
    phone: string;
    file: File;
    want_substitutes: boolean;
    want_call: boolean;
    notes: string;
}): Promise<void> {
    if (!supabase) return; // local fallback: UI just shows the success screen
    const ext = (input.file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const { error: upErr } = await supabase.storage.from('rx-photos').upload(path, input.file, {
        contentType: input.file.type || 'image/jpeg',
    });
    if (upErr) throw new Error(upErr.message);
    const { error } = await supabase.from('prescriptions').insert({
        phone: input.phone,
        photo_path: path,
        want_substitutes: input.want_substitutes,
        want_call: input.want_call,
        notes: input.notes,
    });
    if (error) throw new Error(error.message);
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
