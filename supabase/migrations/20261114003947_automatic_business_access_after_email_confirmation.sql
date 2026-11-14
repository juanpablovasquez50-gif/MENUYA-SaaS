create or replace function public.register_business(
  p_name text,
  p_slug text,
  p_business_type text,
  p_phone text default null,
  p_email text default null,
  p_referral_code text default null
)
returns table(id uuid, name text, slug text, status text, is_published boolean)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_business_id uuid;
  v_slug text;
  v_plan_id uuid;
  v_partner_id uuid;
  v_code text := upper(btrim(coalesce(p_referral_code, '')));
begin
  if v_user_id is null then
    raise exception 'Debes iniciar sesión para registrar un comercio.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 2 and 100 then
    raise exception 'El nombre del comercio debe tener entre 2 y 100 caracteres.';
  end if;
  if char_length(btrim(coalesce(p_business_type, ''))) not between 2 and 80 then
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

  v_slug := lower(btrim(coalesce(p_slug, '')));
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'El enlace de la tienda no tiene un formato válido.';
  end if;
  if exists (select 1 from public.businesses b where b.slug = v_slug) then
    v_slug := left(v_slug, 52) || '-' || substr(replace(v_user_id::text, '-', ''), 1, 10);
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

  -- Email verification is the access gate. Document review is a separate process.
  -- Keep the storefront private until the owner publishes it from the dashboard.
  insert into public.businesses(owner_id, name, slug, business_type, phone, email, status, is_published)
  values (
    v_user_id,
    btrim(p_name),
    v_slug,
    btrim(p_business_type),
    nullif(btrim(coalesce(p_phone, '')), ''),
    nullif(lower(btrim(coalesce(p_email, ''))), ''),
    'active',
    false
  )
  returning businesses.id into v_business_id;

  insert into public.categories(business_id, name, sort_order, is_active)
  values (v_business_id, 'Favoritos', 0, true);

  insert into public.store_settings(
    business_id, brand_color, font_family, contact_text, payment_methods, social_links, is_published, tagline
  )
  values (
    v_business_id,
    '#252525',
    'Manrope',
    nullif(btrim(coalesce(p_phone, '')), ''),
    '["Efectivo","Nequi","Transferencia"]'::jsonb,
    '{}'::jsonb,
    false,
    'Tu negocio, en su propio lugar.'
  );

  insert into public.subscriptions(business_id, plan_id, status, starts_at)
  values (v_business_id, v_plan_id, 'active', now());

  if v_code <> '' then
    select pp.id into v_partner_id
    from public.platform_partners pp
    where pp.referral_code = v_code
      and pp.status = 'active'
      -- A Partner cannot earn referral credit for their own account/business.
      and not exists (
        select 1
        from auth.users referred_user
        where referred_user.id = v_user_id
          and lower(btrim(coalesce(referred_user.email, ''))) = lower(btrim(pp.email))
      )
    limit 1;

    if v_partner_id is not null then
      insert into public.platform_partner_referrals(partner_id, business_id, referred_user_id, referral_code)
      values (v_partner_id, v_business_id, v_user_id, v_code)
      on conflict (business_id) do nothing;
    end if;
  end if;

  return query
    select b.id, b.name, b.slug, b.status, b.is_published
    from public.businesses b
    where b.id = v_business_id;
end;
$function$;
