-- Disposable PostgreSQL fixture for the atomic storefront order migration.
-- This runs only inside the GitHub Actions service container, never in Supabase.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

create table public.businesses (
  id uuid primary key
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  name text not null,
  phone text not null,
  total_orders integer not null default 0,
  total_spent numeric not null default 0,
  last_order_at timestamptz,
  created_at timestamptz not null default now(),
  constraint customers_business_id_phone_key unique (business_id, phone),
  constraint customers_business_id_id_key unique (business_id, id)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  customer_id uuid not null,
  order_number bigint not null,
  status text not null,
  tracking_token text not null,
  fulfillment_type text not null check (fulfillment_type in ('delivery', 'pickup')),
  delivery_address text,
  notes text,
  payment_method text,
  privacy_policy_version text,
  privacy_consent_at timestamptz,
  subtotal numeric not null,
  delivery_fee numeric not null default 0,
  total numeric not null,
  created_at timestamptz not null default now(),
  constraint orders_business_id_order_number_key unique (business_id, order_number),
  constraint orders_customer_tenant_fk
    foreign key (business_id, customer_id)
    references public.customers (business_id, id)
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  order_id uuid not null,
  product_id uuid not null,
  product_name text not null,
  unit_price numeric not null,
  quantity integer not null check (quantity > 0),
  line_total numeric not null,
  variant_name text,
  addons_snapshot jsonb not null default '[]'::jsonb,
  constraint order_items_order_tenant_fk
    foreign key (business_id, order_id)
    references public.orders (business_id, id)
);

insert into public.businesses (id)
values ('11111111-1111-4111-8111-111111111111');
