create table if not exists public.product_photos (id text primary key, data text not null, updated_at timestamptz not null default now());
alter table public.product_photos enable row level security;
create or replace function public.photo_ids() returns text language sql security definer set search_path = public as $f$
  select coalesce(string_agg(id, ','), '') from public.product_photos;
$f$;
create or replace function public.photos_get(p_ids text) returns jsonb language sql security definer set search_path = public as $f$
  select coalesce(jsonb_object_agg(id, data), '{}'::jsonb) from public.product_photos
  where id = any ((select (string_to_array(left(coalesce(p_ids,''), 600), ','))[1:30])::text[]);
$f$;
create or replace function public.admin_photo_set(p_key text, p_id text, p_data text) returns boolean language plpgsql security definer set search_path = public as $f$
declare expected text;
begin
  select v into expected from public.admin_config where k = 'admin_key';
  if expected is null or p_key is null or p_key <> expected then raise exception 'unauthorized'; end if;
  if p_id is null or p_id !~ '^[A-Za-z0-9_-]{1,20}$' then raise exception 'bad id'; end if;
  if coalesce(p_data,'') = '' then
    delete from public.product_photos where id = p_id;
    return true;
  end if;
  if length(p_data) > 150000 or p_data !~ '^data:image/(webp|jpeg);base64,[A-Za-z0-9+/=]+$' then raise exception 'bad image'; end if;
  insert into public.product_photos (id, data) values (p_id, p_data)
  on conflict (id) do update set data = excluded.data, updated_at = now();
  return true;
end $f$;
revoke all on function public.photo_ids() from public;
revoke all on function public.photos_get(text) from public;
revoke all on function public.admin_photo_set(text,text,text) from public;
grant execute on function public.photo_ids() to anon, authenticated;
grant execute on function public.photos_get(text) to anon, authenticated;
grant execute on function public.admin_photo_set(text,text,text) to anon, authenticated;
