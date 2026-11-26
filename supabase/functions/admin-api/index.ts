// Admin API edge function — El-Khalil store
// Protects pharmacy-side reads/writes with a shared admin key.
// Set the secret once:  supabase secrets set ADMIN_KEY=<choose-a-strong-key>
// The admin panel asks for this key once and keeps it on the device.
//
// Actions (POST JSON { action, ... } with header x-admin-key):
//   { action: "list-orders", status? }        -> latest 200 orders
//   { action: "set-order-status", id, status }
//   { action: "list-rx" }                     -> latest 100 prescriptions + signed photo URLs
//   { action: "set-rx-status", id, status }
//   { action: "save-product", id, price, stock }
//   { action: "stats" }                       -> counts + today's revenue
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-key',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

    const adminKey = req.headers.get('x-admin-key');
    const expected = Deno.env.get('ADMIN_KEY');
    if (!expected || adminKey !== expected) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), {
            status: 401,
            headers: { ...cors, 'Content-Type': 'application/json' },
        });
    }

    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json().catch(() => ({}));
    const json = (data: unknown) =>
        new Response(JSON.stringify(data), { headers: { ...cors, 'Content-Type': 'application/json' } });

    switch (body.action) {
        case 'list-orders': {
            let q = supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(200);
            if (body.status) q = q.eq('status', body.status);
            const { data, error } = await q;
            return error ? json({ error: error.message }) : json({ orders: data });
        }
        case 'set-order-status': {
            const { error } = await supabase.from('orders').update({ status: body.status }).eq('id', body.id);
            return error ? json({ error: error.message }) : json({ ok: true });
        }
        case 'list-rx': {
            const { data, error } = await supabase
                .from('prescriptions')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);
            if (error) return json({ error: error.message });
            const withUrls = await Promise.all(
                (data ?? []).map(async (rx) => {
                    const { data: signed } = await supabase.storage
                        .from('rx-photos')
                        .createSignedUrl(rx.photo_path, 3600);
                    return { ...rx, photo_url: signed?.signedUrl ?? null };
                })
            );
            return json({ prescriptions: withUrls });
        }
        case 'set-rx-status': {
            const { error } = await supabase.from('prescriptions').update({ status: body.status }).eq('id', body.id);
            return error ? json({ error: error.message }) : json({ ok: true });
        }
        case 'add-product': {
            const { error } = await supabase
                .from('products')
                .insert({ id: `x${Date.now()}`, name: body.name, category: body.category, sell_price: body.price, stock: body.stock });
            return error ? json({ error: error.message }) : json({ ok: true });
        }
        case 'save-product': {
            const { error } = await supabase
                .from('products')
                .update({ sell_price: body.price, stock: body.stock })
                .eq('id', body.id);
            return error ? json({ error: error.message }) : json({ ok: true });
        }
        case 'stats': {
            const { count: products } = await supabase.from('products').select('*', { count: 'exact', head: true });
            const { count: orders } = await supabase.from('orders').select('*', { count: 'exact', head: true });
            const { count: rx } = await supabase.from('prescriptions').select('*', { count: 'exact', head: true });
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const { data: todayOrders } = await supabase
                .from('orders')
                .select('total')
                .gte('created_at', today.toISOString());
            const revenue = (todayOrders ?? []).reduce((s, o) => s + Number(o.total), 0);
            return json({ products, orders, prescriptions: rx, today_revenue: revenue });
        }
        default:
            return json({ error: 'unknown action' });
    }
});
