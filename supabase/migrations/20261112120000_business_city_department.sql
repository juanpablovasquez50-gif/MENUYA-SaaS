-- Store each tenant's operating city and department for delivery coverage.
alter table public.businesses
  add column if not exists city text,
  add column if not exists department text;

create or replace function public.set_business_location(
  p_business_id uuid,
  p_city text,
  p_department text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.' using errcode = '42501';
  end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_city,''))) not between 2 and 100
     or pg_catalog.length(pg_catalog.btrim(coalesce(p_department,''))) not between 2 and 100 then
    raise exception 'Indica una ciudad y un departamento válidos.';
  end if;
  update public.businesses
     set city = pg_catalog.btrim(p_city),
         department = pg_catalog.btrim(p_department)
   where id = p_business_id
     and public.private_has_business_role(p_business_id, array['owner','admin']::text[]);
  if not found then
    raise exception 'No tienes permisos para modificar este comercio.' using errcode = '42501';
  end if;
end;
$function$;

create or replace function public.set_business_location_for_current_user(
  p_city text,
  p_department text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_business_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.' using errcode = '42501';
  end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_city,''))) not between 2 and 100
     or pg_catalog.length(pg_catalog.btrim(coalesce(p_department,''))) not between 2 and 100 then
    raise exception 'Indica una ciudad y un departamento válidos.';
  end if;
  select b.id into v_business_id
    from public.businesses b
   where b.owner_id = auth.uid()
   order by b.created_at desc
   limit 1;
  if v_business_id is null then
    raise exception 'No encontramos un comercio asociado a esta cuenta.';
  end if;
  update public.businesses
     set city = pg_catalog.btrim(p_city),
         department = pg_catalog.btrim(p_department)
   where id = v_business_id;
end;
$function$;

revoke all on function public.set_business_location(uuid,text,text) from public, anon;
revoke all on function public.set_business_location_for_current_user(text,text) from public, anon;
grant execute on function public.set_business_location(uuid,text,text) to authenticated;
grant execute on function public.set_business_location_for_current_user(text,text) to authenticated;
