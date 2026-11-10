-- Align auth.users.email (varchar(255)) with the TEXT columns declared
-- by the Superadmin RPC return signatures.
CREATE OR REPLACE FUNCTION public.platform_list_subscriptions()
RETURNS TABLE(
  id uuid, business_id uuid, business_name text, owner_id uuid,
  owner_name text, owner_email text, plan_id uuid, plan_name text,
  price numeric, status text, starts_at timestamptz, ends_at timestamptz,
  external_reference text, created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'No tienes permisos de Superadmin.' USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT s.id, s.business_id, b.name, b.owner_id, pr.full_name,
         au.email::text, s.plan_id, p.name, p.price,
         s.status, s.starts_at, s.ends_at, s.external_reference, s.created_at
  FROM public.subscriptions s
  JOIN public.businesses b ON b.id = s.business_id
  JOIN public.plans p ON p.id = s.plan_id
  LEFT JOIN public.profiles pr ON pr.id = b.owner_id
  LEFT JOIN auth.users au ON au.id = b.owner_id
  ORDER BY s.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.platform_list_users()
RETURNS TABLE(
  user_id uuid, email text, full_name text, phone text,
  created_at timestamptz, business_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'No tienes permisos de Superadmin.' USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT au.id, au.email::text, pr.full_name, pr.phone, au.created_at,
         count(DISTINCT bm.business_id)::bigint
  FROM auth.users au
  LEFT JOIN public.profiles pr ON pr.id = au.id
  LEFT JOIN public.business_memberships bm
    ON bm.user_id = au.id AND bm.status = 'active'
  GROUP BY au.id, au.email, pr.full_name, pr.phone, au.created_at
  ORDER BY au.created_at DESC;
END;
$function$;
