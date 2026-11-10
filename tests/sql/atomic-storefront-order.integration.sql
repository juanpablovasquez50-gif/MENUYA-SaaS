-- Integration checks against the disposable PostgreSQL service in GitHub Actions.

set role service_role;

do $$
declare
  v_result jsonb;
  v_order_id uuid;
  v_before_orders bigint;
  v_before_items bigint;
begin
  v_result := public.create_storefront_order_atomic(
    '11111111-1111-4111-8111-111111111111',
    'Cliente de prueba',
    '3000000000',
    jsonb_build_object(
      'fulfillment_type', 'pickup',
      'delivery_address', null,
      'notes', 'Prueba automatizada',
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
  );

  v_order_id := (v_result->>'id')::uuid;

  if v_order_id is null or (v_result->>'order_number')::bigint <> 1 then
    raise exception 'La función no devolvió la confirmación esperada del pedido';
  end if;

  if (select count(*) from public.customers) <> 1
     or (select count(*) from public.orders) <> 1
     or (select count(*) from public.order_items where order_id = v_order_id) <> 1 then
    raise exception 'El pedido, cliente y artículo no se guardaron juntos';
  end if;

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
end;
$$;

reset role;
