-- MENUYA platform administration. Apply only after reviewing the target Supabase project.
create table if not exists public.platform_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  business_id uuid references public.businesses(id) on delete set null,
  business_name text not null,
  previous_status text,
  new_status text not null,
  note text,
  created_at timestamptz not null default now()
);

alter table public.platform_audit_logs enable row level security;
revoke all on public.platform_audit_logs from anon, authenticated;

create or replace function public.platform_list_businesses()
returns table (
  id uuid, name text, slug text, business_type text, status text,
  is_published boolean, created_at timestamptz, email text, phone text
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
    select b.id, b.name, b.slug, b.business_type, b.status,
           b.is_published, b.created_at, b.email, b.phone
    from public.businesses b
    order by b.created_at desc;
end;
$function$;

create or replace function public.platform_set_business_status(
  p_business_id uuid,
  p_status text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_old_status text;
  v_name text;
begin
  if not exists (
    select 1 from public.platform_admins pa where pa.user_id = auth.uid()
  ) then
    raise exception 'No tienes permisos de Superadmin.' using errcode = '42501';
  end if;
  if p_status not in ('active', 'rejected', 'suspended') then
    raise exception 'Estado de comercio no permitido.' using errcode = '22023';
  end if;

  select b.status, b.name into v_old_status, v_name
  from public.businesses b where b.id = p_business_id for update;
  if not found then
    raise exception 'No se encontró el comercio.' using errcode = 'P0002';
  end if;

  update public.businesses
  set status = p_status,
      is_published = case when p_status = 'active' then is_published else false end
  where id = p_business_id;

  insert into public.platform_audit_logs (
    actor_user_id, business_id, business_name, previous_status, new_status, note
  ) values (
    auth.uid(), p_business_id, v_name, v_old_status, p_status,
    nullif(pg_catalog.btrim(coalesce(p_note, '')), '')
  );
end;
$function$;

revoke all on function public.platform_list_businesses() from public, anon;
revoke all on function public.platform_set_business_status(uuid, text, text) from public, anon;
grant execute on function public.platform_list_businesses() to authenticated;
grant execute on function public.platform_set_business_status(uuid, text, text) to authenticated;
