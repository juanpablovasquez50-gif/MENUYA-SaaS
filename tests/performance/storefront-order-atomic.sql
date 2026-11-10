-- One realistic single-item storefront order per pgbench transaction.
-- The function includes validation, customer upsert, order allocation,
-- order/items inserts, idempotency record and transactional push outbox.
select public.create_storefront_order_atomic(
  '11111111-1111-4111-8111-111111111111'::uuid,
  'Cliente benchmark',
  md5(clock_timestamp()::text || random()::text),
  jsonb_build_object(
    'fulfillment_type', 'pickup',
    'delivery_address', null,
    'notes', null,
    'payment_method', 'Efectivo',
    'privacy_policy_version', '1.0',
    'privacy_consent_at', now(),
    'subtotal', 25000,
    'delivery_fee', 0,
    'total', 25000,
    'tracking_token', gen_random_uuid()::text
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
  repeat('a', 64),
  gen_random_uuid()
);
