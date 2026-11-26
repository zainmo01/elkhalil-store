alter table public.orders add column if not exists driver_phone text;
create or replace function public.my_orders(p_phone text) returns jsonb language plpgsql security definer set search_path = public as $f$
begin
  if p_phone is null or p_phone !~ '^[0-9]{10,15}$' then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(o) from (select id, status, driver_phone, total, payment, created_at, items from public.orders where phone = p_phone or loyalty_phone = p_phone order by id desc limit 30) o), '[]'::jsonb);
end $f$;
create or replace function public.admin_order_driver_get(p_key text, p_id bigint) returns text language plpgsql security definer set search_path = public as $f$
declare expected text; d text;
begin
  select v into expected from public.admin_config where k = 'admin_key';
  if expected is null or p_key is null or p_key <> expected then raise exception 'unauthorized'; end if;
  select driver_phone into d from public.orders where id = p_id;
  return d;
end $f$;
create or replace function public.admin_order_driver_set(p_key text, p_id bigint, p_driver text) returns boolean language plpgsql security definer set search_path = public as $f$
declare expected text; d text;
begin
  select v into expected from public.admin_config where k = 'admin_key';
  if expected is null or p_key is null or p_key <> expected then raise exception 'unauthorized'; end if;
  d := nullif(regexp_replace(coalesce(p_driver,''), '[^0-9+]', '', 'g'), '');
  update public.orders set driver_phone = d where id = p_id;
  return true;
end $f$;
revoke all on function public.my_orders(text) from public;
revoke all on function public.admin_order_driver_get(text,bigint) from public;
revoke all on function public.admin_order_driver_set(text,bigint,text) from public;
grant execute on function public.my_orders(text) to anon, authenticated;
grant execute on function public.admin_order_driver_get(text,bigint) to anon, authenticated;
grant execute on function public.admin_order_driver_set(text,bigint,text) to anon, authenticated;
