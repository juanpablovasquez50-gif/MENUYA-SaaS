create table if not exists public.product_variant_inventory (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  sku text,
  size text not null,
  color text not null,
  stock integer not null default 0 check (stock >= 0),
  price_adjustment numeric(12,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, size, color)
);
create index if not exists product_variant_inventory_business_product_idx
  on public.product_variant_inventory (business_id, product_id);
alter table public.product_variant_inventory enable row level security;
drop policy if exists "Business members manage product variant inventory" on public.product_variant_inventory;
create policy "Business members manage product variant inventory"
  on public.product_variant_inventory for all to authenticated
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));
