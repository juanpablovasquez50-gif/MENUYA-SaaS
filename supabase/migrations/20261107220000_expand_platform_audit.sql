ALTER TABLE public.platform_audit_logs
  ADD COLUMN IF NOT EXISTS action text NOT NULL DEFAULT 'status_changed',
  ADD COLUMN IF NOT EXISTS entity_type text NOT NULL DEFAULT 'business',
  ADD COLUMN IF NOT EXISTS entity_id uuid,
  ADD COLUMN IF NOT EXISTS entity_name text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.platform_audit_logs SET entity_name=business_name WHERE entity_name IS NULL;

CREATE OR REPLACE FUNCTION public.platform_capture_admin_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_id uuid;
  v_business_id uuid;
  v_name text;
  v_entity text;
  v_action text;
  v_before jsonb := '{}'::jsonb;
  v_after jsonb := '{}'::jsonb;
  v_metadata jsonb := '{}'::jsonb;
  v_previous text;
  v_next text;
BEGIN
  IF v_actor IS NULL THEN
    IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  IF TG_OP<>'INSERT' THEN v_before:=to_jsonb(OLD); END IF;
  IF TG_OP<>'DELETE' THEN v_after:=to_jsonb(NEW); END IF;
  v_id:=COALESCE((v_after->>'id')::uuid,(v_before->>'id')::uuid);

  IF TG_TABLE_NAME='businesses' THEN
    v_entity:='business'; v_business_id:=v_id;
    v_name:=COALESCE(v_after->>'name',v_before->>'name','Comercio');
    v_previous:=v_before->>'status'; v_next:=v_after->>'status';
    v_metadata:=jsonb_build_object('status_before',v_previous,'status_after',v_next,
      'published_before',v_before->'is_published','published_after',v_after->'is_published');
  ELSIF TG_TABLE_NAME='plans' THEN
    v_entity:='plan'; v_name:=COALESCE(v_after->>'name',v_before->>'name','Plan');
    v_previous:=CASE WHEN TG_OP='INSERT' THEN NULL ELSE 'updated' END;
    v_next:=CASE WHEN TG_OP='INSERT' THEN 'created' ELSE 'updated' END;
    v_metadata:=jsonb_build_object('code',COALESCE(v_after->>'code',v_before->>'code'),
      'price_before',v_before->'price','price_after',v_after->'price',
      'billing_period_before',v_before->'billing_period','billing_period_after',v_after->'billing_period',
      'max_products_before',v_before->'max_products','max_products_after',v_after->'max_products',
      'is_active_before',v_before->'is_active','is_active_after',v_after->'is_active');
  ELSE
    v_entity:='subscription';
    v_business_id:=COALESCE((v_after->>'business_id')::uuid,(v_before->>'business_id')::uuid);
    SELECT b.name INTO v_name FROM public.businesses b WHERE b.id=v_business_id;
    v_name:=COALESCE(v_name,'Suscripción');
    v_previous:=v_before->>'status'; v_next:=v_after->>'status';
    v_metadata:=jsonb_build_object('status_before',v_previous,'status_after',v_next,
      'plan_before',v_before->'plan_id','plan_after',v_after->'plan_id',
      'ends_at_before',v_before->'ends_at','ends_at_after',v_after->'ends_at');
  END IF;

  IF TG_OP='INSERT' THEN v_action:='created';
  ELSIF TG_OP='DELETE' THEN v_action:='deleted';
  ELSIF TG_TABLE_NAME='businesses' THEN v_action:='status_changed';
  ELSE v_action:='updated'; END IF;

  INSERT INTO public.platform_audit_logs
    (actor_user_id,business_id,business_name,previous_status,new_status,note,action,entity_type,entity_id,entity_name,metadata)
  VALUES (v_actor,v_business_id,v_name,v_previous,COALESCE(v_next,v_action),
    'Cambio registrado automáticamente',v_action,v_entity,v_id,v_name,v_metadata);
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$;

DROP TRIGGER IF EXISTS platform_audit_businesses_insert ON public.businesses;
DROP TRIGGER IF EXISTS platform_audit_businesses_update ON public.businesses;
CREATE TRIGGER platform_audit_businesses_insert AFTER INSERT ON public.businesses
FOR EACH ROW EXECUTE FUNCTION public.platform_capture_admin_audit();
CREATE TRIGGER platform_audit_businesses_update AFTER UPDATE ON public.businesses
FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.is_published IS DISTINCT FROM NEW.is_published)
EXECUTE FUNCTION public.platform_capture_admin_audit();

