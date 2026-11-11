-- Keep courier assignment and customer-facing order status in one transaction.
-- The Edge Function authenticates the courier session before calling this service-role RPC.

create or replace function public.update_courier_delivery_status(
  p_assignment_id uuid,
  p_courier_id uuid,
  p_business_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment public.delivery_assignments%rowtype;
  v_order_status text;
begin
  if p_assignment_id is null
     or p_courier_id is null
     or p_business_id is null
     or p_status not in ('picked_up', 'delivered') then
    raise exception 'Estado de entrega no válido.' using errcode = '22023';
  end if;

  select *
    into v_assignment
    from public.delivery_assignments
   where id = p_assignment_id
     and courier_id = p_courier_id
     and business_id = p_business_id
   for update;

  if not found then
    raise exception 'Entrega no encontrada.' using errcode = 'P0002';
  end if;

  if (p_status = 'picked_up' and v_assignment.status <> 'assigned')
     or (p_status = 'delivered' and v_assignment.status <> 'picked_up') then
    raise exception 'La entrega ya cambió de estado. Actualiza la lista.' using errcode = '40001';
  end if;

  update public.delivery_assignments
     set status = p_status,
         picked_up_at = case when p_status = 'picked_up' then pg_catalog.now() else picked_up_at end,
         delivered_at = case when p_status = 'delivered' then pg_catalog.now() else delivered_at end,
         updated_at = pg_catalog.now()
   where id = p_assignment_id;

  -- Match the order lifecycle used by the merchant dashboard and tracking UI.
  v_order_status := case when p_status = 'picked_up' then 'ready' else 'delivered' end;

  update public.orders
     set status = v_order_status,
         updated_at = pg_catalog.now()
   where id = v_assignment.order_id
     and business_id = p_business_id;

  if not found then
    raise exception 'Pedido asociado no encontrado.' using errcode = 'P0002';
  end if;

  return pg_catalog.jsonb_build_object(
    'id', p_assignment_id,
    'order_id', v_assignment.order_id,
    'status', p_status,
    'order_status', v_order_status
  );
end;
$$;

revoke all on function public.update_courier_delivery_status(uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.update_courier_delivery_status(uuid, uuid, uuid, text)
  to service_role;

comment on function public.update_courier_delivery_status(uuid, uuid, uuid, text) is
  'Atomically updates courier assignment and customer-visible order status after Edge Function session validation.';


-- Rate-limit courier PIN attempts by a one-way hash of the access code.
-- No PIN or raw access code is persisted in this table.
create table if not exists public.courier_login_attempts (
  access_code_hash text primary key check (access_code_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null default pg_catalog.now(),
  attempts integer not null default 0 check (attempts >= 0),
  blocked_until timestamptz
);

alter table public.courier_login_attempts enable row level security;
revoke all on public.courier_login_attempts from public, anon, authenticated, service_role;

create or replace function public.consume_courier_login_attempt(p_access_code_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempts integer;
  v_blocked_until timestamptz;
begin
  if p_access_code_hash !~ '^[0-9a-f]{64}$' then
    return false;
  end if;

  insert into public.courier_login_attempts(access_code_hash, window_started_at, attempts)
  values (p_access_code_hash, pg_catalog.now(), 1)
  on conflict (access_code_hash) do update
    set window_started_at = case
          when public.courier_login_attempts.window_started_at < pg_catalog.now() - interval '15 minutes'
          then pg_catalog.now()
          else public.courier_login_attempts.window_started_at
        end,
        attempts = case
          when public.courier_login_attempts.window_started_at < pg_catalog.now() - interval '15 minutes'
          then 1
          else public.courier_login_attempts.attempts + 1
        end,
        blocked_until = case
          when public.courier_login_attempts.window_started_at < pg_catalog.now() - interval '15 minutes'
          then null
          when public.courier_login_attempts.attempts + 1 >= 5
          then pg_catalog.now() + interval '15 minutes'
          else public.courier_login_attempts.blocked_until
        end
  returning attempts, blocked_until into v_attempts, v_blocked_until;

  return v_attempts <= 5 and (v_blocked_until is null or v_blocked_until <= pg_catalog.now());
end;
$$;

create or replace function public.reset_courier_login_attempts(p_access_code_hash text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.courier_login_attempts
   where access_code_hash = p_access_code_hash;
$$;

revoke all on function public.consume_courier_login_attempt(text) from public, anon, authenticated;
revoke all on function public.reset_courier_login_attempts(text) from public, anon, authenticated;
grant execute on function public.consume_courier_login_attempt(text) to service_role;
grant execute on function public.reset_courier_login_attempts(text) to service_role;
