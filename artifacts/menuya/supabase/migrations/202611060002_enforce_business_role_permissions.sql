-- MENUYA: role-aware authorization for each tenant.
-- Requires public.business_memberships and the existing private schema.

create or replace function private.has_business_role(
  p_business_id uuid,
  p_allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.business_memberships bm
    where bm.business_id = p_business_id
      and bm.user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.role = any(p_allowed_roles)
  );
$function$;

revoke all on function private.has_business_role(uuid, text[]) from public;
revoke all on function private.has_business_role(uuid, text[]) from anon;
grant execute on function private.has_business_role(uuid, text[]) to authenticated;

drop policy if exists branches_tenant_access on public.branches;
create policy branches_tenant_access on public.branches for all to authenticated
using (private.has_business_role(business_id, array['owner','admin','manager']))
with check (private.has_business_role(business_id, array['owner','admin','manager']));

drop policy if exists cash_sessions_tenant_access on public.cash_sessions;
create policy cash_sessions_tenant_access on public.cash_sessions for all to authenticated
using (private.has_business_role(business_id, array['owner','admin','manager','cashier']))
with check (private.has_business_role(business_id, array['owner','admin','manager','cashier']));

drop policy if exists customers_tenant_access on public.customers;
create policy customers_tenant_access on public.customers for all to authenticated
using (private.has_business_role(business_id, array['owner','admin','manager','orders','cashier']))
with check (private.has_business_role(business_id, array['owner','admin','manager','orders','cashier']));

drop policy if exists inventory_movements_tenant_access on public.inventory_movements;
create policy inventory_movements_tenant_access on public.inventory_movements for all to authenticated
using (private.has_business_role(business_id, array['owner','admin','manager']))
with check (private.has_business_role(business_id, array['owner','admin','manager']));

drop policy if exists order_items_tenant_access on public.order_items;
create policy order_items_tenant_access on public.order_items for all to authenticated
using (private.has_business_role(business_id, array['owner','admin','manager','orders','cashier']))
with check (private.has_business_role(business_id, array['owner','admin','manager','orders','cashier']));

drop policy if exists orders_tenant_access on public.orders;
create policy orders_tenant_access on public.orders for all to authenticated
using (private.has_business_role(business_id, array['owner','admin','manager','orders','cashier']))
with check (private.has_business_role(business_id, array['owner','admin','manager','orders','cashier']));

drop policy if exists categories_delete_member on public.categories;
create policy categories_delete_member on public.categories for delete to authenticated
using (private.has_business_role(business_id, array['owner','admin','manager','catalog']));

drop policy if exists categories_insert_member on public.categories;
create policy categories_insert_member on public.categories for insert to authenticated
with check (private.has_business_role(business_id, array['owner','admin','manager','catalog']));

drop policy if exists categories_update_member on public.categories;
create policy categories_update_member on public.categories for update to authenticated
using (private.has_business_role(business_id, array['owner','admin','manager','catalog']))
with check (private.has_business_role(business_id, array['owner','admin','manager','catalog']));

drop policy if exists product_options_delete_member on public.product_options;
create policy product_options_delete_member on public.product_options for delete to authenticated
using (private.has_business_role(business_id, array['owner','admin','manager','catalog']));

drop policy if exists product_options_insert_member on public.product_options;
create policy product_options_insert_member on public.product_options for insert to authenticated
with check (private.has_business_role(business_id, array['owner','admin','manager','catalog']));

drop policy if exists product_options_update_member on public.product_options;
create policy product_options_update_member on public.product_options for update to authenticated
using (private.has_business_role(business_id, array['owner','admin','manager','catalog']))
with check (private.has_business_role(business_id, array['owner','admin','manager','catalog']));

drop policy if exists product_option_values_delete_member on public.product_option_values;
create policy product_option_values_delete_member on public.product_option_values for delete to authenticated
using (private.has_business_role(business_id, array['owner','admin','manager','catalog']));

drop policy if exists product_option_values_insert_member on public.product_option_values;
create policy product_option_values_insert_member on public.product_option_values for insert to authenticated
with check (private.has_business_role(business_id, array['owner','admin','manager','catalog']));

drop policy if exists product_option_values_update_member on public.product_option_values;
create policy product_option_values_update_member on public.product_option_values for update to authenticated
using (private.has_business_role(business_id, array['owner','admin','manager','catalog']))
with check (private.has_business_role(business_id, array['owner','admin','manager','catalog']));

drop policy if exists products_delete_member on public.products;
create policy products_delete_member on public.products for delete to authenticated
using (private.has_business_role(business_id, array['owner','admin','manager','catalog']));

drop policy if exists products_insert_member on public.products;
create policy products_insert_member on public.products for insert to authenticated
with check (private.has_business_role(business_id, array['owner','admin','manager','catalog']));

drop policy if exists products_update_member on public.products;
create policy products_update_member on public.products for update to authenticated
using (private.has_business_role(business_id, array['owner','admin','manager','catalog']))
with check (private.has_business_role(business_id, array['owner','admin','manager','catalog']));

drop policy if exists sales_tenant_access on public.sales;
create policy sales_tenant_access on public.sales for all to authenticated
using (private.has_business_role(business_id, array['owner','admin','manager','cashier']))
with check (private.has_business_role(business_id, array['owner','admin','manager','cashier']));

drop policy if exists store_settings_delete_member on public.store_settings;
create policy store_settings_delete_member on public.store_settings for delete to authenticated
using (private.has_business_role(business_id, array['owner','admin','manager','catalog']));

drop policy if exists store_settings_insert_member on public.store_settings;
create policy store_settings_insert_member on public.store_settings for insert to authenticated
with check (private.has_business_role(business_id, array['owner','admin','manager','catalog']));

drop policy if exists store_settings_update_member on public.store_settings;
create policy store_settings_update_member on public.store_settings for update to authenticated
using (private.has_business_role(business_id, array['owner','admin','manager','catalog']))
with check (private.has_business_role(business_id, array['owner','admin','manager','catalog']));

drop policy if exists subscriptions_tenant_read on public.subscriptions;
create policy subscriptions_tenant_read on public.subscriptions for select to authenticated
using (private.has_business_role(business_id, array['owner','admin']));

drop policy if exists audit_logs_tenant_read on public.audit_logs;
create policy audit_logs_tenant_read on public.audit_logs for select to authenticated
using (business_id is not null and private.has_business_role(business_id, array['owner','admin','manager']));

drop policy if exists catalog_events_tenant_read on public.catalog_events;
create policy catalog_events_tenant_read on public.catalog_events for select to authenticated
using (private.has_business_role(business_id, array['owner','admin','manager']));
