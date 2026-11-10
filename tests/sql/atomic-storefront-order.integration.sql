-- Integration checks against the disposable PostgreSQL service in GitHub Actions.
-- Covers pickup, delivery, customer reuse, order numbering, item snapshots and rollback.

set role service_role;

do $$
declare
  v_result jsonb;
  v_order_id uuid;
  v_customer_id uuid;
  v_before_orders bigint;
  v_before_items bigint;
  v_customer_orders integer;
  v_customer_spent numeric;
begin
  -- First order: pickup creates the customer and its first order atomically.
  v_result := public.create_storefront_order_atomic(
    '11111111-1111-4111-8111-111111111111',
    'Cliente de prueba',
    '3000000000',
    jsonb_build_object(
      'fulfillment_type', 'pickup',
      'delivery_address', null,
      'notes', 'Primera compra',
      'payment_method', 'Efectivo',
      'privacy_policy_version', '1.0',
      'privacy_consent_at', now(),
      'subtotal', 25000,
      'delivery_fee', 0,
      'total', 25000,
      'tracking_token', 'test-tracking-token-1'
    ),
    jsonb_build_array(jsonb_build_object(
      'product_id', '22222222-2222-4222-8222-222222222222',
      'product_name', 'Producto de prueba',
      'unit_price', 25000,
      'quantity', 1,
      'line_total', 25000,
      'variant_name', null,
      'addons_snapshot', '[]'::jsonb
    ))
  ,
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
  );

  v_order_id := (v_result->>'id')::uuid;
  v_customer_id := (v_result->>'customer_id')::uuid;

  if v_order_id is null or v_customer_id is null
     or (v_result->>'order_number')::bigint <> 1 then
    raise exception 'La primera compra no devolvió la confirmación esperada';
  end if;

  if (select count(*) from public.customers) <> 1
     or (select count(*) from public.orders) <> 1
     or (select count(*) from public.order_items where order_id = v_order_id) <> 1 then
    raise exception 'El pedido, cliente y artículo no se guardaron juntos';
  end if;

  -- Retry with the same key and same business payload must replay the first
  -- order, even though the request generated a fresh consent timestamp/token.
  v_result := public.create_storefront_order_atomic(
    '11111111-1111-4111-8111-111111111111',
    'Cliente de prueba',
    '3000000000',
    jsonb_build_object(
      'fulfillment_type', 'pickup',
      'delivery_address', null,
      'notes', 'Primera compra',
      'payment_method', 'Efectivo',
      'privacy_policy_version', '1.0',
      'privacy_consent_at', now() + interval '1 minute',
      'subtotal', 25000,
      'delivery_fee', 0,
      'total', 25000,
      'tracking_token', 'a-different-retry-token'
    ),
    jsonb_build_array(jsonb_build_object(
      'product_id', '22222222-2222-4222-8222-222222222222',
      'product_name', 'Producto de prueba',
      'unit_price', 25000,
      'quantity', 1,
      'line_total', 25000,
      'variant_name', null,
      'addons_snapshot', '[]'::jsonb
    )),
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
  );

  if (v_result->>'id')::uuid <> v_order_id
     or (v_result->>'order_number')::bigint <> 1
     or v_result->>'tracking_token' <> 'test-tracking-token-1'
     or v_result->>'replayed' <> 'true' then
    raise exception 'El reintento idempotente no devolvió el pedido original';
  end if;

  if (select count(*) from public.orders) <> 1
     or (select count(*) from public.order_items) <> 1
     or (select total_orders from public.customers where id = v_customer_id) <> 1 then
    raise exception 'El reintento duplicó el pedido o actualizó dos veces al cliente';
  end if;

  -- The same key with a changed payload must be rejected without writes.
  v_result := public.create_storefront_order_atomic(
    '11111111-1111-4111-8111-111111111111',
    'Nombre diferente',
    '3000000000',
    jsonb_build_object(
      'fulfillment_type', 'pickup',
      'delivery_address', null,
      'notes', 'Primera compra',
      'payment_method', 'Efectivo',
      'privacy_policy_version', '1.0',
      'privacy_consent_at', now(),
      'subtotal', 25000,
      'delivery_fee', 0,
      'total', 25000,
      'tracking_token', 'another-token'
    ),
    jsonb_build_array(jsonb_build_object(
      'product_id', '22222222-2222-4222-8222-222222222222',
      'product_name', 'Producto de prueba',
      'unit_price', 25000,
      'quantity', 1,
      'line_total', 25000,
      'variant_name', null,
      'addons_snapshot', '[]'::jsonb
    )),
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
  );

  if v_result->>'idempotency_conflict' <> 'true'
     or (select count(*) from public.orders) <> 1
     or (select total_orders from public.customers where id = v_customer_id) <> 1 then
    raise exception 'La reutilización de clave con otro payload no fue rechazada';
  end if;


  -- Second order: same phone must reuse the customer and increment its totals.
  -- Delivery fields and option snapshots must be preserved.
  v_result := public.create_storefront_order_atomic(
    '11111111-1111-4111-8111-111111111111',
    'Cliente actualizado',
    '3000000000',
    jsonb_build_object(
      'fulfillment_type', 'delivery',
      'delivery_address', 'Carrera 10 # 20-30',
      'notes', 'Segunda compra',
      'payment_method', 'Transferencia',
      'privacy_policy_version', '1.0',
      'privacy_consent_at', now(),
      'subtotal', 30000,
      'delivery_fee', 5000,
      'total', 35000,
      'tracking_token', 'test-tracking-token-2'
    ),
    jsonb_build_array(jsonb_build_object(
      'product_id', '22222222-2222-4222-8222-222222222222',
      'product_name', 'Producto con opciones',
      'unit_price', 30000,
      'quantity', 1,
      'line_total', 30000,
      'variant_name', 'Grande',
      'addons_snapshot', jsonb_build_array(jsonb_build_object(
        'name', 'Queso extra',
        'extra_price', 5000
      ))
    ))
  ,
    'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
  );

  v_order_id := (v_result->>'id')::uuid;

  if v_order_id is null or (v_result->>'customer_id')::uuid <> v_customer_id
     or (v_result->>'order_number')::bigint <> 2 then
    raise exception 'La segunda compra no reutilizó el cliente o consecutivo esperado';
  end if;

  if (select count(*) from public.customers) <> 1
     or (select count(*) from public.orders) <> 2
     or (select count(*) from public.order_items where order_id = v_order_id) <> 1 then
    raise exception 'La segunda compra duplicó el cliente o no guardó sus artículos';
  end if;

  if not exists (
    select 1 from public.orders
     where id = v_order_id
       and fulfillment_type = 'delivery'
       and delivery_address = 'Carrera 10 # 20-30'
       and delivery_fee = 5000
       and total = 35000
  ) then
    raise exception 'No se conservaron los datos de domicilio y totales';
  end if;

  if not exists (
    select 1 from public.order_items
     where order_id = v_order_id
       and variant_name = 'Grande'
       and addons_snapshot @> '[{"name":"Queso extra","extra_price":5000}]'::jsonb
  ) then
    raise exception 'No se conservaron la variante y los complementos';
  end if;

  select total_orders, total_spent
    into v_customer_orders, v_customer_spent
    from public.customers
   where id = v_customer_id;

  if v_customer_orders <> 2 or v_customer_spent <> 55000 then
    raise exception 'Los acumulados del cliente no se actualizaron correctamente';
  end if;

  -- Invalid item UUID fails after customer/order work has started. The whole
  -- function call must roll back without leaving partial writes or counters.
  select count(*) into v_before_orders from public.orders;
  select count(*) into v_before_items from public.order_items;

  begin
    perform public.create_storefront_order_atomic(
      '11111111-1111-4111-8111-111111111111',
      'Cliente de prueba',
      '3000000000',
      jsonb_build_object(
        'fulfillment_type', 'pickup',
        'subtotal', 1000,
        'total', 1000,
        'tracking_token', 'test-tracking-token-failure'
      ),
      jsonb_build_array(jsonb_build_object(
        'product_id', 'esto-no-es-un-uuid',
        'product_name', 'Artículo inválido',
        'unit_price', 1000,
        'quantity', 1,
        'line_total', 1000,
        'addons_snapshot', '[]'::jsonb
      ))
    ,
    'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'
  );
    raise exception 'Se esperaba que la inserción inválida fallara';
  exception
    when invalid_text_representation then
      null;
  end;

  if (select count(*) from public.orders) <> v_before_orders
     or (select count(*) from public.order_items) <> v_before_items then
    raise exception 'La operación fallida dejó escrituras parciales';
  end if;

  select total_orders, total_spent
    into v_customer_orders, v_customer_spent
    from public.customers
   where id = v_customer_id;

  if v_customer_orders <> 2 or v_customer_spent <> 55000 then
    raise exception 'El rollback no revirtió los acumulados del cliente';
  end if;

  -- The RPC must reject a subtotal that does not match the persisted item lines.
  begin
    perform public.create_storefront_order_atomic(
      '11111111-1111-4111-8111-111111111111',
      'Cliente de prueba',
      '3000000000',
      jsonb_build_object(
        'fulfillment_type', 'pickup',
        'subtotal', 999,
        'delivery_fee', 0,
        'total', 999,
        'tracking_token', 'test-tracking-token-mismatch'
      ),
      jsonb_build_array(jsonb_build_object(
        'product_id', '22222222-2222-4222-8222-222222222222',
        'product_name', 'Producto de prueba',
        'unit_price', 1000,
        'quantity', 1,
        'line_total', 1000,
        'addons_snapshot', '[]'::jsonb
      ))
    ,
    'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4'
  );
    raise exception 'Se esperaba el rechazo de un subtotal inconsistente';
  exception
    when invalid_parameter_value then
      null;
  end;

  if (select count(*) from public.orders) <> v_before_orders
     or (select count(*) from public.order_items) <> v_before_items then
    raise exception 'La validación de subtotal inconsistente dejó escrituras';
  end if;

  -- A delivery order cannot be persisted without a delivery address.
  begin
    perform public.create_storefront_order_atomic(
      '11111111-1111-4111-8111-111111111111',
      'Cliente de prueba',
      '3000000000',
      jsonb_build_object(
        'fulfillment_type', 'delivery',
        'delivery_address', '   ',
        'subtotal', 1000,
        'delivery_fee', 0,
        'total', 1000,
        'tracking_token', 'test-tracking-token-no-address'
      ),
      jsonb_build_array(jsonb_build_object(
        'product_id', '22222222-2222-4222-8222-222222222222',
        'product_name', 'Producto de prueba',
        'unit_price', 1000,
        'quantity', 1,
        'line_total', 1000,
        'addons_snapshot', '[]'::jsonb
      ))
    ,
    'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5'
  );
    raise exception 'Se esperaba el rechazo de domicilio sin dirección';
  exception
    when invalid_parameter_value then
      null;
  end;

  if (select count(*) from public.orders) <> v_before_orders
     or (select count(*) from public.order_items) <> v_before_items then
    raise exception 'La validación de dirección dejó escrituras';
  end if;

end;
$$;

reset role;
