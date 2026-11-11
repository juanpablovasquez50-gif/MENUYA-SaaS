-- CLICKOK Partners: partner acquisition, referral attribution and commission control.
-- This migration is versioned only. Do not apply to production without explicit approval.

create table if not exists public.platform_partners (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(btrim(full_name)) between 2 and 120),
  email text not null,
  phone text,
  partner_type text not null check (partner_type in ('influencer','commercial')),
  city text not null default 'Montería',
  status text not null default 'pending' check (status in ('pending','active','suspended','rejected')),
  referral_code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists platform_partners_email_lower_uidx on public.platform_partners (lower(email));

create table if not exists public.platform_partner_referrals (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.platform_partners(id) on delete restrict,
  business_id uuid not null unique references public.businesses(id) on delete restrict,
  referred_user_id uuid references auth.users(id) on delete set null,
  referral_code text not null,
  status text not null default 'registered' check (status in ('registered','qualified','reversed')),
  created_at timestamptz not null default now(),
  qualified_at timestamptz
);
create index if not exists platform_partner_referrals_partner_idx on public.platform_partner_referrals(partner_id, created_at desc);

create table if not exists public.platform_partner_commission_rules (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null unique references public.plans(id) on delete cascade,
  commission_amount numeric(12,2) not null default 0 check (commission_amount >= 0),
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_partner_commissions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.platform_partners(id) on delete restrict,
  referral_id uuid not null references public.platform_partner_referrals(id) on delete restrict,
  business_id uuid not null unique references public.businesses(id) on delete restrict,
  subscription_id uuid not null references public.subscriptions(id) on delete restrict,
  plan_id uuid not null references public.plans(id) on delete restrict,
  amount numeric(12,2) not null check (amount >= 0),
  status text not null default 'pending' check (status in ('pending','approved','paid','reversed')),
  payment_reference text,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  paid_at timestamptz
);
create index if not exists platform_partner_commissions_partner_idx on public.platform_partner_commissions(partner_id, created_at desc);

alter table public.platform_partners enable row level security;
alter table public.platform_partner_referrals enable row level security;
alter table public.platform_partner_commission_rules enable row level security;
alter table public.platform_partner_commissions enable row level security;
revoke all on public.platform_partners, public.platform_partner_referrals,
  public.platform_partner_commission_rules, public.platform_partner_commissions
  from public, anon, authenticated;

create or replace function public.platform_list_partners()
returns table (
  id uuid, full_name text, email text, phone text, partner_type text, city text,
  status text, referral_code text, created_at timestamptz,
  referral_count bigint, qualified_count bigint, pending_commission numeric, paid_commission numeric
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()) then
    raise exception 'No tienes permisos de Superadmin.' using errcode = '42501';
  end if;
  return query
    select p.id,p.full_name,p.email,p.phone,p.partner_type,p.city,p.status,p.referral_code,p.created_at,
      coalesce(r.referral_count,0)::bigint,coalesce(r.qualified_count,0)::bigint,
      coalesce(c.pending_commission,0)::numeric,coalesce(c.paid_commission,0)::numeric
    from public.platform_partners p
    left join lateral (
      select count(*)::bigint as referral_count,
        count(*) filter (where pr.status='qualified')::bigint as qualified_count
      from public.platform_partner_referrals pr where pr.partner_id=p.id
    ) r on true
    left join lateral (
      select sum(pc.amount) filter (where pc.status in ('pending','approved')) as pending_commission,
        sum(pc.amount) filter (where pc.status='paid') as paid_commission
      from public.platform_partner_commissions pc where pc.partner_id=p.id
    ) c on true
    order by p.created_at desc;
end; $$;

