create or replace function public.platform_save_plan(p_plan_id uuid,p_code text,p_name text,p_price numeric,p_billing_period text,p_max_products integer,p_features jsonb,p_is_active boolean)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid; v_old_active boolean; v_old_name text;
begin
 if not exists(select 1 from public.platform_admins pa where pa.user_id=auth.uid()) then raise exception 'No tienes permisos de Superadmin.' using errcode='42501'; end if;
 if p_price < 0 or p_max_products < 1 or p_billing_period not in ('month','year') then raise exception 'Datos del plan inválidos.' using errcode='22023'; end if;
 if p_plan_id is null then
  insert into public.plans(code,name,price,billing_period,max_products,features,is_active)
  values(pg_catalog.lower(pg_catalog.regexp_replace(p_code,'[^a-zA-Z0-9_-]','','g')),p_name,p_price,p_billing_period,p_max_products,coalesce(p_features,'[]'::jsonb),p_is_active) returning id into v_id;
  insert into public.platform_audit_logs(actor_user_id,business_name,previous_status,new_status,note)
  values(auth.uid(),'Plan: '||p_name,null,case when p_is_active then 'active' else 'inactive' end,'Plan creado. Precio: '||p_price::text||' COP; periodicidad: '||p_billing_period);
 else
  select is_active,name into v_old_active,v_old_name from public.plans where id=p_plan_id for update;
  if not found then raise exception 'No se encontró el plan.' using errcode='P0002'; end if;
  update public.plans set code=pg_catalog.lower(pg_catalog.regexp_replace(p_code,'[^a-zA-Z0-9_-]','','g')),name=p_name,price=p_price,billing_period=p_billing_period,max_products=p_max_products,features=coalesce(p_features,'[]'::jsonb),is_active=p_is_active
  where id=p_plan_id returning id into v_id;
  insert into public.platform_audit_logs(actor_user_id,business_name,previous_status,new_status,note)
  values(auth.uid(),'Plan: '||p_name,case when v_old_active then 'active' else 'inactive' end,case when p_is_active then 'active' else 'inactive' end,'Plan actualizado. Nombre anterior: '||v_old_name||'; precio: '||p_price::text||' COP; periodicidad: '||p_billing_period);
 end if;
 return v_id;
end; $$;