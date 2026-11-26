create table if not exists public.carts (phone text primary key, items jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now());
alter table public.carts enable row level security;
create table if not exists public.loyalty_ledger (id bigserial primary key, phone text not null, delta int not null, reason text not null, order_id bigint, created_at timestamptz not null default now());
create index if not exists loyalty_ledger_phone on public.loyalty_ledger(phone);
alter table public.loyalty_ledger enable row level security;
alter table public.orders add column if not exists loyalty_phone text;
alter table public.orders add column if not exists points_redeemed int not null default 0;
alter table public.orders add column if not exists discount numeric(10,2) not null default 0;
alter table public.orders add column if not exists points_awarded boolean not null default false;
insert into public.admin_config (k, v) values ('earn_per', '10') on conflict (k) do nothing;
insert into public.admin_config (k, v) values ('point_value', '0.5') on conflict (k) do nothing;

create or replace function public.cart_get(p_phone text) returns jsonb language sql security definer set search_path = public as $f$
  select coalesce((select items from public.carts where phone = p_phone), '{}'::jsonb);
$f$;
create or replace function public.cart_set(p_phone text, p_items jsonb) returns boolean language plpgsql security definer set search_path = public as $f$
begin
  if p_phone !~ '^[0-9]{10,15}$' or jsonb_typeof(p_items) <> 'object' or length(p_items::text) > 20000 then return false; end if;
  insert into public.carts (phone, items, updated_at) values (p_phone, p_items, now())
  on conflict (phone) do update set items = excluded.items, updated_at = now();
  return true;
end $f$;

create or replace function public.loyalty_info(p_phone text) returns jsonb language plpgsql security definer set search_path = public as $f$
declare bal int; ep numeric; pv numeric; hist jsonb;
begin
  select coalesce(sum(delta),0) into bal from public.loyalty_ledger where phone = p_phone;
  select v::numeric into ep from public.admin_config where k = 'earn_per';
  select v::numeric into pv from public.admin_config where k = 'point_value';
  select coalesce(jsonb_agg(h), '[]'::jsonb) into hist from (select delta, reason, order_id, created_at from public.loyalty_ledger where phone = p_phone order by id desc limit 20) h;
  return jsonb_build_object('balance', bal, 'earn_per', coalesce(ep,10), 'point_value', coalesce(pv,0.5), 'history', hist);
end $f$;

create or replace function public.place_order2(p_name text, p_phone text, p_address text, p_payment text, p_items jsonb, p_total numeric, p_account text, p_redeem int)
returns jsonb language plpgsql security definer set search_path = public as $f$
declare bal int; pv numeric; red int := 0; disc numeric := 0; oid bigint;
begin
  if p_account is not null and p_account ~ '^[0-9]{10,15}$' and coalesce(p_redeem,0) > 0 then
    select coalesce(sum(delta),0) into bal from public.loyalty_ledger where phone = p_account;
    select v::numeric into pv from public.admin_config where k = 'point_value';
    pv := coalesce(pv, 0.5);
    if pv > 0 then
      red := least(p_redeem, bal);
      disc := least(red * pv, p_total);
      red := ceil(disc / pv);
      red := least(red, bal);
      disc := least(red * pv, p_total);
    else red := 0; disc := 0; end if;
  end if;
  insert into public.orders (customer_name, phone, address, payment, items, total, loyalty_phone, points_redeemed, discount)
  values (p_name, p_phone, p_address, p_payment, p_items, p_total - disc, p_account, red, disc) returning id into oid;
  if red > 0 then
    insert into public.loyalty_ledger (phone, delta, reason, order_id) values (p_account, -red, 'redeem', oid);
  end if;
  return jsonb_build_object('id', oid, 'redeemed', red, 'discount', disc, 'total', p_total - disc);
end $f$;

create or replace function public.orders_award_points() returns trigger language plpgsql security definer set search_path = public as $f$
declare ep numeric; pts int;
begin
  if new.status = 'done' and old.status is distinct from 'done' and not new.points_awarded and new.loyalty_phone is not null then
    select v::numeric into ep from public.admin_config where k = 'earn_per';
    ep := coalesce(nullif(ep,0), 10);
    pts := floor(new.total / ep);
    if pts > 0 then
      insert into public.loyalty_ledger (phone, delta, reason, order_id) values (new.loyalty_phone, pts, 'earn', new.id);
    end if;
    new.points_awarded := true;
  end if;
  return new;
end $f$;
drop trigger if exists trg_orders_award on public.orders;
create trigger trg_orders_award before update on public.orders for each row execute function public.orders_award_points();

create or replace function public.admin_loyalty(p_key text) returns jsonb language plpgsql security definer set search_path = public as $f$
declare expected text; ep text; pv text; cust jsonb;
begin
  select v into expected from public.admin_config where k = 'admin_key';
  if expected is null or p_key is null or p_key <> expected then raise exception 'unauthorized'; end if;
  select v into ep from public.admin_config where k = 'earn_per';
  select v into pv from public.admin_config where k = 'point_value';
  select coalesce(jsonb_agg(c order by c.balance desc), '[]'::jsonb) into cust from (
    select l.phone, sum(l.delta)::int as balance, (select count(*) from public.orders o where o.loyalty_phone = l.phone)::int as orders
    from public.loyalty_ledger l group by l.phone limit 500) c;
  return jsonb_build_object('earn_per', ep::numeric, 'point_value', pv::numeric, 'customers', cust);
end $f$;
create or replace function public.admin_loyalty_set(p_key text, p_earn_per numeric, p_point_value numeric) returns boolean language plpgsql security definer set search_path = public as $f$
declare expected text;
begin
  select v into expected from public.admin_config where k = 'admin_key';
  if expected is null or p_key is null or p_key <> expected then raise exception 'unauthorized'; end if;
  if p_earn_per <= 0 or p_point_value < 0 then raise exception 'bad values'; end if;
  update public.admin_config set v = p_earn_per::text where k = 'earn_per';
  update public.admin_config set v = p_point_value::text where k = 'point_value';
  return true;
end $f$;

revoke all on function public.cart_get(text) from public;
revoke all on function public.cart_set(text, jsonb) from public;
revoke all on function public.loyalty_info(text) from public;
revoke all on function public.place_order2(text,text,text,text,jsonb,numeric,text,int) from public;
revoke all on function public.admin_loyalty(text) from public;
revoke all on function public.admin_loyalty_set(text,numeric,numeric) from public;
grant execute on function public.cart_get(text) to anon, authenticated;
grant execute on function public.cart_set(text, jsonb) to anon, authenticated;
grant execute on function public.loyalty_info(text) to anon, authenticated;
grant execute on function public.place_order2(text,text,text,text,jsonb,numeric,text,int) to anon, authenticated;
grant execute on function public.admin_loyalty(text) to anon, authenticated;
grant execute on function public.admin_loyalty_set(text,numeric,numeric) to anon, authenticated;
