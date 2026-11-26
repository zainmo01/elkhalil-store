alter table public.prescriptions add column if not exists req text;
create unique index if not exists prescriptions_req_uq on public.prescriptions(req) where req is not null;
create or replace function public.submit_rx2(p_phone text, p_photo text, p_alt boolean, p_call boolean, p_notes text, p_req text)
returns bigint language plpgsql security definer set search_path = public as $f$
declare nid bigint;
begin
  if p_req is not null and length(p_req) between 8 and 80 then
    select id into nid from public.prescriptions where req = p_req;
    if nid is not null then return nid; end if;
  else p_req := null; end if;
  if p_photo is null or length(p_photo) < 100 or length(p_photo) > 3000000 or left(p_photo, 11) <> 'data:image/' then
    raise exception 'bad photo';
  end if;
  insert into public.prescriptions (phone, photo_path, photo_data, want_substitutes, want_call, notes, req)
  values (p_phone, '', p_photo, coalesce(p_alt, true), coalesce(p_call, false), coalesce(left(p_notes, 1000), ''), p_req)
  on conflict (req) where req is not null do nothing
  returning id into nid;
  if nid is null then select id into nid from public.prescriptions where req = p_req; end if;
  return nid;
end $f$;
revoke all on function public.submit_rx2(text,text,boolean,boolean,text,text) from public;
grant execute on function public.submit_rx2(text,text,boolean,boolean,text,text) to anon, authenticated;