create or replace function public.platform_save_partner(
  p_partner_id uuid, p_full_name text, p_email text, p_phone text,
  p_partner_type text, p_city text, p_status text
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if not exists (select 1 from public.platform_admins pa where pa.user_id=auth.uid()) then
    raise exception 'No tienes permisos de Superadmin.' using errcode='42501';
  end if;
  if char_length(btrim(coalesce(p_full_name,''))) not between 2 and 120
    or position('@' in coalesce(p_email,'')) < 2
    or p_partner_type not in ('influencer','commercial')
    or p_status not in ('pending','active','suspended','rejected') then
    raise exception 'Revisa los datos del Partner.' using errcode='22023';
  end if;
  if p_partner_id is null then
    insert into public.platform_partners(full_name,email,phone,partner_type,city,status,referral_code)
    values(btrim(p_full_name),lower(btrim(p_email)),nullif(btrim(coalesce(p_phone,'')), ''),
      p_partner_type,coalesce(nullif(btrim(p_city),''),'Montería'),p_status,
      'CK'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)))
    returning id into v_id;
  else
    update public.platform_partners set full_name=btrim(p_full_name),email=lower(btrim(p_email)),
      phone=nullif(btrim(coalesce(p_phone,'')),''),partner_type=p_partner_type,
      city=coalesce(nullif(btrim(p_city),''),'Montería'),status=p_status,updated_at=now()
    where id=p_partner_id returning id into v_id;
    if v_id is null then raise exception 'No se encontró el Partner.' using errcode='P0002'; end if;
  end if;
  return v_id;
end; $$;

create or replace function public.platform_set_partner_status(p_partner_id uuid,p_status text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.platform_admins pa where pa.user_id=auth.uid()) then
    raise exception 'No tienes permisos de Superadmin.' using errcode='42501';
  end if;
  if p_status not in ('pending','active','suspended','rejected') then
    raise exception 'Estado de Partner no permitido.' using errcode='22023';
  end if;
  update public.platform_partners set status=p_status,updated_at=now() where id=p_partner_id;
  if not found then raise exception 'No se encontró el Partner.' using errcode='P0002'; end if;
end; $$;

create or replace function public.platform_list_partner_referrals()
returns table (
  id uuid, partner_id uuid, partner_name text, business_id uuid, business_name text,
  business_type text, owner_email text, referral_code text, status text,
  created_at timestamptz, qualified_at timestamptz, plan_name text, subscription_status text
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.platform_admins pa where pa.user_id=auth.uid()) then
    raise exception 'No tienes permisos de Superadmin.' using errcode='42501';
  end if;
  return query
    select r.id,r.partner_id,p.full_name,b.id,b.name,b.business_type,au.email,r.referral_code,r.status,
      r.created_at,r.qualified_at,pl.name,s.status
    from public.platform_partner_referrals r
    join public.platform_partners p on p.id=r.partner_id
    join public.businesses b on b.id=r.business_id
    left join auth.users au on au.id=b.owner_id
    left join lateral (
      select ss.plan_id,ss.status from public.subscriptions ss
      where ss.business_id=b.id order by ss.created_at desc limit 1
    ) s on true
    left join public.plans pl on pl.id=s.plan_id
    order by r.created_at desc;
end; $$;

create or replace function public.platform_list_partner_commission_rules()
returns table (plan_id uuid,plan_name text,plan_price numeric,commission_amount numeric,is_active boolean)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.platform_admins pa where pa.user_id=auth.uid()) then
    raise exception 'No tienes permisos de Superadmin.' using errcode='42501';
  end if;
  return query select p.id,p.name,p.price,coalesce(r.commission_amount,0),coalesce(r.is_active,false)
    from public.plans p left join public.platform_partner_commission_rules r on r.plan_id=p.id
    order by p.price,p.name;
end; $$;

create or replace function public.platform_save_partner_commission_rule(p_plan_id uuid,p_amount numeric,p_is_active boolean)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.platform_admins pa where pa.user_id=auth.uid()) then
    raise exception 'No tienes permisos de Superadmin.' using errcode='42501';
  end if;
  if p_amount < 0 or not exists(select 1 from public.plans where id=p_plan_id) then
    raise exception 'Regla de comisión inválida.' using errcode='22023';
  end if;
  insert into public.platform_partner_commission_rules(plan_id,commission_amount,is_active,updated_at)
  values(p_plan_id,p_amount,p_is_active,now())
  on conflict(plan_id) do update set commission_amount=excluded.commission_amount,
    is_active=excluded.is_active,updated_at=now();
end; $$;

