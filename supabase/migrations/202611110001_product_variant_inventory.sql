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
drop policy if exists product_variant_inventory_read on public.product_variant_inventory;
create policy product_variant_inventory_read on public.product_variant_inventory
  for select to anon, authenticated
  using (
    (is_active = true and exists (
      select 1 from public.businesses b
      where b.id = business_id and b.status = 'active' and b.is_published = true
    ) and exists (
      select 1 from public.products p
      where p.id = product_id and p.business_id = business_id
        and p.is_active = true and p.is_available = true
    ))
    or exists (
      select 1 from public.business_memberships bm
      where bm.business_id = business_id and bm.user_id = (select auth.uid()) and bm.status = 'active'
    )
  );
drop policy if exists product_variant_inventory_insert_member on public.product_variant_inventory;
create policy product_variant_inventory_insert_member on public.product_variant_inventory
  for insert to authenticated
  with check (private.has_business_role(business_id, array['owner','admin','manager','catalog']));
drop policy if exists product_variant_inventory_update_member on public.product_variant_inventory;
create policy product_variant_inventory_update_member on public.product_variant_inventory
  for update to authenticated
  using (private.has_business_role(business_id, array['owner','admin','manager','catalog']))
  with check (private.has_business_role(business_id, array['owner','admin','manager','catalog']));
drop policy if exists product_variant_inventory_delete_member on public.product_variant_inventory;
create policy product_variant_inventory_delete_member on public.product_variant_inventory
  for delete to authenticated
  using (private.has_business_role(business_id, array['owner','admin','manager','catalog']));
