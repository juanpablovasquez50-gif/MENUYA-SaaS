-- Permit an active team member as well as the business owner to view that business's badge progress.
create or replace function private.merchant_verification_progress(p_business_id uuid)
returns table (
  business_id uuid, verification_level text, verification_status text, verification_note text,
  approved_at timestamptz, product_count integer, sales_count integer, completed_orders integer,
  eligible_orders integer, completion_rate numeric, days_active integer, profile_complete boolean, has_purple boolean
)
language plpgsql stable security definer set search_path = ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.businesses b
    where b.id = p_business_id and b.owner_id = auth.uid()
  ) and not exists (
    select 1 from public.business_memberships bm
    where bm.business_id = p_business_id and bm.user_id = auth.uid() and bm.status = 'active'
  ) then
    raise exception 'No tienes acceso a este comercio.' using errcode = '42501';
  end if;

  return query
  select b.id, coalesce(v.level, 'purple'::text),
    coalesce(v.status, case when b.is_verified then 'approved' else 'pending' end),
    v.note, v.approved_at, coalesce(p.product_count, 0)::integer, coalesce(s.sales_count, 0)::integer,
    coalesce(o.completed_orders, 0)::integer, coalesce(o.eligible_orders, 0)::integer,
    case when coalesce(o.eligible_orders, 0) = 0 then 0::numeric
      else round((coalesce(o.completed_orders, 0)::numeric / o.eligible_orders::numeric) * 100, 1) end,
    greatest(0, floor(extract(epoch from (now() - b.created_at)) / 86400))::integer,
    (nullif(btrim(coalesce(b.name, '')), '') is not null
      and nullif(btrim(coalesce(b.email, '')), '') is not null
      and nullif(btrim(coalesce(b.phone, '')), '') is not null
      and nullif(btrim(coalesce(b.business_type, '')), '') is not null
      and nullif(btrim(coalesce(ss.tagline, '')), '') is not null
      and nullif(btrim(coalesce(ss.logo_url, '')), '') is not null),
    (b.is_verified = true)
  from public.businesses b
  left join public.business_verifications v on v.business_id = b.id
  left join public.store_settings ss on ss.business_id = b.id
  left join lateral (select count(*)::integer as product_count from public.products pr where pr.business_id = b.id and pr.is_active = true) p on true
  left join lateral (select count(*)::integer as sales_count from public.sales sa where sa.business_id = b.id) s on true
  left join lateral (
    select count(*) filter (where ord.status = 'delivered')::integer as completed_orders,
      count(*) filter (where ord.status <> 'cancelled')::integer as eligible_orders
    from public.orders ord where ord.business_id = b.id
  ) o on true
  where b.id = p_business_id;
end;
$function$;

revoke all on function private.merchant_verification_progress(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.merchant_verification_progress(uuid) to authenticated;