create or replace function public.platform_list_partner_commissions()
returns table (
  id uuid,partner_id uuid,partner_name text,business_name text,plan_name text,
  amount numeric,status text,created_at timestamptz,paid_at timestamptz,payment_reference text
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.platform_admins pa where pa.user_id=auth.uid()) then
    raise exception 'No tienes permisos de Superadmin.' using errcode='42501';
  end if;
  return query select c.id,c.partner_id,p.full_name,b.name,pl.name,c.amount,c.status,
    c.created_at,c.paid_at,c.payment_reference
    from public.platform_partner_commissions c
    join public.platform_partners p on p.id=c.partner_id
    join public.businesses b on b.id=c.business_id
    join public.plans pl on pl.id=c.plan_id
    order by c.created_at desc;
end; $$;

create or replace function public.platform_set_partner_commission_status(
  p_commission_id uuid,p_status text,p_payment_reference text default null
)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.platform_admins pa where pa.user_id=auth.uid()) then
    raise exception 'No tienes permisos de Superadmin.' using errcode='42501';
  end if;
  if p_status not in ('pending','approved','paid','reversed') then
    raise exception 'Estado de comisión no permitido.' using errcode='22023';
  end if;
  if p_status='paid' and char_length(btrim(coalesce(p_payment_reference,'')))<3 then
    raise exception 'Registra la referencia del pago al marcar una comisión como pagada.' using errcode='22023';
  end if;
  update public.platform_partner_commissions
  set status=p_status,
    approved_at=case when p_status in ('approved','paid') then coalesce(approved_at,now()) else approved_at end,
    paid_at=case when p_status='paid' then now() else paid_at end,
    payment_reference=case when p_status='paid' then btrim(p_payment_reference) else payment_reference end
  where id=p_commission_id;
  if not found then raise exception 'No se encontró la comisión.' using errcode='P0002'; end if;
end; $$;

-- A referred business is attributed only at initial provisioning; existing businesses are not reassigned.
-- Remove the legacy five-argument overload so calls with defaulted arguments are unambiguous.
drop function if exists public.register_business(text,text,text,text,text);
create or replace function public.register_business(
  p_name text,p_slug text,p_business_type text,p_phone text default null,
  p_email text default null,p_referral_code text default null
)
returns table(id uuid,name text,slug text,status text,is_published boolean)
language plpgsql security definer set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_business_id uuid;
  v_slug text;
  v_plan_id uuid;
  v_partner_id uuid;
  v_code text := upper(btrim(coalesce(p_referral_code,'')));
begin
  if v_user_id is null then raise exception 'Debes iniciar sesión para registrar un comercio.' using errcode='42501'; end if;
  if char_length(btrim(coalesce(p_name,''))) not between 2 and 100 then raise exception 'El nombre del comercio debe tener entre 2 y 100 caracteres.'; end if;
  if char_length(btrim(coalesce(p_business_type,''))) not between 2 and 80 then raise exception 'Selecciona un sector válido.'; end if;

  select b.id into v_business_id from public.businesses b
  where b.owner_id=v_user_id order by b.created_at desc limit 1;
  if v_business_id is not null then
    return query select b.id,b.name,b.slug,b.status,b.is_published from public.businesses b where b.id=v_business_id;
    return;
  end if;

  v_slug:=lower(btrim(coalesce(p_slug,'')));
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'El enlace de la tienda no tiene un formato válido.'; end if;
  if exists(select 1 from public.businesses b where b.slug=v_slug) then
    v_slug:=left(v_slug,52)||'-'||substr(replace(v_user_id::text,'-',''),1,10);
  end if;
  if exists(select 1 from public.businesses b where b.slug=v_slug) then raise exception 'No fue posible reservar un enlace único para el comercio. Inténtalo nuevamente.'; end if;
  select p.id into v_plan_id from public.plans p where p.code='free' and p.is_active=true limit 1;
  if v_plan_id is null then raise exception 'No está disponible el plan gratuito para crear el comercio.'; end if;

  insert into public.businesses(owner_id,name,slug,business_type,phone,email,status,is_published)
  values(v_user_id,btrim(p_name),v_slug,btrim(p_business_type),
    nullif(btrim(coalesce(p_phone,'')),''),nullif(lower(btrim(coalesce(p_email,''))),''),'pending',false)
  returning businesses.id into v_business_id;
  insert into public.categories(business_id,name,sort_order,is_active) values(v_business_id,'Favoritos',0,true);
  insert into public.store_settings(business_id,brand_color,font_family,contact_text,payment_methods,social_links,is_published,tagline)
  values(v_business_id,'#252525','Manrope',nullif(btrim(coalesce(p_phone,'')),''),'["Efectivo","Nequi","Transferencia"]'::jsonb,'{}'::jsonb,false,'Tu negocio, en su propio lugar.');
  insert into public.subscriptions(business_id,plan_id,status,starts_at)
  values(v_business_id,v_plan_id,'pending',now());

  if v_code<>'' then
    select pp.id into v_partner_id
    from public.platform_partners pp
    where pp.referral_code=v_code
      and pp.status='active'
      -- A Partner cannot earn referral credit for their own account/business.
      and not exists (
        select 1
        from auth.users referred_user
        where referred_user.id=v_user_id
          and lower(btrim(coalesce(referred_user.email,'')))=lower(btrim(pp.email))
      )
    limit 1;
    if v_partner_id is not null then
      insert into public.platform_partner_referrals(partner_id,business_id,referred_user_id,referral_code)
      values(v_partner_id,v_business_id,v_user_id,v_code)
      on conflict(business_id) do nothing;
    end if;
  end if;

  return query select b.id,b.name,b.slug,b.status,b.is_published from public.businesses b where b.id=v_business_id;
