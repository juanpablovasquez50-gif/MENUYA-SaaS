-- Integration tests for atomic courier status sync and PIN throttling.
-- Runs only against the disposable PostgreSQL service in GitHub Actions.

do $$
declare
  v_order_id uuid;
  v_result jsonb;
  v_attempt integer;
begin
  select id into v_order_id from public.orders order by created_at limit 1;
  if v_order_id is null then
    raise exception 'La prueba requiere al menos un pedido de la prueba de checkout';
  end if;

  insert into public.delivery_couriers(id,business_id,full_name,phone)
  values (
    '33333333-3333-4333-8333-333333333333',
    '11111111-1111-4111-8111-111111111111',
    'Domiciliario de prueba',
    '3000000000'
  );

  insert into public.delivery_assignments(id,business_id,order_id,courier_id,status)
  values (
    '44444444-4444-4444-8444-444444444444',
    '11111111-1111-4111-8111-111111111111',
    v_order_id,
    '33333333-3333-4333-8333-333333333333',
    'assigned'
  );

  v_result := public.update_courier_delivery_status(
    '44444444-4444-4444-8444-444444444444',
    '33333333-3333-4333-8333-333333333333',
    '11111111-1111-4111-8111-111111111111',
    'picked_up'
  );

  if v_result->>'order_status' <> 'ready'
     or (select status from public.delivery_assignments where id='44444444-4444-4444-8444-444444444444') <> 'picked_up'
     or (select status from public.orders where id=v_order_id) <> 'ready' then
    raise exception 'El estado de recogida no se sincronizó con el pedido';
  end if;

  v_result := public.update_courier_delivery_status(
    '44444444-4444-4444-8444-444444444444',
    '33333333-3333-4333-8333-333333333333',
    '11111111-1111-4111-8111-111111111111',
    'delivered'
  );

  if v_result->>'order_status' <> 'delivered'
     or (select status from public.delivery_assignments where id='44444444-4444-4444-8444-444444444444') <> 'delivered'
     or (select status from public.orders where id=v_order_id) <> 'delivered' then
    raise exception 'El estado de entrega no se sincronizó con el pedido';
  end if;

  for v_attempt in 1..4 loop
    if public.consume_courier_login_attempt(repeat('a',64)) is distinct from true then
      raise exception 'El limitador bloqueó antes de cinco intentos';
    end if;
  end loop;

  if public.consume_courier_login_attempt(repeat('a',64)) is distinct from false
     or public.consume_courier_login_attempt(repeat('a',64)) is distinct from false then
    raise exception 'El limitador no bloqueó el quinto intento y los siguientes';
  end if;

  perform public.reset_courier_login_attempts(repeat('a',64));
  if public.consume_courier_login_attempt(repeat('a',64)) is distinct from true then
    raise exception 'El limitador no permitió el acceso tras reiniciar los intentos';
  end if;
end;
$$;
