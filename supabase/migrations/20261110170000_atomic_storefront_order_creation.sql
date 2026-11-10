-- Atomic storefront checkout: customer, order and order items commit together.
-- Intended for the create-store-order Edge Function using the service-role key only.

create or replace function public.create_storefront_order_atomic(
  p_business_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_order_data jsonb,
  p_items jsonb
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

  v_subtotal := (p_order_data->>'subtotal')::numeric;
  v_delivery_fee := coalesce((p_order_data->>'delivery_fee')::numeric, 0);
  v_tracking_token := p_order_data->>'tracking_token';

  if v_subtotal is null or v_subtotal < 0
     or v_delivery_fee < 0
     or nullif(v_tracking_token, '') is null
     or (p_order_data->>'total')::numeric is distinct from (v_subtotal + v_delivery_fee)
     or (p_order_data->>'fulfillment_type') = 'delivery'
        and nullif(pg_catalog.btrim(p_order_data->>'delivery_address'), '') is null then
    raise exception 'Datos del pedido no válidos.' using errcode = '22023';
  end if;

  -- Treat the RPC as a validation boundary too: callers must not be able to
  -- persist totals that disagree with the item snapshots.
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

  -- Lock the business row: the waiter-order RPC uses the same lock before
  -- allocating order_number, so both checkout paths serialize consistently.
  perform 1 from public.businesses b where b.id = p_business_id for update;
  if not found then
    raise exception 'Comercio no encontrado.' using errcode = '23503';
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

  return pg_catalog.jsonb_build_object(
    'id', v_order_id,
    'customer_id', v_customer_id,
    'order_number', v_order_number,
    'tracking_token', v_tracking_token,
    'created_at', v_created_at
  );
end;
$$;

revoke all on function public.create_storefront_order_atomic(uuid, text, text, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_storefront_order_atomic(uuid, text, text, jsonb, jsonb)
  to service_role;

comment on function public.create_storefront_order_atomic(uuid, text, text, jsonb, jsonb) is
  'Atomically upserts the storefront customer and creates the order plus its items. Service-role only.';
