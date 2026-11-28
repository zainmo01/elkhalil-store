-- Stock overlay: rows [id, sell_price] (+ [id, price, name, category] for items the catalog doesn't have yet).
-- Public read of the current stock list; admin-only write with sanity checks, last-10 history and one-click revert.
insert into public.admin_config (k, v) values ('stock', '') on conflict (k) do nothing;
create or replace function public.stock_get() returns text language sql security definer set search_path = public as $f$
  select coalesce((select v from public.admin_config where k = 'stock'), '');
$f$;
create or replace function public.admin_stock_set(p_key text, p_val text, p_force boolean default false) returns text language plpgsql security definer set search_path = public as $f$
declare expected text; newn int; oldv text; oldn int; v_k text; j jsonb;
begin
  select v into expected from public.admin_config where k = 'admin_key';
  if expected is null or p_key is null or p_key <> expected then raise exception 'unauthorized'; end if;
  if length(coalesce(p_val,'')) > 3000000 then raise exception 'rejected: file too large'; end if;
  j := coalesce(p_val,'[]')::jsonb;
  if jsonb_typeof(j) <> 'array' then raise exception 'rejected: bad format'; end if;
  newn := jsonb_array_length(j);
  select v into oldv from public.admin_config where k = 'stock';
  oldn := case when oldv is null or oldv = '' then 0 else jsonb_array_length(oldv::jsonb) end;
  if newn < 500 then
    insert into public.admin_config (k, v) values ('stock_alert', json_build_object('t', now(), 'reason', 'too few rows', 'n', newn)::text) on conflict (k) do update set v = excluded.v;
    return 'rejected: too few rows (' || newn || ')';
  end if;
  if not coalesce(p_force,false) and oldn > 0 and (newn < oldn * 0.8 or newn > oldn * 1.5) then
    insert into public.admin_config (k, v) values ('stock_alert', json_build_object('t', now(), 'reason', 'row count changed too much', 'n', newn, 'was', oldn)::text) on conflict (k) do update set v = excluded.v;
    return 'rejected: row count changed too much (' || oldn || ' -> ' || newn || ')';
  end if;
  if oldn > 0 then
    v_k := lpad((extract(epoch from now())::bigint)::text, 10, '0');
    insert into public.admin_config (k, v) values ('stock_h_' || v_k, oldv) on conflict (k) do update set v = excluded.v;
    delete from public.admin_config where k like 'stock_h\_%' and k not in (select k from public.admin_config where k like 'stock_h\_%' order by k desc limit 10);
  end if;
  insert into public.admin_config (k, v) values ('stock', p_val) on conflict (k) do update set v = excluded.v;
  insert into public.admin_config (k, v) values ('stock_meta', json_build_object('t', now(), 'n', newn)::text) on conflict (k) do update set v = excluded.v;
  delete from public.admin_config where k = 'stock_alert';
  return json_build_object('n', newn, 'was', oldn)::text;
end $f$;
create or replace function public.admin_stock_hist(p_key text) returns text language plpgsql security definer set search_path = public as $f$
declare expected text;
begin
  select v into expected from public.admin_config where k = 'admin_key';
  if expected is null or p_key is null or p_key <> expected then raise exception 'unauthorized'; end if;
  return json_build_object(
    'meta', (select v from public.admin_config where k = 'stock_meta'),
    'alert', (select v from public.admin_config where k = 'stock_alert'),
    'hist', coalesce((select json_agg(json_build_object('k', substr(k, 9), 'n', jsonb_array_length(v::jsonb)) order by k desc) from public.admin_config where k like 'stock_h\_%' and v <> ''), '[]'::json)
  )::text;
end $f$;
create or replace function public.admin_stock_revert(p_key text, p_k text) returns text language plpgsql security definer set search_path = public as $f$
declare expected text; snap text; oldv text; v_k text; n int;
begin
  select v into expected from public.admin_config where k = 'admin_key';
  if expected is null or p_key is null or p_key <> expected then raise exception 'unauthorized'; end if;
  select v into snap from public.admin_config where k = 'stock_h_' || p_k;
  if snap is null or snap = '' then raise exception 'not found'; end if;
  select v into oldv from public.admin_config where k = 'stock';
  if oldv is not null and oldv <> '' then
    v_k := lpad((extract(epoch from now())::bigint)::text, 10, '0');
    insert into public.admin_config (k, v) values ('stock_h_' || v_k, oldv) on conflict (k) do update set v = excluded.v;
  end if;
  n := jsonb_array_length(snap::jsonb);
  insert into public.admin_config (k, v) values ('stock', snap) on conflict (k) do update set v = excluded.v;
  insert into public.admin_config (k, v) values ('stock_meta', json_build_object('t', now(), 'n', n)::text) on conflict (k) do update set v = excluded.v;
  delete from public.admin_config where k like 'stock_h\_%' and k not in (select k from public.admin_config where k like 'stock_h\_%' order by k desc limit 10);
  return json_build_object('n', n)::text;
end $f$;
revoke all on function public.stock_get() from public;
revoke all on function public.admin_stock_set(text,text,boolean) from public;
revoke all on function public.admin_stock_hist(text) from public;
revoke all on function public.admin_stock_revert(text,text) from public;
grant execute on function public.stock_get() to anon, authenticated;
grant execute on function public.admin_stock_set(text,text,boolean) to anon, authenticated;
grant execute on function public.admin_stock_hist(text) to anon, authenticated;
grant execute on function public.admin_stock_revert(text,text) to anon, authenticated;
