insert into public.admin_config (k, v) values ('announcement', '') on conflict (k) do nothing;
create or replace function public.announcement_get() returns text language sql security definer set search_path = public as $f$
  select coalesce((select v from public.admin_config where k = 'announcement'), '');
$f$;
create or replace function public.admin_announce_set(p_key text, p_text text) returns boolean language plpgsql security definer set search_path = public as $f$
declare expected text;
begin
  select v into expected from public.admin_config where k = 'admin_key';
  if expected is null or p_key is null or p_key <> expected then raise exception 'unauthorized'; end if;
  insert into public.admin_config (k, v) values ('announcement', left(coalesce(p_text,''), 300))
  on conflict (k) do update set v = excluded.v;
  return true;
end $f$;
revoke all on function public.announcement_get() from public;
revoke all on function public.admin_announce_set(text,text) from public;
grant execute on function public.announcement_get() to anon, authenticated;
grant execute on function public.admin_announce_set(text,text) to anon, authenticated;
