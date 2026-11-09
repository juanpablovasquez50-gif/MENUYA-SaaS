-- Cobro de pedidos normales creados desde la vitrina en el POS.
-- No altera pedidos de mesa ni elimina estructuras anteriores.
create or replace function public.pos_register_storefront_order_sale(
  p_business_id uuid, p_order_id uuid, p_cash_session_id uuid,
  p_payment_method text, p_branch_id uuid default null
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_order record; v_item record; v_product record; v_sale_id uuid;
begin
  if auth.uid() is null or not private.has_business_role(p_business_id,array['owner','admin','manager','cashier']::text[]) then
    raise exception 'No tienes permisos para cobrar pedidos.' using errcode='42501';
  end if;
  select o.id,o.business_id,o.table_id,o.waiter_user_id,o.restaurant_waiter_id,o.status,o.subtotal,o.total
    into v_order from public.orders o where o.id=p_order_id and o.business_id=p_business_id for update;
  if not found then raise exception 'Pedido de vitrina no encontrado.' using errcode='P0002'; end if;
  if v_order.table_id is not null or v_order.waiter_user_id is not null or v_order.restaurant_waiter_id is not null then
    raise exception 'Este pedido no pertenece a la vitrina.' using errcode='22023';
  end if;
  if v_order.status not in ('pending','confirmed','preparing','ready') then
    raise exception 'Este pedido ya fue cerrado o cancelado.' using errcode='22023';
  end if;
  if exists(select 1 from public.sales s where s.business_id=p_business_id and s.order_id=p_order_id) then
    raise exception 'Este pedido ya tiene una venta registrada.' using errcode='23505';
  end if;
  if p_cash_session_id is null or not exists(
    select 1 from public.cash_sessions cs where cs.id=p_cash_session_id and cs.business_id=p_business_id
      and cs.status='open' and (p_branch_id is null or cs.branch_id=p_branch_id)
  ) then raise exception 'Debes tener una caja abierta para registrar la venta.' using errcode='22023'; end if;
  if p_payment_method is null or pg_catalog.length(pg_catalog.btrim(p_payment_method))=0 then
    raise exception 'Selecciona un método de pago.' using errcode='22023';
  end if;
  if not exists(select 1 from public.order_items oi where oi.order_id=p_order_id and oi.business_id=p_business_id) then
    raise exception 'El pedido no tiene productos.' using errcode='22023';
  end if;
  perform p.id from public.products p
   where p.business_id=p_business_id
     and p.id in (select oi.product_id from public.order_items oi
                   where oi.order_id=p_order_id and oi.business_id=p_business_id and oi.product_id is not null)
   order by p.id
   for update;
  for v_product in
    select p.id,p.name,p.stock,sum(oi.quantity)::integer as requested_quantity
      from public.products p
      join public.order_items oi on oi.product_id=p.id and oi.business_id=p_business_id
     where p.business_id=p_business_id and oi.order_id=p_order_id
     group by p.id,p.name,p.stock
     order by p.id
  loop
    if v_product.stock is not null and v_product.stock<v_product.requested_quantity then
      raise exception 'Stock insuficiente para %.',v_product.name using errcode='22023';
    end if;
  end loop;
  insert into public.sales(business_id,branch_id,cash_session_id,sold_by,subtotal,discount,total,payment_method,order_id)
  values(p_business_id,p_branch_id,p_cash_session_id,auth.uid(),v_order.subtotal,0,v_order.total,pg_catalog.btrim(p_payment_method),p_order_id)
  returning id into v_sale_id;
  for v_item in select oi.product_id,oi.product_name,oi.quantity,oi.unit_price,oi.line_total
    from public.order_items oi where oi.order_id=p_order_id and oi.business_id=p_business_id order by oi.id
  loop
    insert into public.sale_items(business_id,sale_id,product_id,product_name,quantity,unit_price,line_total)
    values(p_business_id,v_sale_id,v_item.product_id,v_item.product_name,v_item.quantity,v_item.unit_price,v_item.line_total);
    if v_item.product_id is not null then
      select p.id,p.stock into v_product from public.products p
        where p.id=v_item.product_id and p.business_id=p_business_id for update;
      if v_product.stock is not null then
        update public.products set stock=stock-v_item.quantity,updated_at=now()
          where id=v_item.product_id and business_id=p_business_id;
        insert into public.inventory_movements(business_id,product_id,branch_id,movement_type,quantity,reason,actor_id)
        values(p_business_id,v_item.product_id,p_branch_id,'out',v_item.quantity,'Pedido de vitrina cobrado en POS '||p_order_id::text,auth.uid());
      end if;
  for v_product in
    select p.id,p.stock,sum(oi.quantity)::integer as sold_quantity
      from public.products p
      join public.order_items oi on oi.product_id=p.id and oi.business_id=p_business_id
     where p.business_id=p_business_id and oi.order_id=p_order_id
     group by p.id,p.stock
     order by p.id
  loop
    if v_product.stock is not null then
      update public.products set stock=stock-v_product.sold_quantity,updated_at=now()
       where id=v_product.id and business_id=p_business_id;
      insert into public.inventory_movements(business_id,product_id,branch_id,movement_type,quantity,reason,actor_id)
      values(p_business_id,v_product.id,p_branch_id,'out',v_product.sold_quantity,
             'Pedido de vitrina cobrado en POS '||p_order_id::text,auth.uid());
    end if;
  end loop;

    end if;
  end loop;
  update public.orders set status='delivered',payment_method=pg_catalog.btrim(p_payment_method),updated_at=now()
    where id=p_order_id and business_id=p_business_id;
  return v_sale_id;
end;
$$;
revoke all on function public.pos_register_storefront_order_sale(uuid,uuid,uuid,text,uuid) from public,anon;
grant execute on function public.pos_register_storefront_order_sale(uuid,uuid,uuid,text,uuid) to authenticated;
