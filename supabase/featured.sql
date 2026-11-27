insert into public.admin_config (k, v) values ('featured', '') on conflict (k) do nothing;
create or replace function public.featured_get() returns text language sql security definer set search_path = public as $f$
  select coalesce((select v from public.admin_config where k = 'featured'), '');
$f$;
create or replace function public.admin_featured_set(p_key text, p_ids text) returns boolean language plpgsql security definer set search_path = public as $f$
declare expected text;
begin
  select v into expected from public.admin_config where k = 'admin_key';
  if expected is null or p_key is null or p_key <> expected then raise exception 'unauthorized'; end if;
  if length(coalesce(p_ids,'')) > 3000 or coalesce(p_ids,'') !~ '^[A-Za-z0-9_,-]*$' then raise exception 'bad ids'; end if;
  insert into public.admin_config (k, v) values ('featured', coalesce(p_ids,''))
  on conflict (k) do update set v = excluded.v;
  return true;
end $f$;
revoke all on function public.featured_get() from public;
revoke all on function public.admin_featured_set(text,text) from public;
grant execute on function public.featured_get() to anon, authenticated;
grant execute on function public.admin_featured_set(text,text) to anon, authenticated;
