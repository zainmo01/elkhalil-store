-- El-Khalil pharmacy store — Supabase schema
-- Run in the Supabase SQL editor once on the new project.

-- ===== Products (public catalog, sell price only — no margin data) =====
create table if not exists public.products (
    id          text primary key,          -- product id from the pharmacy item file
    name        text not null,
    sell_price  numeric(10,2) not null,
    category    text not null,
    stock       integer not null default 0,
    created_at  timestamptz not null default now()
);

alter table public.products enable row level security;

-- Anyone can browse the catalog.
create policy "products are publicly readable"
    on public.products for select
    using (true);

-- No public writes; stock/price edits go through the admin edge function.
create policy "no public product writes"
    on public.products for all
    using (false);

-- ===== Orders =====
create table if not exists public.orders (
    id          bigint generated always as identity primary key,
    created_at  timestamptz not null default now(),
    customer_name   text not null,
    phone       text not null,
    address     text not null,
    payment     text not null default 'cod',   -- cod | wallet
    items       jsonb not null,                -- [{id, name, qty, price}]
    total       numeric(10,2) not null,
    status      text not null default 'new'    -- new | prep | out | done
);

alter table public.orders enable row level security;

-- Customers can place orders; only the pharmacy (service role) reads them.
create policy "anyone can place an order"
    on public.orders for insert
    with check (true);

create policy "no public order reads"
    on public.orders for select
    using (false);

-- ===== Prescription uploads =====
create table if not exists public.prescriptions (
    id          bigint generated always as identity primary key,
    created_at  timestamptz not null default now(),
    phone       text not null,
    photo_path  text not null,               -- storage object path in rx-photos
    want_substitutes boolean not null default true,
    want_call   boolean not null default false,
    notes       text not null default '',
    status      text not null default 'new'  -- new | confirmed | done
);

alter table public.prescriptions enable row level security;

create policy "anyone can submit a prescription"
    on public.prescriptions for insert
    with check (true);

create policy "no public prescription reads"
    on public.prescriptions for select
    using (false);

-- ===== Storage bucket for prescription photos (private) =====
insert into storage.buckets (id, name, public)
values ('rx-photos', 'rx-photos', false)
on conflict (id) do nothing;

-- Customers can upload a photo; only the pharmacy reads them.
create policy "anyone can upload an rx photo"
    on storage.objects for insert
    with check (bucket_id = 'rx-photos');

create policy "no public rx photo reads"
    on storage.objects for select
    using (false);
