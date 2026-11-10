-- Universal, opt-in courier operations for every business sector.
alter table public.orders
  add column if not exists delivery_latitude double precision,
  add column if not exists delivery_longitude double precision;

create table if not exists public.delivery_couriers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 120),
  phone text not null check (char_length(btrim(phone)) between 5 and 30),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id)
);
create index if not exists delivery_couriers_business_idx on public.delivery_couriers(business_id, active);

create table if not exists public.delivery_assignments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  courier_id uuid not null,
  status text not null default 'assigned' check (status in ('assigned','picked_up','delivered','cancelled')),
  assigned_at timestamptz not null default now(),
  picked_up_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_assignment_courier_same_business
    foreign key (business_id,courier_id) references public.delivery_couriers(business_id,id) on delete restrict,
  unique (order_id)
);
create index if not exists delivery_assignments_business_status_idx on public.delivery_assignments(business_id,status,assigned_at desc);

create table if not exists public.delivery_courier_locations (
  courier_id uuid primary key references public.delivery_couriers(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m double precision,
  recorded_at timestamptz not null default now(),
  constraint delivery_location_courier_same_business
    foreign key (business_id,courier_id) references public.delivery_couriers(business_id,id) on delete cascade
);
create index if not exists delivery_locations_business_idx on public.delivery_courier_locations(business_id,recorded_at desc);

alter table public.delivery_couriers enable row level security;
alter table public.delivery_assignments enable row level security;
alter table public.delivery_courier_locations enable row level security;

drop policy if exists delivery_couriers_manage on public.delivery_couriers;
create policy delivery_couriers_manage on public.delivery_couriers
for all to authenticated
using (private.has_business_role(business_id,array['owner','admin','manager']::text[]))
with check (private.has_business_role(business_id,array['owner','admin','manager']::text[]));

drop policy if exists delivery_assignments_manage on public.delivery_assignments;
create policy delivery_assignments_manage on public.delivery_assignments
for all to authenticated
using (private.has_business_role(business_id,array['owner','admin','manager']::text[]))
with check (
  private.has_business_role(business_id,array['owner','admin','manager']::text[])
  and exists (select 1 from public.orders o where o.id=order_id and o.business_id=delivery_assignments.business_id and o.fulfillment_type='delivery')
);

drop policy if exists delivery_locations_manage on public.delivery_courier_locations;
create policy delivery_locations_manage on public.delivery_courier_locations
for all to authenticated
using (private.has_business_role(business_id,array['owner','admin','manager']::text[]))
with check (private.has_business_role(business_id,array['owner','admin','manager']::text[]));

-- Keep this feature optional and independent from the merchant's sector.
insert into public.business_modules(business_id,module_key,enabled,activation_source)
select id,'courier_management',false,'manual' from public.businesses
on conflict (business_id,module_key) do nothing;
