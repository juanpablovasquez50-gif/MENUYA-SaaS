create or replace function public.platform_list_audit_logs()
returns table(id uuid,business_name text,previous_status text,new_status text,note text,created_at timestamptz,actor_user_id uuid)
language plpgsql stable security definer set search_path = ''
as $$
begin
 if not exists(select 1 from public.platform_admins pa where pa.user_id=auth.uid()) then
  raise exception 'No tienes permisos de Superadmin.' using errcode='42501';
 end if;
 return query select l.id,l.business_name,l.previous_status,l.new_status,l.note,l.created_at,l.actor_user_id
 from public.platform_audit_logs l order by l.created_at desc limit 100;
end; $$;
revoke all on function public.platform_list_audit_logs() from public;
grant execute on function public.platform_list_audit_logs() to authenticated;
