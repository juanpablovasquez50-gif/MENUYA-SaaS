-- MENUYA: atomic tenant provisioning after email verification.
-- Requires the MENUYA base schema and the owner-membership trigger.

create or replace function public.register_business(
  p_name text,
  p_slug text,
  p_business_type text,
  p_phone text default null,
  p_email text default null
)
returns table (
  id uuid,
  name text,
  slug text,
  status text,
  is_published boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_business_id uuid;
  v_slug text;
  v_plan_id uuid;
begin
  if v_user_id is null then
    raise exception 'Debes iniciar sesión para registrar un comercio.'
      using errcode = '42501';
  end if;

  if pg_catalog.length(pg_catalog.btrim(pg_catalog.coalesce(p_name, ''))) < 2
     or pg_catalog.length(pg_catalog.btrim(p_name)) > 100 then
    raise exception 'El nombre del comercio debe tener entre 2 y 100 caracteres.';
  end if;

  if pg_catalog.length(pg_catalog.btrim(pg_catalog.coalesce(p_business_type, ''))) < 2
     or pg_catalog.length(pg_catalog.btrim(p_business_type)) > 80 then
    raise exception 'Selecciona un sector válido.';
  end if;

  select b.id into v_business_id
  from public.businesses b
  where b.owner_id = v_user_id
  order by b.created_at desc
  limit 1;

  if v_business_id is not null then
    return query
      select b.id, b.name, b.slug, b.status, b.is_published
      from public.businesses b
      where b.id = v_business_id;
    return;
  end if;

  v_slug := pg_catalog.lower(pg_catalog.btrim(pg_catalog.coalesce(p_slug, '')));
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'El enlace de la tienda no tiene un formato válido.';
  end if;

  if exists (select 1 from public.businesses b where b.slug = v_slug) then
    v_slug := pg_catalog.left(v_slug, 52) || '-' ||
      pg_catalog.substr(pg_catalog.replace(v_user_id::text, '-', ''), 1, 10);
  end if;

  if exists (select 1 from public.businesses b where b.slug = v_slug) then
    raise exception 'No fue posible reservar un enlace único para el comercio. Inténtalo nuevamente.';
  end if;

  select p.id into v_plan_id
  from public.plans p
  where p.code = 'free' and p.is_active = true
  limit 1;

  if v_plan_id is null then
    raise exception 'No está disponible el plan gratuito para crear el comercio.';
  end if;

  insert into public.businesses (
    owner_id, name, slug, business_type, phone, email, status, is_published
  ) values (
    v_user_id,
    pg_catalog.btrim(p_name),
    v_slug,
    pg_catalog.btrim(p_business_type),
    nullif(pg_catalog.btrim(pg_catalog.coalesce(p_phone, '')), ''),
    nullif(pg_catalog.lower(pg_catalog.btrim(pg_catalog.coalesce(p_email, ''))), ''),
    'pending',
    false
  )
  returning businesses.id into v_business_id;

  insert into public.categories (business_id, name, sort_order, is_active)
  values (v_business_id, 'Favoritos', 0, true);

  insert into public.store_settings (
    business_id, brand_color, font_family, contact_text,
    payment_methods, social_links, is_published, tagline
  ) values (
    v_business_id, '#252525', 'Manrope',
    nullif(pg_catalog.btrim(pg_catalog.coalesce(p_phone, '')), ''),
    '["Efectivo","Nequi","Transferencia"]'::jsonb,
    '{}'::jsonb, false, 'Tu negocio, en su propio lugar.'
  );

  insert into public.subscriptions (business_id, plan_id, status, starts_at)
  values (v_business_id, v_plan_id, 'pending', pg_catalog.now());

  return query
    select b.id, b.name, b.slug, b.status, b.is_published
    from public.businesses b
    where b.id = v_business_id;
end;
$function$;

revoke all on function public.register_business(text, text, text, text, text) from public;
revoke all on function public.register_business(text, text, text, text, text) from anon;
grant execute on function public.register_business(text, text, text, text, text) to authenticated;

-- Direct INSERT is intentionally disabled: new tenants must use the validated RPC.
drop policy if exists businesses_insert_owner on public.businesses;
