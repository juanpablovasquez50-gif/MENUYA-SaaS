-- Allow authenticated RLS policies to resolve the private role helper.
-- Trigger-only functions remain non-executable by application users.

grant usage on schema private to authenticated;

revoke execute on function private.add_business_owner_membership() from public, anon, authenticated;
revoke execute on function private.guard_business_admin_fields() from public, anon, authenticated;
revoke execute on function private.handle_new_auth_user() from public, anon, authenticated;

grant execute on function private.has_business_role(uuid, text[]) to authenticated;
