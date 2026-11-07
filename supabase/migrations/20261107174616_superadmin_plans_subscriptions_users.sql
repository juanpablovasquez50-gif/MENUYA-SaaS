create or replace function public.platform_list_plans()
returns table(id uuid, code text, name text, price numeric, billing_period text, max_products integer, features jsonb, is_active boolean, created_at timestamptz, subscription_count bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()) then
    raise exception 'No tienes permisos de Superadmin.' using errcode = '42501';
  end if;
  return query select p.id,p.code,p.name,p.price,p.billing_period,p.max_products,p.features,p.is_active,p.created_at,count(s.id)::bigint
  from public.plans p left join public.subscriptions s on s.plan_id=p.id group by p.id order by p.price,p.created_at;
end; $$;

create or replace function public.platform_list_subscriptions()
returns table(id uuid,business_id uuid,business_name text,owner_id uuid,owner_name text,owner_email text,plan_id uuid,plan_name text,price numeric,status text,starts_at timestamptz,ends_at timestamptz,external_reference text,created_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()) then
    raise exception 'No tienes permisos de Superadmin.' using errcode = '42501';
  end if;
  return query select s.id,s.business_id,b.name,b.owner_id,pr.full_name,au.email,s.plan_id,p.name,p.price,s.status,s.starts_at,s.ends_at,s.external_reference,s.created_at
  from public.subscriptions s join public.businesses b on b.id=s.business_id join public.plans p on p.id=s.plan_id
  left join public.profiles pr on pr.id=b.owner_id left join auth.users au on au.id=b.owner_id order by s.created_at desc;
end; $$;

create or replace function public.platform_list_users()
returns table(user_id uuid,email text,full_name text,phone text,created_at timestamptz,business_count bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()) then
    raise exception 'No tienes permisos de Superadmin.' using errcode = '42501';
  end if;
  return query select au.id,au.email,pr.full_name,pr.phone,au.created_at,count(distinct bm.business_id)::bigint
  from auth.users au left join public.profiles pr on pr.id=au.id
  left join public.business_memberships bm on bm.user_id=au.id and bm.status='active'
  group by au.id,au.email,pr.full_name,pr.phone,au.created_at order by au.created_at desc;
end; $$;

create or replace function public.platform_update_subscription(p_subscription_id uuid,p_plan_id uuid,p_status text,p_ends_at timestamptz,p_note text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_business_id uuid; v_business_name text; v_old_status text;
begin
  if not exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()) then
    raise exception 'No tienes permisos de Superadmin.' using errcode = '42501';
  end if;
  if p_status not in ('pending','active','past_due','cancelled','expired') then raise exception 'Estado de suscripción no permitido.' using errcode = '22023'; end if;
  if not exists(select 1 from public.plans where id=p_plan_id) then raise exception 'El plan seleccionado no existe.' using errcode = '22023'; end if;
  select s.business_id,b.name,s.status into v_business_id,v_business_name,v_old_status
  from public.subscriptions s join public.businesses b on b.id=s.business_id where s.id=p_subscription_id for update of s;
  if not found then raise exception 'No se encontró la suscripción.' using errcode = 'P0002'; end if;
  update public.subscriptions set plan_id=p_plan_id,status=p_status,ends_at=p_ends_at where id=p_subscription_id;
  insert into public.platform_audit_logs(actor_user_id,business_id,business_name,previous_status,new_status,note)
  values(auth.uid(),v_business_id,v_business_name,v_old_status,p_status,concat('Suscripción actualizada. Plan: ',p_plan_id::text,'. ',coalesce(nullif(pg_catalog.btrim(p_note),''),'')));
end; $$;

create or replace function public.platform_save_plan(p_plan_id uuid,p_code text,p_name text,p_price numeric,p_billing_period text,p_max_products integer,p_features jsonb,p_is_active boolean)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
 if not exists(select 1 from public.platform_admins pa where pa.user_id=auth.uid()) then raise exception 'No tienes permisos de Superadmin.' using errcode='42501'; end if;
 if p_price < 0 or p_max_products < 1 or p_billing_period not in ('month','year') then raise exception 'Datos del plan inválidos.' using errcode='22023'; end if;
 if p_plan_id is null then
  insert into public.plans(code,name,price,billing_period,max_products,features,is_active)
  values(pg_catalog.lower(pg_catalog.regexp_replace(p_code,'[^a-zA-Z0-9_-]','','g')),p_name,p_price,p_billing_period,p_max_products,coalesce(p_features,'[]'::jsonb),p_is_active) returning id into v_id;
 else
  update public.plans set code=pg_catalog.lower(pg_catalog.regexp_replace(p_code,'[^a-zA-Z0-9_-]','','g')),name=p_name,price=p_price,billing_period=p_billing_period,max_products=p_max_products,features=coalesce(p_features,'[]'::jsonb),is_active=p_is_active
  where id=p_plan_id returning id into v_id;
  if v_id is null then raise exception 'No se encontró el plan.' using errcode='P0002'; end if;
 end if;
 return v_id;
end; $$;

revoke all on function public.platform_list_plans() from public;
revoke all on function public.platform_list_subscriptions() from public;
revoke all on function public.platform_list_users() from public;
revoke all on function public.platform_update_subscription(uuid,uuid,text,timestamptz,text) from public;
revoke all on function public.platform_save_plan(uuid,text,text,numeric,text,integer,jsonb,boolean) from public;
grant execute on function public.platform_list_plans() to authenticated;
grant execute on function public.platform_list_subscriptions() to authenticated;
grant execute on function public.platform_list_users() to authenticated;
grant execute on function public.platform_update_subscription(uuid,uuid,text,timestamptz,text) to authenticated;
grant execute on function public.platform_save_plan(uuid,text,text,numeric,text,integer,jsonb,boolean) to authenticated;
