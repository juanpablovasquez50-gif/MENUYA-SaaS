-- Atomic and idempotent storefront checkout.
-- Repeated keys with the same client payload replay the original order.
-- Reusing a key with a different payload is rejected.
-- This function is intended for the create-store-order Edge Function only.

create table if not exists public.storefront_order_idempotency (
  business_id uuid not null references public.businesses(id) on delete cascade,
  idempotency_key uuid not null,
  request_hash text not null,
  order_id uuid not null,
  created_at timestamptz not null default pg_catalog.now(),
  primary key (business_id, idempotency_key),
  constraint storefront_order_idempotency_order_fk
    foreign key (business_id, order_id)
    references public.orders (business_id, id) on delete cascade
);

revoke all on table public.storefront_order_idempotency from public, anon, authenticated;

create table if not exists public.storefront_order_push_outbox (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  order_id uuid not null,
  payload jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default pg_catalog.now(),
  locked_until timestamptz,
  last_error text,
  delivered_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  constraint storefront_order_push_outbox_order_key unique (business_id, order_id),
  constraint storefront_order_push_outbox_order_fk
    foreign key (business_id, order_id)
    references public.orders (business_id, id) on delete cascade
);

revoke all on table public.storefront_order_push_outbox from public, anon, authenticated;
grant select, update on table public.storefront_order_push_outbox to service_role;

create or replace function public.claim_storefront_order_push_outbox(p_outbox_id uuid)
returns setof public.storefront_order_push_outbox
language sql
security definer
set search_path = ''
as $claim$
  update public.storefront_order_push_outbox
     set status = 'processing',
         attempts = attempts + 1,
         locked_until = pg_catalog.now() + interval '2 minutes',
         last_error = null
   where id = p_outbox_id
     and available_at <= pg_catalog.now()
     and (
       status in ('pending', 'failed')
       or (status = 'processing' and locked_until < pg_catalog.now())
     )
   returning *;
$claim$;

revoke all on function public.claim_storefront_order_push_outbox(uuid)
  from public, anon, authenticated;
grant execute on function public.claim_storefront_order_push_outbox(uuid)
  to service_role;

drop function if exists public.create_storefront_order_atomic(uuid, text, text, jsonb, jsonb);
drop function if exists public.create_storefront_order_atomic(uuid, text, text, jsonb, jsonb, uuid);

