create or replace function public.clickok_support_is_enabled()
returns boolean language sql stable security definer set search_path=''
as $$ select coalesce((select setting_value='true'::jsonb or setting_value->>'enabled'='true' from public.platform_settings where setting_key='support.enabled'),false); $$;
grant execute on function public.clickok_support_is_enabled() to authenticated;
grant insert,update,delete on public.clickok_support_agents to authenticated;
drop policy if exists businesses_support_agents_select on public.businesses;
create policy businesses_support_agents_select on public.businesses for select to authenticated using(public.clickok_support_is_agent() or public.clickok_support_is_admin());