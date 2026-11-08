-- CLICKOK POS: sale line snapshots and an atomic checkout transaction.
-- Existing sales, cash_sessions and inventory_movements tables are preserved.
create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  sale_id uuid not null,
  product_id uuid,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  created_at timestamptz not null default now(),
  constraint sale_items_sale_tenant_fk
    foreign key (business_id, sale_id) references public.sales(business_id, id) on delete cascade,
  constraint sale_items_product_tenant_fk
    foreign key (business_id, product_id) references public.products(business_id, id)
);
create index if not exists sale_items_sale_idx on public.sale_items(business_id, sale_id);
create index if not exists sales_business_created_idx on public.sales(business_id, created_at desc);

alter table public.sale_items enable row level security;
drop policy if exists sale_items_tenant_access on public.sale_items;
create policy sale_items_tenant_access on public.sale_items
  for all to authenticated
  using (private.has_business_role(business_id, array['owner','admin','manager','cashier']::text[]))
  with check (private.has_business_role(business_id, array['owner','admin','manager','cashier']::text[]));

revoke all on public.sale_items from anon, authenticated;
grant select on public.sale_items to authenticated;

create or replace function public.pos_register_sale(
  p_business_id uuid,
  p_cash_session_id uuid,
  p_payment_method text,
  p_discount numeric default 0,
  p_items jsonb default '[]'::jsonb,
  p_branch_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale_id uuid;
  v_subtotal numeric(12,2) := 0;
  v_total numeric(12,2);
  v_item jsonb;
  v_product record;
  v_quantity integer;
  v_unit_price numeric(12,2);
  v_line_total numeric(12,2);
begin
  if auth.uid() is null or not private.has_business_role(
    p_business_id, array['owner','admin','manager','cashier']::text[]
  ) then
    raise exception 'No tienes permisos para registrar ventas en este comercio.' using errcode = '42501';
  end if;
  if p_cash_session_id is null or not exists (
    select 1 from public.cash_sessions cs
    where cs.id = p_cash_session_id
      and cs.business_id = p_business_id
      and cs.status = 'open'
      and (p_branch_id is null or cs.branch_id = p_branch_id)
  ) then
    raise exception 'Debes tener una caja abierta para registrar la venta.' using errcode = '22023';
  end if;
  if p_branch_id is not null and not exists (
    select 1 from public.branches b
    where b.id = p_branch_id and b.business_id = p_business_id and b.is_active
  ) then
    raise exception 'La sucursal seleccionada no es válida.' using errcode = '22023';
  end if;
  if p_payment_method is null or pg_catalog.length(pg_catalog.btrim(p_payment_method)) = 0 then
    raise exception 'Selecciona un método de pago.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Agrega al menos un producto a la venta.' using errcode = '22023';
  end if;

  -- Validate and lock all requested products before changing stock.
  for v_item in
    select jsonb_build_object('product_id', grouped.product_id, 'quantity', grouped.quantity)
      from (
        select value->>'product_id' as product_id, sum((value->>'quantity')::integer)::integer as quantity
          from jsonb_array_elements(p_items)
         group by value->>'product_id'
      ) grouped
  loop
    v_quantity := (v_item->>'quantity')::integer;
    if v_quantity is null or v_quantity < 1 then
      raise exception 'La cantidad de un producto no es válida.' using errcode = '22023';
    end if;
    select p.id, p.name, p.price, p.stock, p.is_active, p.is_available
      into v_product
      from public.products p
     where p.id = (v_item->>'product_id')::uuid
       and p.business_id = p_business_id
     for update;
    if not found or not v_product.is_active or not v_product.is_available then
      raise exception 'Uno de los productos ya no está disponible.' using errcode = '22023';
    end if;
    if v_product.stock is not null and v_product.stock < v_quantity then
      raise exception 'Stock insuficiente para %.', v_product.name using errcode = '22023';
    end if;
    v_subtotal := v_subtotal + (v_product.price * v_quantity);
  end loop;

  if coalesce(p_discount, 0) < 0 or coalesce(p_discount, 0) > v_subtotal then
    raise exception 'El descuento no puede superar el subtotal.' using errcode = '22023';
  end if;
  v_total := v_subtotal - coalesce(p_discount, 0);

  insert into public.sales(
    business_id, branch_id, cash_session_id, sold_by,
    subtotal, discount, total, payment_method
  ) values (
    p_business_id, p_branch_id, p_cash_session_id, auth.uid(),
    v_subtotal, coalesce(p_discount, 0), v_total, pg_catalog.btrim(p_payment_method)
  ) returning id into v_sale_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item->>'quantity')::integer;
    select p.id, p.name, p.price, p.stock
      into v_product
      from public.products p
     where p.id = (v_item->>'product_id')::uuid
       and p.business_id = p_business_id
     for update;
    v_unit_price := v_product.price;
    v_line_total := v_unit_price * v_quantity;

    insert into public.sale_items(
      business_id, sale_id, product_id, product_name, quantity, unit_price, line_total
    ) values (
      p_business_id, v_sale_id, v_product.id, v_product.name, v_quantity, v_unit_price, v_line_total
    );

    if v_product.stock is not null then
      update public.products
         set stock = stock - v_quantity, updated_at = now()
       where id = v_product.id and business_id = p_business_id;
      insert into public.inventory_movements(
        business_id, product_id, branch_id, movement_type, quantity, reason, actor_id
      ) values (
        p_business_id, v_product.id, p_branch_id, 'out', v_quantity,
        'Venta POS ' || v_sale_id::text, auth.uid()
      );
    end if;
  end loop;

  return v_sale_id;
end;
$$;

revoke all on function public.pos_register_sale(uuid, uuid, text, numeric, jsonb, uuid) from public, anon;
grant execute on function public.pos_register_sale(uuid, uuid, text, numeric, jsonb, uuid) to authenticated;