end;
$function$;

-- A commission is created once per referred business, only when its subscription is activated
-- with an external payment reference. The admin must approve and record the payout.
create or replace function public.create_partner_commission_after_subscription_activation()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_referral public.platform_partner_referrals%rowtype;
  v_rule public.platform_partner_commission_rules%rowtype;
  v_should_check boolean := false;
begin
  if tg_op='INSERT' then
    v_should_check := true;
  else
    v_should_check := old.status is distinct from new.status
      or old.external_reference is distinct from new.external_reference;
  end if;
  if new.status='active' and nullif(btrim(coalesce(new.external_reference,'')),'') is not null
    and v_should_check then
    select r.* into v_referral from public.platform_partner_referrals r
    join public.platform_partners p on p.id=r.partner_id and p.status='active'
    where r.business_id=new.business_id and r.status='registered'
    limit 1;
    if found then
      select cr.* into v_rule from public.platform_partner_commission_rules cr
      where cr.plan_id=new.plan_id and cr.is_active=true;
      if found and v_rule.commission_amount>0 then
        insert into public.platform_partner_commissions(partner_id,referral_id,business_id,subscription_id,plan_id,amount)
        values(v_referral.partner_id,v_referral.id,new.business_id,new.id,new.plan_id,v_rule.commission_amount)
        on conflict(business_id) do nothing;
        update public.platform_partner_referrals set status='qualified',qualified_at=coalesce(qualified_at,now())
        where id=v_referral.id;
      end if;
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_partner_commission_subscription_activation on public.subscriptions;
create trigger trg_partner_commission_subscription_activation
after insert or update of status,external_reference,plan_id on public.subscriptions
for each row execute function public.create_partner_commission_after_subscription_activation();

revoke all on function public.platform_list_partners() from public,anon;
revoke all on function public.platform_save_partner(uuid,text,text,text,text,text,text) from public,anon;
revoke all on function public.platform_set_partner_status(uuid,text) from public,anon;
revoke all on function public.platform_list_partner_referrals() from public,anon;
revoke all on function public.platform_list_partner_commission_rules() from public,anon;
revoke all on function public.platform_save_partner_commission_rule(uuid,numeric,boolean) from public,anon;
revoke all on function public.platform_list_partner_commissions() from public,anon;
revoke all on function public.platform_set_partner_commission_status(uuid,text,text) from public,anon;
revoke all on function public.register_business(text,text,text,text,text,text) from public,anon;
grant execute on function public.platform_list_partners() to authenticated;
grant execute on function public.platform_save_partner(uuid,text,text,text,text,text,text) to authenticated;
grant execute on function public.platform_set_partner_status(uuid,text) to authenticated;
grant execute on function public.platform_list_partner_referrals() to authenticated;
grant execute on function public.platform_list_partner_commission_rules() to authenticated;
grant execute on function public.platform_save_partner_commission_rule(uuid,numeric,boolean) to authenticated;
grant execute on function public.platform_list_partner_commissions() to authenticated;
grant execute on function public.platform_set_partner_commission_status(uuid,text,text) to authenticated;
grant execute on function public.register_business(text,text,text,text,text,text) to authenticated;
