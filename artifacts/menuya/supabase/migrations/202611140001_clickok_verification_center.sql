-- CLICKOK verification center: purple documentary verification + silver/gold achievement tiers.
-- Additive migration; it does not change production or existing business approval states.

create table if not exists public.business_verifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses(id) on delete cascade,
  level text not null default 'purple' check (level in ('purple','silver','gold')),
  status text not null default 'pending' check (status in ('approved','pending','suspended')),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.business_verifications enable row level security;
revoke all on public.business_verifications from anon, authenticated;

-- Keep the current purple documentary approval for businesses already approved by CLICKOK.
insert into public.business_verifications (business_id, level, status, approved_at, note)
select b.id, 'purple', 'approved', now(),
       'Verificación documental vigente antes de habilitar el Centro de verificaciones.'
from public.businesses b
where b.status = 'active'
on conflict (business_id) do nothing;

create or replace function public.platform_list_verifications()
returns table (
  business_id uuid,
  business_name text,
  business_type text,
  email text,
  phone text,
  business_status text,
  created_at timestamptz,
  verification_level text,
  verification_status text,
  verification_note text,
  approved_at timestamptz,
  product_count integer,
  completed_orders integer,
  eligible_orders integer,
  completion_rate numeric,
  days_active integer,
  profile_complete boolean,
  has_purple boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if not exists (
    select 1 from public.platform_admins pa where pa.user_id = auth.uid()
  ) then
    raise exception 'No tienes permisos de Superadmin.' using errcode = '42501';
  end if;

  return query
    select
      b.id,
      b.name,
      b.business_type,
      b.email,
      b.phone,
      b.status,
      b.created_at,
      coalesce(v.level, 'purple'::text),
      coalesce(v.status, case when b.status = 'active' then 'approved' else 'pending' end),
      v.note,
      v.approved_at,
      coalesce(p.product_count, 0)::integer,
      coalesce(o.completed_orders, 0)::integer,
      coalesce(o.eligible_orders, 0)::integer,
      case when coalesce(o.eligible_orders, 0) = 0 then 0::numeric
           else round((coalesce(o.completed_orders, 0)::numeric / o.eligible_orders::numeric) * 100, 1)
      end,
      greatest(0, floor(extract(epoch from (now() - b.created_at)) / 86400))::integer,
      (
        nullif(btrim(coalesce(b.name, '')), '') is not null
        and nullif(btrim(coalesce(b.email, '')), '') is not null
        and nullif(btrim(coalesce(b.phone, '')), '') is not null
        and nullif(btrim(coalesce(b.business_type, '')), '') is not null
        and nullif(btrim(coalesce(ss.tagline, '')), '') is not null
        and nullif(btrim(coalesce(ss.logo_url, '')), '') is not null
      ),
      (b.status = 'active')
    from public.businesses b
    left join public.business_verifications v on v.business_id = b.id
    left join public.store_settings ss on ss.business_id = b.id
    left join lateral (
      select count(*)::integer as product_count
      from public.products pr
      where pr.business_id = b.id and pr.is_active = true
    ) p on true
    left join lateral (
      select
        count(*) filter (where o.status = 'delivered')::integer as completed_orders,
        count(*) filter (where o.status <> 'cancelled')::integer as eligible_orders
      from public.orders o
      where o.business_id = b.id
    ) o on true
    order by b.created_at desc;
end;
$function$;

create or replace function public.platform_review_verification(
  p_business_id uuid,
  p_level text,
  p_status text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_business public.businesses%rowtype;
  v_old_level text;
  v_old_status text;
  v_product_count integer;
  v_completed_orders integer;
  v_eligible_orders integer;
  v_days_active integer;
  v_profile_complete boolean;
  v_silver_approved boolean;
  v_name text;
begin
  if not exists (
    select 1 from public.platform_admins pa where pa.user_id = auth.uid()
  ) then
    raise exception 'No tienes permisos de Superadmin.' using errcode = '42501';
  end if;

  if p_level not in ('silver','gold') or p_status not in ('approved','suspended') then
    raise exception 'Nivel o estado de verificación no permitido.' using errcode = '22023';
  end if;

  select * into v_business from public.businesses where id = p_business_id for update;
  if not found then
    raise exception 'No se encontró el comercio.' using errcode = 'P0002';
  end if;
  if v_business.status <> 'active' then
    raise exception 'El comercio debe tener vigente su aprobación documental morada.' using errcode = '23514';
  end if;

  select v.level, v.status into v_old_level, v_old_status
  from public.business_verifications v where v.business_id = p_business_id;

  select count(*)::integer into v_product_count
  from public.products p
  where p.business_id = p_business_id and p.is_active = true;

  select
    count(*) filter (where o.status = 'delivered')::integer,
    count(*) filter (where o.status <> 'cancelled')::integer
  into v_completed_orders, v_eligible_orders
  from public.orders o
  where o.business_id = p_business_id;

  v_days_active := greatest(0, floor(extract(epoch from (now() - v_business.created_at)) / 86400))::integer;

  select (
    nullif(btrim(coalesce(v_business.name, '')), '') is not null
    and nullif(btrim(coalesce(v_business.email, '')), '') is not null
    and nullif(btrim(coalesce(v_business.phone, '')), '') is not null
    and nullif(btrim(coalesce(v_business.business_type, '')), '') is not null
    and nullif(btrim(coalesce(ss.tagline, '')), '') is not null
    and nullif(btrim(coalesce(ss.logo_url, '')), '') is not null
  ) into v_profile_complete
  from public.store_settings ss
  where ss.business_id = p_business_id;
  v_profile_complete := coalesce(v_profile_complete, false);

  if p_status = 'approved' then
    if p_level = 'silver' then
      if v_days_active < 30 or v_completed_orders < 30 or v_product_count < 10 or not v_profile_complete then
        raise exception 'No cumple todos los requisitos de CLICKOK Plata (30 días, 30 ventas entregadas, 10 productos activos y perfil completo).' using errcode = '23514';
      end if;
    else
      select exists (
        select 1 from public.business_verifications bv
        where bv.business_id = p_business_id
          and ((bv.level = 'silver' and bv.status = 'approved')
               or (bv.level = 'gold' and bv.status = 'suspended'))
      ) into v_silver_approved;

      if not v_silver_approved then
        raise exception 'Primero debe tener CLICKOK Plata aprobada.' using errcode = '23514';
      end if;
      if v_days_active < 90 or v_completed_orders < 200 or v_product_count < 20
         or v_eligible_orders = 0
         or (v_completed_orders::numeric / v_eligible_orders::numeric) < 0.95 then
        raise exception 'No cumple todos los requisitos de CLICKOK Oro (90 días, 200 ventas entregadas, 20 productos activos y 95% de pedidos completados).' using errcode = '23514';
      end if;
    end if;
  end if;

  insert into public.business_verifications (
    business_id, level, status, approved_by, approved_at, note, updated_at
  ) values (
    p_business_id, p_level, p_status,
    case when p_status = 'approved' then auth.uid() else null end,
    case when p_status = 'approved' then now() else null end,
    nullif(btrim(coalesce(p_note, '')), ''),
    now()
  )
  on conflict (business_id) do update set
    level = excluded.level,
    status = excluded.status,
    approved_by = excluded.approved_by,
    approved_at = excluded.approved_at,
    note = excluded.note,
    updated_at = now();

  select name into v_name from public.businesses where id = p_business_id;

  insert into public.platform_audit_logs (
    actor_user_id, business_id, business_name, previous_status, new_status, note
  ) values (
    auth.uid(), p_business_id, coalesce(v_name, 'Comercio'),
    coalesce(v_old_level, 'purple') || ':' || coalesce(v_old_status, 'approved'),
    p_level || ':' || p_status,
    nullif(btrim(coalesce(p_note, '')), '')
  );
end;
$function$;

revoke all on function public.platform_list_verifications() from public, anon;
revoke all on function public.platform_review_verification(uuid, text, text, text) from public, anon;
grant execute on function public.platform_list_verifications() to authenticated;
grant execute on function public.platform_review_verification(uuid, text, text, text) to authenticated;
