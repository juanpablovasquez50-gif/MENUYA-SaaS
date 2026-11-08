-- Sector configuration foundation for the multi-industry SaaS.
alter table public.businesses add column if not exists sector_configured_at timestamptz;
update public.businesses set sector_configured_at = now() where sector_configured_at is null and nullif(pg_catalog.btrim(coalesce(business_type,'')), '') is not null;
create table if not exists public.business_modules (
  business_id uuid not null references public.businesses(id) on delete cascade,
  module_key text not null,
  enabled boolean not null default false,
  activation_source text not null default 'sector',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id, module_key),
  constraint business_modules_key_format check (module_key ~ '^[a-z][a-z0-9_]*$'),
  constraint business_modules_source_check check (activation_source in ('core','sector','manual'))
);

alter table public.business_modules enable row level security;

drop policy if exists business_modules_read on public.business_modules;
create policy business_modules_read on public.business_modules
for select to authenticated
using (private.has_business_role(business_id, array['owner','admin','manager']::text[]));

drop policy if exists business_modules_manage on public.business_modules;
create policy business_modules_manage on public.business_modules
for all to authenticated
using (private.has_business_role(business_id, array['owner','admin']::text[]))
with check (private.has_business_role(business_id, array['owner','admin']::text[]));

-- Backfill core modules and the modules implied by each existing sector.
insert into public.business_modules (business_id,module_key,enabled,activation_source)
select b.id, m.module_key, true, m.source
from public.businesses b
cross join lateral (
  values
    ('catalog','core'),
    ('orders','core'),
    ('inventory','core'),
    ('pos','core'),
    ('cash_register','core'),
    ('analytics','core'),
    ('restaurant_tools','sector'),
    ('pet_store_tools','sector'),
    ('apparel_tools','sector'),
    ('electronics_tools','sector'),
    ('services_tools','sector'),
    ('retail_tools','sector')
) as m(module_key,source)
where m.source='core'
   or (m.module_key='restaurant_tools' and lower(coalesce(b.business_type,'')) ~ '(restaurante|comida|cafeter|panader|reposter|bar)')
   or (m.module_key='pet_store_tools' and lower(coalesce(b.business_type,'')) ~ '(veterinar|mascota|pet)')
   or (m.module_key='apparel_tools' and lower(coalesce(b.business_type,'')) ~ '(ropa|moda|calzado|zapater)')
   or (m.module_key='electronics_tools' and lower(coalesce(b.business_type,'')) ~ '(tecnolog|electr|comput)')
   or (m.module_key='services_tools' and lower(coalesce(b.business_type,'')) ~ '(servicio|barber|belleza|peluquer)')
   or (m.module_key='retail_tools' and lower(coalesce(b.business_type,'')) ~ '(tienda|minimercado|retail|comercio)')
on conflict (business_id,module_key) do nothing;

create or replace function public.configure_business_sector(
  p_business_id uuid,
  p_business_type text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text := lower(pg_catalog.btrim(coalesce(p_business_type,'')));
begin
  if auth.uid() is null or not private.has_business_role(
    p_business_id, array['owner','admin']::text[]
  ) then
    raise exception 'No tienes permisos para configurar este comercio.' using errcode='42501';
  end if;
  if v_type not in ('restaurante','veterinaria','tienda de ropa','tecnologia','servicios','minimercado','otro') then
    raise exception 'Selecciona un tipo de negocio válido.' using errcode='22023';
  end if;

  update public.businesses
     set business_type = pg_catalog.btrim(p_business_type),
         sector_configured_at = now()
   where id = p_business_id;

  insert into public.business_modules(business_id,module_key,enabled,activation_source)
  values
    (p_business_id,'catalog',true,'core'),
    (p_business_id,'orders',true,'core'),
    (p_business_id,'inventory',true,'core'),
    (p_business_id,'pos',true,'core'),
    (p_business_id,'cash_register',true,'core'),
    (p_business_id,'analytics',true,'core')
  on conflict (business_id,module_key) do update
    set enabled=true, activation_source='core', updated_at=now();

  update public.business_modules
     set enabled=false, updated_at=now()
   where business_id=p_business_id and activation_source='sector';

  insert into public.business_modules(business_id,module_key,enabled,activation_source)
  values (
    p_business_id,
    case
      when v_type='restaurante' then 'restaurant_tools'
      when v_type='veterinaria' then 'pet_store_tools'
      when v_type='tienda de ropa' then 'apparel_tools'
      when v_type='tecnologia' then 'electronics_tools'
      when v_type='servicios' then 'services_tools'
      when v_type='minimercado' then 'retail_tools'
      else 'retail_tools'
    end,
    true,
    'sector'
  )
  on conflict (business_id,module_key) do update
    set enabled=true, activation_source='sector', updated_at=now();
end;
$$;

revoke all on function public.configure_business_sector(uuid,text) from public, anon;
grant execute on function public.configure_business_sector(uuid,text) to authenticated;
