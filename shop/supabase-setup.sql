-- Persimmon Signage Portal — Supabase Schema
-- Run this in Supabase SQL Editor to create the required tables.

-- Orders table
create table psp_orders (
  id            uuid primary key default gen_random_uuid(),
  order_number  text unique not null,
  status        text not null default 'new' check (status in ('new','awaiting_po','in-progress','completed','cancelled')),
  contact_name  text not null,
  email         text not null,
  phone         text not null,
  site_name     text not null,
  site_address  text not null,
  po_number     text,
  notes         text,
  subtotal      numeric(10,2) not null,
  vat           numeric(10,2) not null,
  total         numeric(10,2) not null,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Order items table
create table psp_order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references psp_orders(id) on delete cascade,
  code        text not null,
  base_code   text,
  name        text not null,
  size        text,
  material    text,
  price       numeric(10,2) not null,
  quantity    integer not null check (quantity > 0),
  line_total  numeric(10,2) not null,
  custom_data   jsonb default null
);

-- Indexes for dashboard queries
create index idx_psp_orders_status on psp_orders(status);
create index idx_psp_orders_created_at on psp_orders(created_at desc);
create index idx_psp_order_items_order_id on psp_order_items(order_id);
create index idx_psp_order_items_code on psp_order_items(code);

-- Auto-update updated_at trigger
create or replace function psp_update_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger psp_orders_updated_at
  before update on psp_orders
  for each row execute function psp_update_updated_at();

-- Row Level Security (service role has full access)
alter table psp_orders enable row level security;
alter table psp_order_items enable row level security;

create policy "service_psp_orders" on psp_orders for all using (true) with check (true);
create policy "service_psp_items" on psp_order_items for all using (true) with check (true);

-- Suggestions table
create table psp_suggestions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  message     text not null,
  status      text not null default 'new' check (status in ('new','noted','done','dismissed')),
  created_at  timestamptz default now()
);

create index idx_psp_suggestions_created_at on psp_suggestions(created_at desc);

alter table psp_suggestions enable row level security;
create policy "service_psp_suggestions" on psp_suggestions for all using (true) with check (true);

-- ============================================================
-- Contacts & Sites (added 2026-03-12)
-- ============================================================

create table if not exists psp_contacts (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  email        text not null unique,
  phone        text not null,
  created_at   timestamptz default now()
);

create table if not exists psp_sites (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,
  address      text not null,
  created_at   timestamptz default now()
);

alter table psp_contacts enable row level security;
alter table psp_sites enable row level security;
create policy "service_psp_contacts" on psp_contacts for all using (true) with check (true);
create policy "service_psp_sites" on psp_sites for all using (true) with check (true);

-- Foreign keys on orders (nullable for existing orders)
alter table psp_orders add column if not exists contact_id uuid references psp_contacts(id);
alter table psp_orders add column if not exists site_id uuid references psp_sites(id);
create index if not exists idx_psp_orders_contact_id on psp_orders(contact_id);
create index if not exists idx_psp_orders_site_id on psp_orders(site_id);

-- ============================================================
-- Fulfilment state (added 2026-09-22)
-- ============================================================
--
-- `status` tracks the order as the customer sees it: placed, in progress,
-- delivered. It says nothing about whether the artwork exists yet, so there was
-- no way to ask "what still needs artworking?" — which is the question the pack
-- builder has to answer before it can do anything unattended.
--
-- `fulfilment_status` is that second axis, and only that. The two move
-- independently: an order can be 'completed' for the customer while its artwork
-- was drawn by hand and never recorded here.
--
--   pending      nobody has resolved this order's line items yet
--   resolving    the pack builder is working on it
--   proof_ready  a pack and proof sheet exist, waiting on a human
--   approved     signed off, page by page
--   packed       released to print
--
-- Mirrored in FULFILMENT_STATES in scripts/fulfilment/build_pack.py.

alter table psp_orders add column if not exists fulfilment_status text
  not null default 'pending'
  check (fulfilment_status in ('pending','resolving','proof_ready','approved','packed'));

-- Backfill from what we already know. A delivered order had its artwork made,
-- even though no row records how, so it is 'packed' rather than 'pending' —
-- otherwise the first `build_pack.py --outstanding` run tries to redo all 42 of
-- them. Everything else is genuinely outstanding.
update psp_orders
   set fulfilment_status = case when status = 'completed' then 'packed' else 'pending' end
 where fulfilment_status = 'pending';

create index if not exists idx_psp_orders_fulfilment_status
  on psp_orders(fulfilment_status);

-- ============================================================
-- Artwork proofs and approval (added 2026-09-22)
-- ============================================================
--
-- Admin-side only. Nothing here is read by any customer-facing route: the
-- shop, checkout, order confirmation and the customer's own order view are
-- untouched, and a Persimmon buyer sees exactly what they saw before.
--
-- Deliberately NOT columns on psp_orders. The admin orders API does
-- `select("*")` across every order, so a base64 pack PDF added there would be
-- pulled into memory on every admin page load. Separate tables keep that query
-- the size it is today.

create table if not exists psp_artwork_packs (
  order_number     text primary key,
  built_at         timestamptz not null default now(),
  line_items       integer not null,
  pages_packed     integer not null,
  needs_attention  jsonb not null default '[]'::jsonb,
  manifest         jsonb not null,
  pack_filename    text,
  pack_document    text,            -- base64 PDF, written by its own request
  pack_size_bytes  integer
);

-- One row per page of the pack, which is one line item of the order. The
-- decision is per page on purpose: approving a whole order at once is what
-- keeps a human reviewing all of it forever. A straight library pull that
-- passed every gate is not the same risk as a sign drawn from scratch, and
-- only per-page decisions let the second kind be the only kind that needs eyes.
create table if not exists psp_artwork_pages (
  id             uuid primary key default gen_random_uuid(),
  order_number   text not null,
  page_no        integer not null,
  code           text not null,
  base_code      text,
  name           text not null,
  size           text,
  quantity       integer not null default 1,
  provenance     text not null,
  reason         text,
  brand          text,
  fit_note       text,
  source_file    text,
  source_page    integer,
  preview        text,             -- base64 PNG, downscaled for the proof grid
  decision       text not null default 'pending'
                 check (decision in ('pending','approved','rejected')),
  decision_note  text,
  decided_at     timestamptz,
  unique (order_number, page_no)
);

create index if not exists idx_psp_artwork_pages_order
  on psp_artwork_pages(order_number);
create index if not exists idx_psp_artwork_pages_decision
  on psp_artwork_pages(decision);

alter table psp_artwork_packs enable row level security;
alter table psp_artwork_pages enable row level security;
create policy "service_psp_artwork_packs" on psp_artwork_packs
  for all using (true) with check (true);
create policy "service_psp_artwork_pages" on psp_artwork_pages
  for all using (true) with check (true);