DROP TRIGGER IF EXISTS platform_audit_plans_insert ON public.plans;
DROP TRIGGER IF EXISTS platform_audit_plans_update ON public.plans;
CREATE TRIGGER platform_audit_plans_insert AFTER INSERT ON public.plans
FOR EACH ROW EXECUTE FUNCTION public.platform_capture_admin_audit();
CREATE TRIGGER platform_audit_plans_update AFTER UPDATE ON public.plans
FOR EACH ROW WHEN (to_jsonb(OLD) IS DISTINCT FROM to_jsonb(NEW))
EXECUTE FUNCTION public.platform_capture_admin_audit();

DROP TRIGGER IF EXISTS platform_audit_subscriptions_insert ON public.subscriptions;
DROP TRIGGER IF EXISTS platform_audit_subscriptions_update ON public.subscriptions;
CREATE TRIGGER platform_audit_subscriptions_insert AFTER INSERT ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.platform_capture_admin_audit();
CREATE TRIGGER platform_audit_subscriptions_update AFTER UPDATE ON public.subscriptions
FOR EACH ROW WHEN (to_jsonb(OLD) IS DISTINCT FROM to_jsonb(NEW))
EXECUTE FUNCTION public.platform_capture_admin_audit();

CREATE OR REPLACE FUNCTION public.platform_list_audit_logs()
RETURNS TABLE(
  id uuid,business_name text,previous_status text,new_status text,note text,
  created_at timestamptz,actor_user_id uuid,actor_email text,action text,
  entity_type text,entity_id uuid,entity_name text,metadata jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id=auth.uid()) THEN
    RAISE EXCEPTION 'No tienes permisos de Superadmin.' USING errcode='42501';
  END IF;
  RETURN QUERY
    SELECT l.id,l.business_name,l.previous_status,l.new_status,l.note,l.created_at,
      l.actor_user_id,au.email::text,l.action,l.entity_type,l.entity_id,
      COALESCE(l.entity_name,l.business_name),l.metadata
    FROM public.platform_audit_logs l
    LEFT JOIN auth.users au ON au.id=l.actor_user_id
    WHERE NOT (l.action='status_changed' AND l.previous_status IS NOT NULL AND l.previous_status=l.new_status)
    ORDER BY l.created_at DESC LIMIT 200;
END;
$function$;

CREATE OR REPLACE FUNCTION public.platform_save_setting(
  p_setting_key text,p_setting_value jsonb,p_description text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_old jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id=auth.uid()) THEN
    RAISE EXCEPTION 'No tienes permisos de Superadmin.' USING errcode='42501';
  END IF;
  IF p_setting_key IS NULL OR p_setting_key !~ '^[a-z][a-z0-9_.-]{1,79}$' OR p_setting_value IS NULL THEN
    RAISE EXCEPTION 'Clave o valor de ajuste inválido.' USING errcode='22023';
  END IF;
  SELECT setting_value INTO v_old FROM public.platform_settings WHERE setting_key=p_setting_key;
  INSERT INTO public.platform_settings(setting_key,setting_value,description,updated_by,updated_at)
  VALUES(p_setting_key,p_setting_value,p_description,auth.uid(),now())
  ON CONFLICT(setting_key) DO UPDATE SET setting_value=EXCLUDED.setting_value,
    description=EXCLUDED.description,updated_by=EXCLUDED.updated_by,updated_at=now();
  INSERT INTO public.platform_audit_logs
    (actor_user_id,business_name,previous_status,new_status,note,action,entity_type,entity_name,metadata)
  VALUES(auth.uid(),'Ajustes de plataforma',CASE WHEN v_old IS NULL THEN NULL ELSE 'updated' END,
    CASE WHEN v_old IS NULL THEN 'created' ELSE 'updated' END,
    'Ajuste modificado: '||p_setting_key,CASE WHEN v_old IS NULL THEN 'created' ELSE 'updated' END,
    'setting',p_setting_key,p_setting_value);
END;
$function$;

REVOKE ALL ON FUNCTION public.platform_capture_admin_audit() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.platform_save_setting(text,jsonb,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.platform_list_audit_logs() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.platform_save_setting(text,jsonb,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.platform_list_audit_logs() TO authenticated,service_role;
