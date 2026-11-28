insert into public.admin_config (k, v) values ('offers', '[]') on conflict (k) do nothing;
create or replace function public.offers_get() returns text language sql security definer set search_path = public as $f$
  select coalesce((select v from public.admin_config where k = 'offers'), '[]');
$f$;
create or replace function public.admin_offers_set(p_key text, p_val text) returns boolean language plpgsql security definer set search_path = public as $f$
declare expected text;
begin
  select v into expected from public.admin_config where k = 'admin_key';
  if expected is null or p_key is null or p_key <> expected then raise exception 'unauthorized'; end if;
  if length(coalesce(p_val,'')) > 2000000 then raise exception 'too long'; end if;
  if jsonb_typeof(coalesce(p_val,'[]')::jsonb) <> 'array' then raise exception 'bad value'; end if;
  insert into public.admin_config (k, v) values ('offers', coalesce(p_val,'[]'))
  on conflict (k) do update set v = excluded.v;
  return true;
end $f$;
revoke all on function public.offers_get() from public;
revoke all on function public.admin_offers_set(text,text) from public;
grant execute on function public.offers_get() to anon, authenticated;
grant execute on function public.admin_offers_set(text,text) to anon, authenticated;
