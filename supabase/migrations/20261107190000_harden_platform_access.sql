-- Tighten access to privileged platform RPCs and administrative tables.
-- The RPCs retain their internal platform_admins membership checks.

revoke all on function public.platform_list_audit_logs() from public, anon;
revoke all on function public.platform_list_plans() from public, anon;
revoke all on function public.platform_list_subscriptions() from public, anon;
revoke all on function public.platform_list_users() from public, anon;
revoke all on function public.platform_list_businesses() from public, anon;
revoke all on function public.platform_save_plan(uuid, text, text, numeric, text, integer, jsonb, boolean) from public, anon;
revoke all on function public.platform_set_business_status(uuid, text, text) from public, anon;
revoke all on function public.platform_update_subscription(uuid, uuid, text, timestamptz, text) from public, anon;

grant execute on function public.platform_list_audit_logs() to authenticated, service_role;
grant execute on function public.platform_list_plans() to authenticated, service_role;
grant execute on function public.platform_list_subscriptions() to authenticated, service_role;
grant execute on function public.platform_list_users() to authenticated, service_role;
grant execute on function public.platform_list_businesses() to authenticated, service_role;
grant execute on function public.platform_save_plan(uuid, text, text, numeric, text, integer, jsonb, boolean) to authenticated, service_role;
grant execute on function public.platform_set_business_status(uuid, text, text) to authenticated, service_role;
grant execute on function public.platform_update_subscription(uuid, uuid, text, timestamptz, text) to authenticated, service_role;

revoke all on table public.platform_admins from public, anon, authenticated;
grant select on table public.platform_admins to authenticated;

revoke all on table public.plans from public, anon, authenticated;
grant select on table public.plans to anon, authenticated;

revoke all on table public.subscriptions from public, anon, authenticated;
grant select on table public.subscriptions to authenticated;
