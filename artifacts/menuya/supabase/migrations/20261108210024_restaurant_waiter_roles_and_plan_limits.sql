alter table public.business_memberships
  drop constraint if exists business_memberships_role_check;
alter table public.business_memberships
  add constraint business_memberships_role_check
  check (role = any (array['owner','admin','manager','catalog','orders','cashier','waiter']::text[]));

create table if not exists public.restaurant_plan_limits (
  plan_id uuid primary key references public.plans(id) on delete cascade,
  max_waiters integer not null check (max_waiters >= 0),
  updated_at timestamptz not null default now()
);

alter table public.restaurant_plan_limits enable row level security;

drop policy if exists restaurant_plan_limits_read_active on public.restaurant_plan_limits;
create policy restaurant_plan_limits_read_active
  on public.restaurant_plan_limits
  for select to authenticated
  using (
    exists (
      select 1
      from public.subscriptions s
      join public.business_memberships bm on bm.business_id = s.business_id
      join public.businesses b on b.id = s.business_id
      where s.plan_id = restaurant_plan_limits.plan_id
        and bm.user_id = (select auth.uid())
        and bm.status = 'active'
        and b.business_type = 'restaurante'
    )
  );

drop policy if exists memberships_select_self_or_business_admin on public.business_memberships;
create policy memberships_select_self_or_business_admin
  on public.business_memberships
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.has_business_role(business_id, array['owner','admin']::text[])
  );

create index if not exists business_memberships_waiter_capacity_idx
  on public.business_memberships (business_id, role, status);

create or replace function private.enforce_restaurant_waiter_limit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_business_type text;
  v_plan_id uuid;
  v_limit integer;
  v_count integer;
begin
  if new.role <> 'waiter' or new.status not in ('active','invited') then
    return new;
  end if;

  select b.business_type into v_business_type
  from public.businesses b where b.id = new.business_id for update;

  if v_business_type is distinct from 'restaurante' then
    raise exception 'Los perfiles de mesero solo están disponibles para restaurantes.'
      using errcode = '42501';
  end if;

  select s.plan_id into v_plan_id
  from public.subscriptions s
  where s.business_id = new.business_id
    and s.status = 'active'
    and (s.ends_at is null or s.ends_at > now())
  order by s.created_at desc limit 1;

  if v_plan_id is null then
    raise exception 'El comercio no tiene un plan activo para habilitar meseros.'
      using errcode = '23514';
  end if;

  select l.max_waiters into v_limit
  from public.restaurant_plan_limits l where l.plan_id = v_plan_id;

  if v_limit is null then
    raise exception 'El plan aún no tiene un cupo de meseros configurado.'
      using errcode = '23514';
  end if;

  select count(*)::integer into v_count
  from public.business_memberships bm
  where bm.business_id = new.business_id
    and bm.role = 'waiter'
    and bm.status in ('active','invited')
    and bm.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if v_count >= v_limit then
    raise exception 'El comercio alcanzó el límite de meseros de su plan (%).', v_limit
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

drop trigger if exists enforce_restaurant_waiter_limit on public.business_memberships;
create trigger enforce_restaurant_waiter_limit
before insert or update of role, status, business_id
on public.business_memberships
for each row execute function private.enforce_restaurant_waiter_limit();

revoke all on function private.enforce_restaurant_waiter_limit() from public, anon, authenticated;
