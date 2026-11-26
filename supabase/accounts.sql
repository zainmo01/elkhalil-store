create extension if not exists pgcrypto with schema extensions;
create table if not exists public.accounts (phone text primary key, pw_hash text not null, fails int not null default 0, locked_until timestamptz, created_at timestamptz not null default now());
alter table public.accounts enable row level security;
create or replace function public.account_status(p_phone text) returns text language plpgsql security definer set search_path = public, extensions as $f$
begin
  if p_phone is null or p_phone !~ '^[0-9]{10,15}$' then return 'bad'; end if;
  if exists (select 1 from public.accounts where phone = p_phone) then return 'has'; end if;
  if exists (select 1 from public.orders where phone = p_phone or loyalty_phone = p_phone)
     or exists (select 1 from public.carts where phone = p_phone)
     or exists (select 1 from public.loyalty_ledger where phone = p_phone) then return 'legacy'; end if;
  return 'none';
end $f$;
create or replace function public.account_register(p_phone text, p_pass text) returns text language plpgsql security definer set search_path = public, extensions as $f$
begin
  if p_phone is null or p_phone !~ '^[0-9]{10,15}$' or p_phone = '01000000000' then return 'bad'; end if;
  if p_pass is null or length(p_pass) < 6 or length(p_pass) > 72 then return 'weak'; end if;
  if exists (select 1 from public.accounts where phone = p_phone) then return 'exists'; end if;
  insert into public.accounts (phone, pw_hash) values (p_phone, crypt(p_pass, gen_salt('bf')));
  return 'ok';
end $f$;
create or replace function public.account_login(p_phone text, p_pass text) returns text language plpgsql security definer set search_path = public, extensions as $f$
declare a public.accounts;
begin
  select * into a from public.accounts where phone = p_phone;
  if not found then return 'none'; end if;
  if a.locked_until is not null and a.locked_until > now() then return 'locked'; end if;
  if a.pw_hash = crypt(coalesce(p_pass,''), a.pw_hash) then
    update public.accounts set fails = 0, locked_until = null where phone = p_phone;
    return 'ok';
  end if;
  update public.accounts set fails = fails + 1, locked_until = case when fails + 1 >= 5 then now() + interval '5 minutes' else null end where phone = p_phone;
  if a.fails + 1 >= 5 then update public.accounts set fails = 0 where phone = p_phone; end if;
  return 'wrong';
end $f$;
revoke all on function public.account_status(text) from public;
revoke all on function public.account_register(text,text) from public;
revoke all on function public.account_login(text,text) from public;
grant execute on function public.account_status(text) to anon, authenticated;
grant execute on function public.account_register(text,text) to anon, authenticated;
grant execute on function public.account_login(text,text) to anon, authenticated;