create or replace function public.create_storefront_order_atomic(
  p_business_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_order_data jsonb,
  p_items jsonb,
  p_request_hash text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid;
  v_order_id uuid;
  v_order_number bigint;
  v_created_at timestamptz;
  v_subtotal numeric;
  v_delivery_fee numeric;
  v_items_subtotal numeric;
  v_tracking_token text;
  v_existing_tracking_token text;
  v_existing_hash text;
  v_push_outbox_id uuid;
begin
  if p_business_id is null
     or nullif(pg_catalog.btrim(p_customer_name), '') is null
     or nullif(pg_catalog.btrim(p_customer_phone), '') is null
     or p_order_data is null
     or pg_catalog.jsonb_typeof(p_order_data) <> 'object'
     or p_items is null
     or pg_catalog.jsonb_typeof(p_items) <> 'array'
     or pg_catalog.jsonb_array_length(p_items) < 1
     or pg_catalog.jsonb_array_length(p_items) > 50
     or coalesce(p_order_data->>'fulfillment_type', '') not in ('delivery', 'pickup') then
    raise exception 'Datos del pedido incompletos.' using errcode = '22023';
  end if;

  if p_idempotency_key is null
     or p_request_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'La clave o huella de idempotencia no es válida.' using errcode = '22023';
  end if;

  v_subtotal := (p_order_data->>'subtotal')::numeric;
  v_delivery_fee := coalesce((p_order_data->>'delivery_fee')::numeric, 0);
  v_tracking_token := p_order_data->>'tracking_token';

  if v_subtotal is null or v_subtotal < 0
     or v_delivery_fee < 0
     or nullif(v_tracking_token, '') is null
     or (p_order_data->>'total')::numeric is distinct from (v_subtotal + v_delivery_fee)
     or (
       p_order_data->>'fulfillment_type' = 'delivery'
       and nullif(pg_catalog.btrim(p_order_data->>'delivery_address'), '') is null
     ) then
    raise exception 'Datos del pedido no válidos.' using errcode = '22023';
  end if;

  if exists (
    select 1
      from pg_catalog.jsonb_array_elements(p_items) as entry(item)
     where pg_catalog.jsonb_typeof(entry.item) <> 'object'
        or nullif(pg_catalog.btrim(entry.item->>'product_name'), '') is null
        or nullif(entry.item->>'product_id', '') is null
        or entry.item->>'unit_price' is null
        or entry.item->>'quantity' is null
        or entry.item->>'line_total' is null
        or (entry.item->>'unit_price')::numeric < 0
        or (entry.item->>'quantity')::integer < 1
        or (entry.item->>'quantity')::integer > 99
        or (entry.item->>'line_total')::numeric
           <> (entry.item->>'unit_price')::numeric * (entry.item->>'quantity')::integer
  ) then
    raise exception 'Artículos del pedido no válidos.' using errcode = '22023';
  end if;

  select coalesce(sum((entry.item->>'line_total')::numeric), 0)
    into v_items_subtotal
    from pg_catalog.jsonb_array_elements(p_items) as entry(item);

  if v_items_subtotal <> v_subtotal then
    raise exception 'El subtotal no coincide con los artículos.' using errcode = '22023';
  end if;

  -- This is the same business-row lock used by the waiter-order allocator.
  -- It serializes order numbers and same-key retries for this business.
  perform 1 from public.businesses b where b.id = p_business_id for update;
  if not found then
    raise exception 'Comercio no encontrado.' using errcode = '23503';
  end if;

  v_existing_hash := pg_catalog.lower(p_request_hash);

  select i.request_hash, o.id, o.customer_id, o.order_number,
         o.tracking_token, o.created_at, p.id
    into v_existing_hash, v_order_id, v_customer_id, v_order_number,
         v_existing_tracking_token, v_created_at, v_push_outbox_id
    from public.storefront_order_idempotency i
    join public.orders o
      on o.business_id = i.business_id and o.id = i.order_id
    left join public.storefront_order_push_outbox p
      on p.business_id = i.business_id and p.order_id = i.order_id
   where i.business_id = p_business_id
     and i.idempotency_key = p_idempotency_key;

  if found then
    if v_existing_hash <> pg_catalog.lower(p_request_hash) then
      return pg_catalog.jsonb_build_object('idempotency_conflict', true);
    end if;

    return pg_catalog.jsonb_build_object(
      'id', v_order_id,
      'customer_id', v_customer_id,
      'order_number', v_order_number,
      'tracking_token', v_existing_tracking_token,
      'created_at', v_created_at,
      'push_outbox_id', v_push_outbox_id,
      'replayed', true
    );
  end if;

  insert into public.customers (
    business_id, name, phone, total_orders, total_spent, last_order_at
  )
  values (
    p_business_id, pg_catalog.btrim(p_customer_name),
    pg_catalog.btrim(p_customer_phone), 1, v_subtotal, pg_catalog.now()
  )
  on conflict (business_id, phone) do update
    set name = excluded.name,
        total_orders = public.customers.total_orders + 1,
        total_spent = public.customers.total_spent + excluded.total_spent,
        last_order_at = pg_catalog.now()
  returning id into v_customer_id;

  select coalesce(pg_catalog.max(o.order_number), 0) + 1
    into v_order_number
    from public.orders o
   where o.business_id = p_business_id;

  insert into public.orders (
    business_id, customer_id, order_number, status, tracking_token,
    fulfillment_type, delivery_address, notes, payment_method,
    privacy_policy_version, privacy_consent_at,
    subtotal, delivery_fee, total
  )
  values (
    p_business_id, v_customer_id, v_order_number, 'pending', v_tracking_token,
    p_order_data->>'fulfillment_type',
    nullif(p_order_data->>'delivery_address', ''),
    nullif(p_order_data->>'notes', ''),
    coalesce(nullif(p_order_data->>'payment_method', ''), 'Efectivo'),
    p_order_data->>'privacy_policy_version',
    (p_order_data->>'privacy_consent_at')::timestamptz,
    v_subtotal,
    v_delivery_fee,
    (p_order_data->>'total')::numeric
  )
  returning id, created_at into v_order_id, v_created_at;

  insert into public.order_items (
    business_id, order_id, product_id, product_name,
    unit_price, quantity, line_total, variant_name, addons_snapshot
  )
  select
    p_business_id, v_order_id, item.product_id, item.product_name,
    item.unit_price, item.quantity, item.line_total,
    item.variant_name, coalesce(item.addons_snapshot, '[]'::jsonb)
  from pg_catalog.jsonb_to_recordset(p_items) as item(
    product_id uuid,
    product_name text,
    unit_price numeric,
    quantity integer,
    line_total numeric,
    variant_name text,
    addons_snapshot jsonb
  );

  insert into public.storefront_order_idempotency (
    business_id, idempotency_key, request_hash, order_id
  ) values (
    p_business_id, p_idempotency_key, pg_catalog.lower(p_request_hash), v_order_id
  );

  insert into public.storefront_order_push_outbox (
    business_id, order_id, payload
  ) values (
    p_business_id,
    v_order_id,
    pg_catalog.jsonb_build_object(
      'business_id', p_business_id,
      'order_number', v_order_number,
      'customer_name', pg_catalog.btrim(p_customer_name),
      'total', v_subtotal + v_delivery_fee
    )
  )
  returning id into v_push_outbox_id;

  return pg_catalog.jsonb_build_object(
    'id', v_order_id,
    'customer_id', v_customer_id,
    'order_number', v_order_number,
    'tracking_token', v_tracking_token,
    'created_at', v_created_at,
    'push_outbox_id', v_push_outbox_id,
    'replayed', false
  );
end;
$$;

revoke all on function public.create_storefront_order_atomic(uuid, text, text, jsonb, jsonb, text, uuid)
  from public, anon, authenticated;
grant execute on function public.create_storefront_order_atomic(uuid, text, text, jsonb, jsonb, text, uuid)
  to service_role;

comment on function public.create_storefront_order_atomic(uuid, text, text, jsonb, jsonb, text, uuid) is
  'Atomically creates storefront orders and replays requests by idempotency key. Service-role only.';
